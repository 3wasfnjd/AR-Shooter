import * as THREE from 'three';
import { instantiateGLTF } from '../assets/AssetLoader.js';
import { WEAPON_DEFS, WEAPON_ORDER, weaponDef } from './WeaponDefs.js';
import { AUDIO } from '../assets/paths.js';
import { orientGun } from './gunOrient.js';
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
    this._cycleBtnArmed = true;
    this._swapBtnArmed = true;
    this._pitchBtnArmed = true;
    this._rollBtnArmed = true;
    this._bothTriggersHeldT = 0;
    this._calibrateArmed = true;

    this._recoilPos = new THREE.Vector3();
    this._recoilRot = 0;

    // Live per-weapon grip overrides, editable in calibration mode; start
    // as a copy of each WeaponDefs.js default so tuning never mutates the
    // shared def. See enterCalibration() below.
    this.gripOverrides = new Map();
    this.calibrating = false;

    /** Set by the game: (origin:Vector3, dir:Vector3, maxDist:number) => {point, normal, enemy, zone} | null */
    this.onHitTest = null;
    /** Set by the game: (damage:number) fired on confirmed enemy hit, for score/hitmarker UI */
    this.onEnemyHit = null;
  }

  _gripFor(id) {
    if (!this.gripOverrides.has(id)) {
      const def = weaponDef(id);
      this.gripOverrides.set(id, { pos: [...def.grip.pos], rotDeg: [...def.grip.rotDeg] });
    }
    return this.gripOverrides.get(id);
  }

  async preloadAll() {
    await Promise.all(WEAPON_DEFS.map((def) => this._loadWeapon(def)));
  }

  async _loadWeapon(def) {
    const { scene } = await instantiateGLTF(def.model);
    scene.userData.muzzleLocal = orientGun(scene, def.muzzleForwardBias);

    const grip = this._gripFor(def.id);
    const root = new THREE.Group();
    root.add(scene);
    root.position.set(...grip.pos);
    root.rotation.set(
      THREE.MathUtils.degToRad(grip.rotDeg[0]),
      THREE.MathUtils.degToRad(grip.rotDeg[1]),
      THREE.MathUtils.degToRad(grip.rotDeg[2])
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
    this._handleCalibrationToggle(dt, input);

    const grip = this.xrApp.controllers[this.shootingHand]?.grip;
    if (grip && this.currentModel && this.currentModel.parent !== grip) {
      grip.add(this.currentModel);
    }

    if (this.calibrating) {
      this._updateCalibration(dt, input);
      this._syncState();
      return;
    }

    this._handleSwitching(input);
    this._handleHandSwap(input);

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

  /** Swaps which hand fires and which hand holds the switch/reload/HUD controls. */
  swapHands() {
    const oldShoot = this.shootingHand;
    this.shootingHand = this.switchHand;
    this.switchHand = oldShoot;
    this.onHandsSwapped?.(this.shootingHand);
  }

  _handleHandSwap(input) {
    // A dedicated button (not a hand-specific one) so it works no matter
    // which hand is currently the "right"/shooting one.
    const pressed = input.state.left.thumbstickPressed || input.state.right.thumbstickPressed;
    if (!pressed) {
      this._swapBtnArmed = true;
      return;
    }
    if (this._swapBtnArmed) {
      this.swapHands();
      this._swapBtnArmed = false;
    }
  }

  _handleSwitching(input) {
    const s = input.state[this.switchHand];
    if (!s) return;
    const x = s.thumbstick.x;
    const wantsCycle = Math.abs(x) >= 0.5 || s.bPressed;
    if (!wantsCycle) {
      this._stickArmed = true;
      this._cycleBtnArmed = true;
    } else if ((Math.abs(x) >= 0.5 && this._stickArmed) || (s.bPressed && this._cycleBtnArmed)) {
      // Cycling is always available (even while firing is locked, e.g.
      // during the pre-game weapon-select browse) so the player can try
      // weapons in-hand before committing. Both the stick flick and an
      // explicit button press work, since the stick alone wasn't reliably
      // discoverable in practice.
      this.cycleWeapon(x < 0 ? -1 : 1);
      this._stickArmed = false;
      this._cycleBtnArmed = false;
    }
    if (s.aPressed && this._reloadArmed !== false) {
      this.startReload();
      this._reloadArmed = false;
    } else if (!s.aPressed) {
      this._reloadArmed = true;
    }
  }

  // ---- live weapon-grip calibration -----------------------------------
  // Since the exact grip offset/orientation for each glb couldn't be
  // verified without a headset in the loop, this lets a player nudge the
  // held weapon into place in real time and read back the numbers to bake
  // into WeaponDefs.js. Hold both triggers ~0.6s to toggle it.

  _handleCalibrationToggle(dt, input) {
    const bothHeld = input.state.left.triggerDown && input.state.right.triggerDown;
    // Suppress firing while both triggers are held, whether or not the
    // 0.6s hold actually completes - otherwise every calibration-mode
    // entry (or accidental double-squeeze) sprays a burst first.
    this._suppressFire = bothHeld;
    if (bothHeld) {
      this._bothTriggersHeldT += dt;
      if (this._bothTriggersHeldT > 0.6 && this._calibrateArmed) {
        this.calibrating = !this.calibrating;
        this._calibrateArmed = false;
      }
    } else {
      this._bothTriggersHeldT = 0;
      this._calibrateArmed = true;
    }
  }

  _updateCalibration(dt, input) {
    if (!this.currentId) return;
    const grip = this._gripFor(this.currentId);
    const off = input.state[this.switchHand];
    const shoot = input.state[this.shootingHand];

    const moveSpeed = 0.25; // m/s at full stick deflection
    grip.pos[0] += off.thumbstick.x * moveSpeed * dt;
    grip.pos[2] -= off.thumbstick.y * moveSpeed * dt;
    grip.pos[1] -= shoot.thumbstick.y * moveSpeed * dt;

    const yawSpeed = 90; // deg/s
    grip.rotDeg[1] += shoot.thumbstick.x * yawSpeed * dt;

    const step = 15;
    if (off.aPressed || off.bPressed) {
      if (this._pitchBtnArmed) {
        grip.rotDeg[0] += off.aPressed ? -step : step;
        this._pitchBtnArmed = false;
      }
    } else {
      this._pitchBtnArmed = true;
    }
    if (shoot.aPressed || shoot.bPressed) {
      if (this._rollBtnArmed) {
        grip.rotDeg[2] += shoot.aPressed ? -step : step;
        this._rollBtnArmed = false;
      }
    } else {
      this._rollBtnArmed = true;
    }

    if (this.currentModel) {
      this.currentModel.position.set(...grip.pos);
      this.currentModel.rotation.set(
        THREE.MathUtils.degToRad(grip.rotDeg[0]),
        THREE.MathUtils.degToRad(grip.rotDeg[1]),
        THREE.MathUtils.degToRad(grip.rotDeg[2])
      );
    }
  }

  /** Human-readable calibration readout for the HUD panel. */
  calibrationReadout() {
    if (!this.currentId) return '';
    const g = this._gripFor(this.currentId);
    const r = (n) => Math.round(n * 1000) / 1000;
    const rd = (n) => Math.round(n);
    return `pos:[${r(g.pos[0])}, ${r(g.pos[1])}, ${r(g.pos[2])}] rot:[${rd(g.rotDeg[0])}, ${rd(g.rotDeg[1])}, ${rd(g.rotDeg[2])}]`;
  }

  _handleFiring(dt, input) {
    const s = input.state[this.shootingHand];
    if (!s) return;
    const def = weaponDef(this.currentId);
    const ammo = this.ammo.get(this.currentId) ?? 0;

    if (this._suppressFire) return;
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

    if (this.currentModel && this.currentId) {
      const grip = this._gripFor(this.currentId);
      this.currentModel.position.set(grip.pos[0] + this._recoilPos.x, grip.pos[1] + this._recoilPos.y, grip.pos[2] - this._recoilPos.z);
      this.currentModel.rotation.set(
        THREE.MathUtils.degToRad(grip.rotDeg[0]) - this._recoilRot,
        THREE.MathUtils.degToRad(grip.rotDeg[1]),
        THREE.MathUtils.degToRad(grip.rotDeg[2])
      );
    }
  }
}
