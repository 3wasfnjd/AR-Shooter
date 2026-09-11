import * as THREE from 'three';
import { instantiateGLTF } from '../assets/AssetLoader.js';
import { WEAPON_DEFS, WEAPON_ORDER, weaponDef } from './WeaponDefs.js';
import { AUDIO } from '../assets/paths.js';
import { autoOrientGun } from './gunOrient.js';
import { damp, randRange, clamp } from '../utils/math.js';

const _muzzleWorldPos = new THREE.Vector3();
const _muzzleWorldQuat = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _axis = new THREE.Vector3();

/**
 * Owns every player weapon: loading/orienting the glbs, attaching the
 * active one to the shooting-hand controller grip, firing logic (semi/auto/
 * pump/bolt), procedural recoil, reload timing, and delegating hit tests
 * out to whatever the game wires up via `onHitTest`.
 */
export class WeaponSystem {
  constructor({ xrApp, effects, audio, shootingHand = 'right', switchHand = 'left' }) {
    this.xrApp = xrApp;
    this.effects = effects;
    this.audio = audio;
    this.shootingHand = shootingHand;
    this.switchHand = switchHand;

    this.models = new Map(); // id -> { root, muzzle, def }
    this.currentId = null;
    this.currentModel = null;
    this.locked = true; // true until the game equips a starting weapon

    this.ammo = new Map();
    for (const def of WEAPON_DEFS) this.ammo.set(def.id, def.magSize);

    this.state = {
      weaponId: null,
      ammo: 0,
      magSize: 0,
      reloading: false,
      reloadProgress: 0
    };

    this._cooldown = 0;
    this._lockUntil = 0; // pump/bolt cycling lockout
    this._reloading = false;
    this._reloadT = 0;
    this._stickArmed = true;

    this._recoilPos = new THREE.Vector3();
    this._recoilRot = 0;

    /** Set by the game: (origin:Vector3, dir:Vector3, maxDist:number) => {point, normal, enemy, zone} | null */
    this.onHitTest = null;
    /** Set by the game: (damage:number) fired on confirmed enemy hit, for score/hitmarker UI */
    this.onEnemyHit = null;
  }

  async preloadAll() {
    await Promise.all(WEAPON_DEFS.map((def) => this._loadWeapon(def)));
  }

  async _loadWeapon(def) {
    const { scene } = await instantiateGLTF(def.model);
    scene.userData.muzzleLocal = autoOrientGun(scene, def.muzzleForwardBias);

    const root = new THREE.Group();
    root.add(scene);
    root.position.set(...def.grip.pos);
    root.rotation.set(
      THREE.MathUtils.degToRad(def.grip.rotDeg[0]),
      THREE.MathUtils.degToRad(def.grip.rotDeg[1]),
      THREE.MathUtils.degToRad(def.grip.rotDeg[2])
    );
    root.scale.setScalar(def.scale);
    root.visible = false;

    const muzzle = new THREE.Object3D();
    muzzle.position.copy(scene.userData.muzzleLocal);
    scene.add(muzzle);

    this.models.set(def.id, { root, muzzle, def, innerScene: scene });
  }

  get activeModelEntry() {
    return this.currentId ? this.models.get(this.currentId) : null;
  }

  /** Called once weapon selection is confirmed (or to switch mid-run). */
  equip(id) {
    const entry = this.models.get(id);
    if (!entry) return;
    if (this.currentModel) this.currentModel.visible = false;
    this.currentId = id;
    this.currentModel = entry.root;
    this.currentModel.visible = true;
    this._cooldown = 0;
    this._lockUntil = 0;
    this._reloading = false;
    this._reloadT = 0;
    this._recoilPos.set(0, 0, 0);
    this._recoilRot = 0;
    this._syncState();
  }

  unlock() {
    this.locked = false;
  }

  lock() {
    this.locked = true;
  }

  _syncState() {
    const def = weaponDef(this.currentId);
    this.state.weaponId = this.currentId;
    this.state.ammo = this.ammo.get(this.currentId) ?? 0;
    this.state.magSize = def.magSize;
    this.state.reloading = this._reloading;
    this.state.reloadProgress = def.reloadTime ? clamp(this._reloadT / def.reloadTime, 0, 1) : 0;
  }

  cycleWeapon(dir = 1) {
    if (!this.currentId) return;
    const idx = WEAPON_ORDER.indexOf(this.currentId);
    const next = WEAPON_ORDER[(idx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length];
    this.equip(next);
  }

  startReload() {
    const def = weaponDef(this.currentId);
    if (!def || this._reloading) return;
    if ((this.ammo.get(this.currentId) ?? 0) >= def.magSize) return;
    this._reloading = true;
    this._reloadT = 0;
    const grip = this.xrApp.controllers[this.shootingHand]?.grip;
    if (grip && def.reloadSound) this.audio.playAt(def.reloadSound, grip, { volume: 0.8 });
  }

  update(dt, input) {
    const grip = this.xrApp.controllers[this.shootingHand]?.grip;
    if (grip && this.currentModel && this.currentModel.parent !== grip) {
      grip.add(this.currentModel);
    }

    this._handleSwitching(input);

    if (this._reloading) {
      const def = weaponDef(this.currentId);
      this._reloadT += dt;
      if (this._reloadT >= def.reloadTime) {
        this.ammo.set(this.currentId, def.magSize);
        this._reloading = false;
        this._reloadT = 0;
      }
    }

    this._cooldown = Math.max(0, this._cooldown - dt);
    this._lockUntil = Math.max(0, this._lockUntil - dt);

    if (!this.locked && this.currentId) {
      this._handleFiring(dt, input);
    }

    this._updateRecoil(dt);
    this._syncState();
  }

  _handleSwitching(input) {
    const s = input.state[this.switchHand];
    if (!s) return;
    const x = s.thumbstick.x;
    if (Math.abs(x) < 0.3) this._stickArmed = true;
    else if (this._stickArmed) {
      // Cycling is always available (even while firing is locked, e.g.
      // during the pre-game weapon-select browse) so the player can try
      // weapons in-hand before committing.
      this.cycleWeapon(x > 0 ? 1 : -1);
      this._stickArmed = false;
    }
    if (s.aPressed && this._reloadArmed !== false) {
      this.startReload();
      this._reloadArmed = false;
    } else if (!s.aPressed) {
      this._reloadArmed = true;
    }
  }

  _handleFiring(dt, input) {
    const s = input.state[this.shootingHand];
    if (!s) return;
    const def = weaponDef(this.currentId);
    const ammo = this.ammo.get(this.currentId) ?? 0;

    if (this._reloading) return;
    if (this._lockUntil > 0) return;

    const wantsFire = def.kind === 'auto' ? s.triggerDown : s.triggerPressed;
    if (!wantsFire) return;

    if (this._cooldown > 0) return;

    if (ammo <= 0) {
      if (s.triggerPressed) {
        const grip = this.xrApp.controllers[this.shootingHand]?.grip;
        if (grip) this.audio.playAt(AUDIO.weapons.emptyClick, grip, { volume: 0.7 });
      }
      this.startReload();
      return;
    }

    this._fire(def);
  }

  _fire(def) {
    const entry = this.models.get(this.currentId);
    if (!entry) return;
    entry.muzzle.updateMatrixWorld(true);
    entry.muzzle.getWorldPosition(_muzzleWorldPos);
    entry.muzzle.getWorldQuaternion(_muzzleWorldQuat);
    _fwd.set(0, 0, -1).applyQuaternion(_muzzleWorldQuat).normalize();

    this.ammo.set(this.currentId, Math.max(0, (this.ammo.get(this.currentId) ?? 0) - 1));
    this._cooldown = def.fireCooldown;
    if (def.kind === 'pump') this._lockUntil = def.pumpTime;
    if (def.kind === 'bolt') this._lockUntil = def.boltCycleTime;

    this.effects.muzzleFlash(_muzzleWorldPos, _muzzleWorldQuat, def.flash);
    if (Math.random() < def.smoke.chance) {
      this.effects.smokePuff(_muzzleWorldPos, def.smoke);
    }

    const grip = this.xrApp.controllers[this.shootingHand]?.grip;
    if (grip) {
      this.audio.playAt(def.sound, grip, { volume: 0.95 });
      this.xrApp.pulse(this.shootingHand, def.haptics.intensity, def.haptics.durationMs);
    }

    const pellets = def.pellets || 1;
    const spreadRad = THREE.MathUtils.degToRad(def.spreadDeg);
    for (let i = 0; i < pellets; i++) {
      const dir = this._jitterDirection(_fwd, spreadRad);
      const result = this.onHitTest ? this.onHitTest(_muzzleWorldPos, dir, 12) : null;
      const endPoint = result ? result.point : _muzzleWorldPos.clone().addScaledVector(dir, 12);
      this.effects.tracer(_muzzleWorldPos, endPoint, def.tracer);
      if (result) {
        this.effects.impact(result.point, result.normal, { size: 0.045, sparks: 5 });
        this.onEnemyHit?.(result, def.damage, dir);
      }
    }

    // Impulse: snap recoil further out, then let _updateRecoil damp it back
    // to rest every frame. Stacks during sustained automatic fire.
    this._recoilPos.z = Math.min(this._recoilPos.z + def.recoil.kickBack, def.recoil.kickBack * 2.2);
    this._recoilRot = Math.min(
      this._recoilRot + THREE.MathUtils.degToRad(def.recoil.riseDeg) * randRange(0.85, 1.15),
      THREE.MathUtils.degToRad(def.recoil.riseDeg) * 2.5
    );
  }

  _jitterDirection(forward, spreadRad) {
    if (spreadRad <= 0) return forward.clone();
    _axis.set(randRange(-1, 1), randRange(-1, 1), randRange(-1, 1)).normalize();
    const angle = Math.random() * spreadRad;
    _tmpQuat.setFromAxisAngle(_axis, angle);
    return forward.clone().applyQuaternion(_tmpQuat);
  }

  _updateRecoil(dt) {
    const def = this.currentId ? weaponDef(this.currentId) : null;
    const recoverySpeed = def ? def.recoil.recoverySpeed : 12;

    this._recoilPos.z = damp(this._recoilPos.z, 0, recoverySpeed, dt);
    this._recoilRot = damp(this._recoilRot, 0, recoverySpeed, dt);

    if (this.currentModel) {
      this.currentModel.position.set(
        weaponDef(this.currentId).grip.pos[0] + this._recoilPos.x,
        weaponDef(this.currentId).grip.pos[1] + this._recoilPos.y,
        weaponDef(this.currentId).grip.pos[2] - this._recoilPos.z
      );
      this.currentModel.rotation.x = THREE.MathUtils.degToRad(weaponDef(this.currentId).grip.rotDeg[0]) - this._recoilRot;
    }
  }
}
