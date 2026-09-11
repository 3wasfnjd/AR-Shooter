import * as THREE from 'three';
import { instantiateGLTF } from '../assets/AssetLoader.js';
import { autoOrientGun } from '../weapons/gunOrient.js';
import { ANIM, HITZONE_MULTIPLIER } from './SoldierTypes.js';
import { damp, dampAngle, clamp, randRange, scaleRigToHeight, lowestWorldY } from '../utils/math.js';
import { AUDIO } from '../assets/paths.js';

const UP = new THREE.Vector3(0, 1, 0);
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _ray = new THREE.Ray();
const _sphere = new THREE.Sphere();
const _hitPoint = new THREE.Vector3();

// Hurtbox radii as a fraction of the soldier's total (miniature) height —
// independent of the source glb's authored scale, so proportions stay
// correct at any target height in SOLDIER_TYPES.*.heightRange.
const RADIUS_FACTOR = {
  head: 0.09,
  chest: 0.16,
  hips: 0.16,
  armL: 0.05,
  armR: 0.05,
  legL: 0.055,
  legR: 0.055
};

let _uid = 0;

export class Soldier {
  constructor({ scene, effects, audio, type, sector = 0 }) {
    this.id = ++_uid;
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.type = type;
    this.sector = sector;

    this.group = new THREE.Group(); // world position + death-tilt quaternion
    this.facingPivot = new THREE.Group(); // Y-yaw only
    this.group.add(this.facingPivot);
    scene.add(this.group);

    this.height = randRange(type.heightRange[0], type.heightRange[1]);
    this.health = type.stats.health;
    this.maxHealth = type.stats.health;
    this.alive = true;
    this.state = 'loading';
    this.stateTimer = 0;
    this.yaw = sector;
    this.facingOffset = type.facingOffsetDeg ? THREE.MathUtils.degToRad(type.facingOffsetDeg) : 0;

    this.moveTarget = new THREE.Vector3();
    this.movingFire = false;
    this.sprint = false;
    this.shotsThisBurst = 0;
    this.suppressionCount = 0;
    this._fireCooldown = 0;
    this._footstepDist = 0;
    this._prevPos = new THREE.Vector3();
    this.coverPoint = null;
    this.previousState = 'alert';
    this._deathPhase = 0;
    this._deathElapsed = 0;
    this._wasRunning = false;

    this.hurtboxes = [];
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.weaponMuzzle = null;
    this.ready = false;
  }

  async load(spawnPos) {
    const { scene: model, animations } = await instantiateGLTF(this.type.model);
    scaleRigToHeight(model, this.height, this.type.heightBones.top, this.type.heightBones.bottom);
    model.position.y -= lowestWorldY(model, this.type.heightBones.bottom); // feet at local origin
    model.updateMatrixWorld(true);

    this.facingPivot.add(model);
    this.model = model;

    if (this.type.animated) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const [key, clipName] of Object.entries(ANIM)) {
        const clip = THREE.AnimationClip.findByName(animations, clipName);
        if (!clip) continue;
        const action = this.mixer.clipAction(clip);
        if (['death', 'dodge', 'reload', 'hitA', 'hitB'].includes(key)) {
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
        }
        this.actions[key] = action;
      }
      this._playAction('idle', { fadeTime: 0 });
      this._attachWeapon();
    } else {
      this._findEliteMuzzle();
    }

    this.group.position.copy(spawnPos);
    this._prevPos.copy(this.group.position);

    // Materialize by scaling up out of the portal rather than rising through
    // the floor: with no WebXR depth/occlusion in play, anything positioned
    // below y=0 would render "floating" through the real floor instead of
    // being hidden by it, so feet stay pinned at floor height throughout.
    this._fullScale = model.scale.x;
    model.scale.setScalar(0.001);

    this.state = 'spawning';
    this.stateTimer = 0;
    this.ready = true;
  }

  async _attachWeapon() {
    const wristName = this.type.boneNames.weaponHand;
    const wrist = this.model.getObjectByName(wristName);
    if (!wrist) return;
    try {
      const { scene: gun } = await instantiateGLTF(this.type.weaponModel);
      const muzzleLocal = autoOrientGun(gun, 0.015);
      const root = new THREE.Group();
      root.add(gun);
      const g = this.type.weaponGrip;
      root.position.set(...g.pos);
      root.rotation.set(
        THREE.MathUtils.degToRad(g.rotDeg[0]),
        THREE.MathUtils.degToRad(g.rotDeg[1]),
        THREE.MathUtils.degToRad(g.rotDeg[2])
      );
      const muzzle = new THREE.Object3D();
      muzzle.position.copy(muzzleLocal);
      gun.add(muzzle);
      wrist.add(root);
      this.weaponMuzzle = muzzle;
    } catch (err) {
      console.warn('[Soldier] failed to attach enemy weapon', err);
    }
  }

  _findEliteMuzzle() {
    for (const name of this.type.muzzleNodeNames || []) {
      const node = this.model.getObjectByName(name);
      if (node) {
        this.weaponMuzzle = node;
        return;
      }
    }
    this.weaponMuzzle = this.model;
  }

  _buildHurtboxes() {
    this.hurtboxes = [];
    const boneNames = this.type.boneNames || this.type.boneNamesFallback;
    if (!boneNames) return;
    for (const [key, name] of Object.entries(boneNames)) {
      if (key === 'weaponHand') continue;
      const bone = this.model.getObjectByName(name);
      if (bone) {
        this.hurtboxes.push({ key, bone, radius: this.height * (RADIUS_FACTOR[key] || 0.06) });
      }
    }
  }

  _playAction(key, { fadeTime = 0.2, timeScale = 1 } = {}) {
    if (!this.mixer) return;
    const action = this.actions[key];
    if (!action || action === this.currentAction) {
      if (action) action.timeScale = timeScale;
      return;
    }
    action.reset();
    action.timeScale = timeScale;
    action.play();
    if (this.currentAction) {
      this.currentAction.crossFadeTo(action, fadeTime, false);
    } else {
      action.fadeIn(fadeTime);
    }
    this.currentAction = action;
  }

  // NOTE: these intentionally allocate fresh vectors (not the module-level
  // _tmp/_tmp2 scratch used elsewhere in this file) because several call
  // sites read `forward`/`right` while a _tmp-based computation (e.g. the
  // movement direction in _updateReposition) is still in scope; sharing
  // scratch there previously caused it to be silently overwritten mid-use.
  get forward() {
    return new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, this.yaw + this.facingOffset);
  }

  get right() {
    return new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, this.yaw + this.facingOffset);
  }

  get position() {
    return this.group.position;
  }

  worldMuzzlePosition(out = new THREE.Vector3()) {
    if (this.weaponMuzzle) {
      this.weaponMuzzle.getWorldPosition(out);
      return out;
    }
    out.copy(this.group.position).addScaledVector(UP, this.height * 0.6);
    return out;
  }

  // ---- combat -------------------------------------------------------

  /** Ray-sphere test against this soldier's hurtboxes. Returns {point,normal,zone,dist} or null. */
  testRay(origin, dir, maxDist) {
    if (!this.alive || !this.ready || this.hurtboxes.length === 0) return null;
    _ray.origin.copy(origin);
    _ray.direction.copy(dir);
    let best = null;
    for (const hb of this.hurtboxes) {
      hb.bone.getWorldPosition(_sphere.center);
      _sphere.radius = hb.radius;
      const hit = _ray.intersectSphere(_sphere, _hitPoint);
      if (hit) {
        const dist = origin.distanceTo(hit);
        if (dist <= maxDist && (!best || dist < best.dist)) {
          const normal = hit.clone().sub(_sphere.center).normalize();
          best = { point: hit.clone(), normal, zone: hb.key, dist };
        }
      }
    }
    return best;
  }

  takeDamage(amount, hitPoint, zoneKey, shotDir) {
    if (!this.alive) return false;
    const mult = HITZONE_MULTIPLIER[zoneKey] || 1;
    this.health -= amount * mult;
    this.lastHitDir = shotDir.clone().normalize();
    this.audio.playAt(AUDIO.enemy.hit, this.group, { volume: 0.6, refDistance: 0.6 });

    if (this.health <= 0) {
      this._die();
      return true;
    }
    this._reactToHit(zoneKey);
    return false;
  }

  _reactToHit(zoneKey) {
    if (['dead', 'hitReact', 'dodge'].includes(this.state)) {
      if (this.state === 'dead') return;
    } else {
      this.previousState = this.state;
    }
    this.suppressionCount++;

    const front = this.forward.dot(this.lastHitDir) < 0; // shot traveling opposite facing = from front
    const useDodge = this.suppressionCount % 3 === 0 && this.state !== 'cover';

    if (useDodge && this.actions.dodge) {
      this.state = 'dodge';
      this._playAction('dodge', { fadeTime: 0.08 });
      this.actions.dodge.play();
      this.stateTimer = this.actions.dodge.getClip().duration;
      this._dodgeDir = Math.random() < 0.5 ? -1 : 1;
    } else {
      const key = zoneKey === 'armL' || zoneKey === 'legL' ? 'hitB' : front || zoneKey === 'armR' || zoneKey === 'legR' ? 'hitA' : 'hitB';
      const action = this.actions[key] || this.actions.hitA || this.actions.hitB;
      if (action) {
        this.state = 'hitReact';
        this._playAction(key, { fadeTime: 0.05 });
        this.stateTimer = action.getClip().duration * 0.9;
      } else {
        this.state = this.previousState;
      }
      // Small one-time flinch nudge, opposite the shot's travel direction.
      this.group.position.addScaledVector(this.lastHitDir, -0.02);
    }

    if (this.health <= this.maxHealth * 0.25) {
      this.previousState = 'cover';
    }
  }

  _die() {
    this.alive = false;
    this.state = 'dead';
    this._deathPhase = this._wasRunning ? 0 : 1;
    this._deathElapsed = 0;
    this._deathStartPos = this.group.position.clone();
    this._deathMoveDir = this._lastMoveDir ? this._lastMoveDir.clone() : this.forward;

    if (this.mixer && this.actions.death) {
      this._playAction('death', { fadeTime: 0.1 });
    }
    this.audio.playAt(AUDIO.enemy.death, this.group, { volume: 0.7, refDistance: 0.6 });

    const dir = this.lastHitDir || this.forward;
    const dot = this.forward.dot(dir);
    let fallDir;
    if (Math.abs(dot) > 0.35) {
      fallDir = dot > 0 ? this.forward.clone() : this.forward.clone().negate();
    } else {
      const cross = this.forward.x * dir.z - this.forward.z * dir.x;
      fallDir = cross > 0 ? this.right.clone().negate() : this.right.clone();
    }
    fallDir.y = 0;
    fallDir.normalize();
    this._fallTargetQuat = new THREE.Quaternion().setFromUnitVectors(UP, fallDir);
    this._fallStartQuat = this.group.quaternion.clone();

    if (this.coverPoint) {
      this.coverPoint.claimed = false;
      this.coverPoint = null;
    }
  }

  // ---- per-frame AI ---------------------------------------------------

  update(dt, ctx) {
    if (!this.ready) return;
    this.mixer?.update(dt);
    this.stateTimer -= dt;

    if (this.state === 'dead') {
      this._updateDeath(dt);
      return;
    }

    this._faceTarget(ctx.playerPos, dt, this.state);
    this._updateFireCooldown(dt);

    switch (this.state) {
      case 'spawning':
        this._updateSpawning(dt);
        break;
      case 'alert':
        this._updateAlert(dt, ctx);
        break;
      case 'reposition':
        this._updateReposition(dt, ctx);
        break;
      case 'aim':
        this._updateAim(dt, ctx);
        break;
      case 'shoot':
        this._updateShoot(dt, ctx);
        break;
      case 'reload':
        this._updateReload(dt, ctx);
        break;
      case 'cover':
        this._updateCover(dt, ctx);
        break;
      case 'hitReact':
        this._updateInterrupt(dt);
        break;
      case 'dodge':
        this._updateDodge(dt);
        break;
      default:
        this.state = 'alert';
    }

    this._trackFootsteps(dt);
  }

  _faceTarget(playerPos, dt, state) {
    const stationary = ['aim', 'shoot', 'cover', 'reload'].includes(state);
    const moving = ['reposition'].includes(state);
    if (!stationary && !moving) return;
    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const targetYaw = Math.atan2(dx, dz);
    this.yaw = dampAngle(this.yaw, targetYaw, 5, dt);
    this.facingPivot.rotation.y = this.yaw;
  }

  _updateSpawning(dt) {
    const next = damp(this.model.scale.x, this._fullScale, 7, dt);
    this.model.scale.setScalar(next);
    if (this._fullScale - next < this._fullScale * 0.02) {
      this.model.scale.setScalar(this._fullScale);
      this._buildHurtboxes();
      this.state = 'alert';
      this.stateTimer = randRange(0.25, this.type.stats.reactionTime);
      this._playAction('alert', { fadeTime: 0.3 });
      // Reused as a "contact" chime, not for its literal "hit confirmed"
      // meaning: a short, attention-grabbing ping at the soldier's own
      // position so the player has an audio cue to look toward new
      // arrivals even before they start firing (no dedicated "enemy
      // spotted" sound exists in assets/audio).
      this.audio.playAt(AUDIO.ui.hitConfirm, this.group, { volume: 0.3, refDistance: 0.8 });
    }
  }

  _updateAlert(dt, ctx) {
    this._playAction('alert', { fadeTime: 0.25 });
    if (this.stateTimer <= 0) {
      this._pickApproachTarget(ctx);
      this.sprint = true;
      this.state = 'reposition';
    }
  }

  _pickApproachTarget(ctx) {
    const radius = randRange(ctx.engagementMin, ctx.engagementMax);
    const angle = this.sector + randRange(-0.35, 0.35);
    this.moveTarget.set(
      ctx.playerPos.x + Math.sin(angle) * radius,
      this.group.position.y,
      ctx.playerPos.z + Math.cos(angle) * radius
    );
    this.movingFire = this.combatEngaged && Math.random() < 0.35;
  }

  _updateReposition(dt, ctx) {
    const speed = this.sprint ? this.type.stats.sprintSpeed : this.type.stats.moveSpeed;
    const toTarget = _tmp.copy(this.moveTarget).sub(this.group.position);
    toTarget.y = 0;
    const dist = toTarget.length();
    this._wasRunning = this.sprint;

    if (dist > 0.05) {
      const dir = toTarget.normalize();
      this._lastMoveDir = dir.clone();
      this.group.position.addScaledVector(dir, Math.min(speed * dt, dist));

      const fwd = this.forward;
      const right = this.right;
      const fComp = dir.dot(fwd);
      const rComp = dir.dot(right);
      let clip = 'walk';
      if (fComp > 0.45) clip = this.sprint ? 'run' : 'walk';
      else if (fComp < -0.45) clip = 'runBack';
      else if (rComp > 0.3) clip = 'runRight';
      else if (rComp < -0.3) clip = 'runLeft';

      if (this.movingFire) {
        // Fire regardless of whether a shootMoving clip exists (the Elite
        // has no clips at all and just slides its rigid mesh - still a
        // valid "advancing while firing" read with no animation to blend).
        if (this.actions.shootMoving) this._playAction('shootMoving', { fadeTime: 0.2 });
        else this._playAction(clip, { fadeTime: 0.2, timeScale: this.sprint ? 1.15 : 1 });
        if (this._fireCooldown <= 0) this._fireShot(ctx);
      } else {
        this._playAction(clip, { fadeTime: 0.2, timeScale: this.sprint ? 1.15 : 1 });
      }
    } else {
      this.sprint = false;
      this.movingFire = false;
      this.state = 'aim';
      this.stateTimer = randRange(0.15, this.type.stats.reactionTime);
    }
  }

  _updateAim(dt, ctx) {
    this._playAction('alert', { fadeTime: 0.2 });
    if (this.stateTimer > 0) return;

    const roll = Math.random();
    if (this.health <= this.maxHealth * 0.3 && roll < 0.4 && ctx.coverPoints.length) {
      this._seekCover(ctx);
    } else if (roll < 0.55) {
      this.state = 'shoot';
      this.shotsThisBurst = 0;
    } else {
      this._pickStrafeTarget(ctx);
      this.state = 'reposition';
    }
  }

  _pickStrafeTarget(ctx) {
    const radius = randRange(ctx.engagementMin, ctx.engagementMax);
    const angle = this.sector + randRange(-1.0, 1.0);
    this.moveTarget.set(
      ctx.playerPos.x + Math.sin(angle) * radius,
      this.group.position.y,
      ctx.playerPos.z + Math.cos(angle) * radius
    );
    this.sector = angle;
    this.sprint = false;
  }

  _seekCover(ctx) {
    const free = ctx.coverPoints.filter((c) => !c.claimed);
    if (!free.length) {
      this._pickStrafeTarget(ctx);
      this.state = 'reposition';
      return;
    }
    let best = free[0];
    let bestD = Infinity;
    for (const c of free) {
      const d = c.position.distanceToSquared(this.group.position);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    best.claimed = true;
    this.coverPoint = best;
    this.moveTarget.copy(best.position);
    this.sprint = false;
    this.state = 'reposition';
    this._toCover = true;
  }

  _updateShoot(dt, ctx) {
    this._playAction('shootStand', { fadeTime: 0.15 });
    if (this._fireCooldown <= 0) {
      this._fireShot(ctx);
    }
    if (this.shotsThisBurst >= this.type.stats.burstShots) {
      this.state = Math.random() < 0.45 ? 'reload' : 'aim';
      this.stateTimer = randRange(0.2, 0.5);
      if (this.state === 'reload') {
        this._playAction('reload', { fadeTime: 0.15 });
      }
    }
  }

  _updateReload(dt, ctx) {
    if (this.actions.reload) this._playAction('reload', { fadeTime: 0.15 });
    this._reloadT = (this._reloadT || 0) + dt;
    if (this._reloadT >= this.type.stats.reloadTime) {
      this._reloadT = 0;
      this.state = 'aim';
      this.stateTimer = 0.1;
    }
  }

  _updateCover(dt, ctx) {
    this._coverT = (this._coverT || 0) + dt;
    const cycle = this._coverT % 2.6;
    const exposed = cycle < 1.6;
    if (exposed) {
      this._playAction('shootStand', { fadeTime: 0.2 });
      if (this._fireCooldown <= 0) this._fireShot(ctx);
    } else {
      this._playAction('alert', { fadeTime: 0.3 });
    }
    if (this._coverT > 6) {
      this._coverT = 0;
      if (this.coverPoint) {
        this.coverPoint.claimed = false;
        this.coverPoint = null;
      }
      this.state = 'aim';
      this.stateTimer = 0.2;
    }
  }

  _updateInterrupt(dt) {
    if (this.stateTimer <= 0) {
      this.state = this._toCover && this.previousState === 'cover' ? 'aim' : this.previousState || 'aim';
      this.stateTimer = 0.15;
    }
  }

  _updateDodge(dt) {
    this.group.position.addScaledVector(this.right, this._dodgeDir * dt * 1.4);
    if (this.stateTimer <= 0) {
      this.state = this.previousState || 'aim';
      this.stateTimer = 0.1;
    }
  }

  _updateFireCooldown(dt) {
    this._fireCooldown = Math.max(0, this._fireCooldown - dt);
  }

  _fireShot(ctx) {
    this._fireCooldown = this.type.stats.fireCooldown * randRange(0.85, 1.2);
    this.shotsThisBurst++;
    this.combatEngaged = true;
    const muzzlePos = this.worldMuzzlePosition(_tmp2.clone());
    const dir = ctx.playerPos.clone().sub(muzzlePos).normalize();

    const spread = THREE.MathUtils.degToRad((1 - this.type.stats.accuracy) * 14);
    const jitterAxis = new THREE.Vector3(randRange(-1, 1), randRange(-1, 1), randRange(-1, 1)).normalize();
    const jitterAngle = Math.random() * spread;
    const shotDir = dir.clone().applyAxisAngle(jitterAxis, jitterAngle);

    const hitChance = this.type.stats.accuracy;
    const willHit = Math.random() < hitChance;
    const targetPoint = willHit
      ? ctx.playerPos.clone()
      : ctx.playerPos.clone().add(new THREE.Vector3(randRange(-0.4, 0.4), randRange(-0.3, 0.3), randRange(-0.4, 0.4)));

    this.effects.muzzleFlash(muzzlePos, this._muzzleQuat(shotDir), {
      size: this.type.id === 'elite' ? 0.05 : 0.04,
      life: 0.04,
      color: 0xffcf8a
    });
    this.effects.smokePuff(muzzlePos, { size: 0.03, life: 0.6, density: 0.3 });
    this.effects.tracer(muzzlePos, targetPoint, { width: 0.005, life: 0.05, color: 0xff8f5c });
    this.audio.playAt(AUDIO.weapons.rifle, this.group, { volume: 0.5, refDistance: 1.2 });

    ctx.onEnemyFire?.(this, willHit ? this.type.stats.damage : 0);
  }

  _muzzleQuat(dir) {
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, UP);
    q.setFromRotationMatrix(m);
    return q;
  }

  _trackFootsteps(dt) {
    if (!['reposition'].includes(this.state)) return;
    const d = this._prevPos.distanceTo(this.group.position);
    this._prevPos.copy(this.group.position);
    this._footstepDist += d;
    const stride = 0.14;
    if (this._footstepDist >= stride) {
      this._footstepDist = 0;
      this.audio.playFootstep(this.group, Math.random() < 0.5 ? 'sand' : 'stone', 0.28);
    }
  }

  _updateDeath(dt) {
    this._deathElapsed += dt;
    if (this._deathPhase === 0) {
      const t = clamp(this._deathElapsed / 0.22, 0, 1);
      // Closed-form exponential decay curve (using total elapsed time as
      // the damp() exponent rather than a per-frame dt): speed = 2.2 * e^-8t.
      const speed = damp(2.2, 0, 8, this._deathElapsed);
      this.group.position.addScaledVector(this._deathMoveDir, speed * dt);
      if (t >= 1) {
        this._deathPhase = 1;
        this._deathElapsed = 0;
      }
      return;
    }
    const t = clamp(this._deathElapsed / 0.5, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    this.group.quaternion.slerpQuaternions(this._fallStartQuat, this._fallTargetQuat, eased * 0.92);
  }

  get canDespawn() {
    return this.state === 'dead' && this._deathElapsed > 3.5;
  }

  dispose() {
    this.mixer?.stopAllAction();
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose?.();
      }
    });
  }
}
