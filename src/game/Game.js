import * as THREE from 'three';
import { XRApp } from '../core/XRApp.js';
import { InputManager } from '../core/InputManager.js';
import { AudioManager } from '../audio/AudioManager.js';
import { EffectsSystem } from '../vfx/EffectsSystem.js';
import { PortalEffect } from '../vfx/PortalEffect.js';
import { WeaponSystem } from '../weapons/WeaponSystem.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { HUD } from '../ui/HUD.js';
import { preload } from '../assets/AssetLoader.js';
import { WEAPON_MODELS, CHARACTERS, AUDIO, VFX, UI } from '../assets/paths.js';
import { WEAPON_ORDER } from '../weapons/WeaponDefs.js';
import { randRange, clamp } from '../utils/math.js';

const MAX_ALIVE = 7;
const SPAWN_STAGGER = [0.9, 1.6]; // seconds between individual portal breaches

export class Game {
  constructor(container) {
    this.container = container;
    this.xrApp = new XRApp({ container });
    this.input = new InputManager(this.xrApp);
    this.audio = new AudioManager(this.xrApp);
    this.effects = new EffectsSystem(this.xrApp.scene);
    this.portal = new PortalEffect(this.xrApp.scene, this.audio);
    this.weapons = new WeaponSystem({ xrApp: this.xrApp, effects: this.effects, audio: this.audio });
    this.enemies = new EnemyManager({ scene: this.xrApp.scene, effects: this.effects, audio: this.audio, portalEffect: this.portal, hud: null });
    this.hud = new HUD({ xrApp: this.xrApp, weaponSystem: this.weapons });
    this.enemies.hud = this.hud;

    this.mode = 'intro'; // intro | weaponSelect | playing | gameOver
    this.wave = 1;
    this.score = 0;
    this.health = 100;
    this.maxHealth = 100;

    this._spawnQueue = [];
    this._spawnTimer = 0;
    this._recentered = false;

    this.weapons.onHitTest = (o, d, m) => this.enemies.hitTest(o, d, m);
    this.weapons.onEnemyHit = (result, dmg, dir) => this.enemies.applyPlayerDamage(result, dmg, dir);
    this.enemies.onPlayerDamaged = (dmg) => this._onPlayerDamaged(dmg);
    this.enemies.onSoldierKilled = (soldier, zone) => this._onSoldierKilled(soldier, zone);

    this.xrApp.onUpdate((dt) => this._update(dt));
  }

  async preloadAssets() {
    await Promise.all([
      this.weapons.preloadAll(),
      preload({
        gltfs: [CHARACTERS.soldier, CHARACTERS.elite, WEAPON_MODELS.enemyRifle],
        textures: [VFX.muzzleFlash, VFX.smoke, VFX.tracer, VFX.bulletImpact, UI.crosshair, UI.hitMarker],
        audio: [
          AUDIO.weapons.pistol,
          AUDIO.weapons.smg,
          AUDIO.weapons.rifle,
          AUDIO.weapons.shotgun,
          AUDIO.weapons.sniper,
          AUDIO.weapons.emptyClick,
          AUDIO.weapons.reloadPistol,
          AUDIO.weapons.reloadRifle,
          AUDIO.weapons.shotgunPump,
          AUDIO.enemy.hit,
          AUDIO.enemy.death,
          AUDIO.ui.hitConfirm,
          ...AUDIO.footsteps
        ]
      })
    ]);
    this.weapons.equip(WEAPON_ORDER[0]);
  }

  async start(overlayRoot) {
    await this.xrApp.enterAR(overlayRoot);
    this.mode = 'weaponSelect';
    this.hud.showWeaponSelect();
  }

  // ---- per-frame --------------------------------------------------

  _update(dt) {
    this.input.update();
    // Controller local transforms are refreshed by WebXRManager before this
    // callback runs, but matrixWorld propagation normally only happens
    // inside renderer.render() (after this callback). Force it now so
    // muzzle/hurtbox world positions read further down are this frame's,
    // not last frame's.
    this.xrApp.scene.updateMatrixWorld(true);
    const playerPos = new THREE.Vector3();
    this.xrApp.camera.getWorldPosition(playerPos);

    this.effects.update(dt);
    this.weapons.update(dt, this.input);
    this.hud.update(dt, { wave: this.wave, score: this.score, health: this.health, maxHealth: this.maxHealth });

    if (this.mode === 'weaponSelect') {
      this._updateWeaponSelect();
    } else if (this.mode === 'playing') {
      this.enemies.update(dt, playerPos);
      this._updateSpawning(dt, playerPos);
      this._checkWaveClear();
    } else if (this.mode === 'gameOver') {
      this.enemies.update(dt, playerPos);
      this._updateGameOverInput();
    }
  }

  _updateWeaponSelect() {
    const s = this.input.state.right;
    if (s.triggerPressed) {
      this.weapons.unlock();
      this.mode = 'playing';
      this.hud.showHUD();
      this.audio.startAmbience(0.3);
      const playerPos = new THREE.Vector3();
      this.xrApp.camera.getWorldPosition(playerPos);
      if (!this._recentered) {
        this.enemies.recenter(playerPos);
        this._recentered = true;
      }
      this._startWave(playerPos);
    }
  }

  _updateGameOverInput() {
    const s = this.input.state.right;
    if (s.triggerPressed) {
      this._restart();
    }
  }

  _restart() {
    this.enemies.clearAll();
    this.wave = 1;
    this.score = 0;
    this.health = this.maxHealth;
    this._spawnQueue = [];
    this.weapons.lock();
    this.weapons.equip(WEAPON_ORDER[0]);
    this.mode = 'weaponSelect';
    this.hud.showWeaponSelect();
  }

  // ---- waves --------------------------------------------------------

  _startWave(playerPos) {
    const composition = this._waveComposition(this.wave);
    const sectors = this._distributeSectors(composition.length, this.wave === 1);
    this._spawnQueue = composition.map((typeId, i) => ({ typeId, sector: sectors[i] }));
    this._spawnTimer = 0;
    this._waveActive = true;
  }

  _waveComposition(n) {
    const regularCount = Math.min(3 + Math.floor(n * 0.75), 8);
    const eliteCount = n >= 3 ? Math.min(Math.floor((n - 1) / 2), 3) : 0;
    const list = [];
    for (let i = 0; i < regularCount; i++) list.push('regular');
    for (let i = 0; i < eliteCount; i++) list.push('elite');
    return list;
  }

  /**
   * `biasForward`: wave 1 only. Spawns land in a ~110 deg arc in front of
   * wherever the player is currently looking instead of the full circle,
   * so the very first encounter can't spawn behind them unseen - later
   * waves go full 360 deg for real multi-directional attacks once the
   * player knows to expect that.
   */
  _distributeSectors(count, biasForward = false) {
    const sectors = [];
    if (biasForward) {
      const dir = new THREE.Vector3();
      this.xrApp.camera.getWorldDirection(dir);
      const facingYaw = Math.atan2(dir.x, dir.z);
      const arc = THREE.MathUtils.degToRad(110);
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5;
        sectors.push(facingYaw + (t - 0.5) * arc + randRange(-0.08, 0.08));
      }
      return sectors;
    }
    const base = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      sectors.push(base + (i / count) * Math.PI * 2 + randRange(-0.25, 0.25));
    }
    return sectors;
  }

  _updateSpawning(dt, playerPos) {
    if (!this._spawnQueue.length) return;
    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;
    if (this.enemies.aliveCount >= MAX_ALIVE) return;

    const next = this._spawnQueue.shift();
    this.enemies.spawnAt(next.typeId, playerPos, next.sector).catch((err) => console.error('[Game] spawn failed', err));
    this._spawnTimer = randRange(...SPAWN_STAGGER);
  }

  _checkWaveClear() {
    if (!this._waveActive) return;
    if (this._spawnQueue.length > 0) return;
    if (this.enemies.aliveCount > 0) return;
    this._waveActive = false;
    this.score += 50 * this.wave;
    this.health = clamp(this.health + 15, 0, this.maxHealth);
    this.wave += 1;
    setTimeout(() => {
      if (this.mode !== 'playing') return;
      const playerPos = new THREE.Vector3();
      this.xrApp.camera.getWorldPosition(playerPos);
      this._startWave(playerPos);
    }, 2400);
  }

  // ---- combat callbacks ----------------------------------------------

  _onPlayerDamaged(amount) {
    this.health = clamp(this.health - amount, 0, this.maxHealth);
    this.hud.flashDirectionalHit();
    this.xrApp.pulse('left', 0.4, 60);
    this.xrApp.pulse('right', 0.4, 60);
    if (this.health <= 0 && this.mode === 'playing') {
      this._gameOver();
    }
  }

  _onSoldierKilled(soldier, zone) {
    const base = soldier.type.id === 'elite' ? 250 : 100;
    const bonus = zone === 'head' ? 50 : 0;
    this.score += base + bonus;
    this.audio.playUI(AUDIO.ui.hitConfirm, 0.5);
  }

  _gameOver() {
    this.mode = 'gameOver';
    this.weapons.lock();
    this.hud.showGameOver({ score: this.score, wave: this.wave });
  }
}
