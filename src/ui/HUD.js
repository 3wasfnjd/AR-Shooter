import * as THREE from 'three';
import { loadTexture } from '../assets/AssetLoader.js';
import { UI } from '../assets/paths.js';
import { weaponDef } from '../weapons/WeaponDefs.js';
import { damp } from '../utils/math.js';

// Physically bigger than the canvas' pixel-font sizes were originally
// tuned for, on purpose: this is the cheapest legibility win (same text,
// stretched larger in real-world space) after feedback that the wrist
// panel was hard to read at arm's length in-headset.
const PANEL_W = 0.19;
const PANEL_H = 0.135;

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * All player-facing UI: a world-space reticle held out in front of the
 * active weapon (no screen-space overlay is available in a single-pass
 * immersive-ar session), a hit marker pop, a camera-attached damage
 * vignette, and a left-wrist status/weapon-select panel drawn on a canvas
 * texture.
 */
export class HUD {
  constructor({ xrApp, weaponSystem }) {
    this.xrApp = xrApp;
    this.weaponSystem = weaponSystem;
    this.mode = 'select'; // 'select' | 'formation' | 'hud' | 'gameover'
    this._formationReady = false;
    this._lastDraw = '';

    this._buildCrosshair();
    this._buildHitMarker();
    this._buildVignette();
    this._buildDirectionalIndicator();
    this._buildWristPanel();
  }

  async _buildCrosshair() {
    const tex = await loadTexture(UI.crosshair);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.9 });
    this.crosshair = new THREE.Sprite(mat);
    this.crosshair.scale.setScalar(0.02);
    this.crosshair.renderOrder = 999;
    this.xrApp.scene.add(this.crosshair);
  }

  async _buildHitMarker() {
    const tex = await loadTexture(UI.hitMarker);
    const mat = new THREE.SpriteMaterial({ map: tex, color: 0xff5544, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
    this.hitMarker = new THREE.Sprite(mat);
    this.hitMarker.scale.setScalar(0.03);
    this.hitMarker.renderOrder = 999;
    this.xrApp.scene.add(this.hitMarker);
    this._hitMarkerT = 1;
  }

  _buildVignette() {
    const canvas = makeCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
    grad.addColorStop(0, 'rgba(200,0,0,0)');
    grad.addColorStop(1, 'rgba(200,0,0,0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0, toneMapped: false });
    const geo = new THREE.PlaneGeometry(1, 1);
    this.vignette = new THREE.Mesh(geo, mat);
    this.vignette.renderOrder = 998;
    this.vignette.position.set(0, 0, -0.15);
    this.vignette.scale.set(0.3, 0.3, 1);
    this.xrApp.camera.add(this.vignette);
    this._vignetteT = 0;
  }

  /** A chevron that points toward wherever the player last took fire from. */
  _buildDirectionalIndicator() {
    const canvas = makeCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    ctx.translate(64, 64);
    ctx.fillStyle = '#ff4433';
    ctx.beginPath();
    ctx.moveTo(0, -56);
    ctx.lineTo(34, 10);
    ctx.lineTo(0, -10);
    ctx.lineTo(-34, 10);
    ctx.closePath();
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0, toneMapped: false });
    this.threatArrow = new THREE.Sprite(mat);
    this.threatArrow.scale.set(0.045, 0.045, 1);
    this.threatArrow.renderOrder = 998;
    this.threatArrow.position.set(0, 0, -0.16);
    this.xrApp.camera.add(this.threatArrow);
    this._threatT = 0;
    this._threatWorldPos = null;
  }

  _buildWristPanel() {
    this._canvas = makeCanvas(340, 240);
    this._ctx = this._canvas.getContext('2d');
    this._panelTex = new THREE.CanvasTexture(this._canvas);
    const mat = new THREE.MeshBasicMaterial({ map: this._panelTex, transparent: true, depthTest: true, toneMapped: false });
    const geo = new THREE.PlaneGeometry(PANEL_W, PANEL_H);
    this.panel = new THREE.Mesh(geo, mat);
    this.panel.position.set(0, 0.08, -0.03);
    this.panel.rotation.set(-Math.PI / 2.6, 0, 0);

    const anchor = new THREE.Object3D();
    this._panelAnchor = anchor;
    anchor.add(this.panel);
    this._attachedHand = null;
  }

  _ensurePanelAttached() {
    // Always the off-hand (weaponSystem.switchHand), which tracks live if
    // the player swaps which hand holds the weapon.
    const grip = this.xrApp.controllers[this.weaponSystem.switchHand]?.grip;
    if (grip && this._attachedHand !== grip) {
      grip.add(this._panelAnchor);
      this._attachedHand = grip;
    }
  }

  // ---- state pushes from Game ----------------------------------------

  showWeaponSelect() {
    this.mode = 'select';
  }

  showFormation() {
    this.mode = 'formation';
    this._formationReady = false;
  }

  showFormationReady() {
    this._formationReady = true;
  }

  showHUD() {
    this.mode = 'hud';
  }

  showGameOver({ score, wave }) {
    this.mode = 'gameover';
    this._gameOverData = { score, wave };
  }

  registerHit(killed, zone) {
    this._hitMarkerT = 0;
    this._hitMarkerKilled = killed;
    this._hitMarkerZone = zone;
  }

  /** `sourcePos` (world-space, optional): where the shot that hit us came from, to point the threat arrow. */
  flashDirectionalHit(sourcePos) {
    this._vignetteT = 1;
    if (sourcePos) {
      this._threatWorldPos = sourcePos.clone();
      this._threatT = 1;
    }
  }

  // ---- per-frame ------------------------------------------------------

  update(dt, gameData) {
    this._ensurePanelAttached();
    this._updateCrosshair();
    this._updateHitMarker(dt);
    this._updateVignette(dt);
    this._updateThreatArrow(dt);
    this._updatePanel(gameData);
  }

  _updateThreatArrow(dt) {
    if (!this.threatArrow) return;
    this._threatT = Math.max(0, this._threatT - dt / 1.4);
    if (this._threatT <= 0 || !this._threatWorldPos) {
      this.threatArrow.material.opacity = 0;
      return;
    }
    // Threat position expressed in camera-local space: -Z is forward, +X
    // is right. atan2(x, -z) gives the horizontal angle off forward, with
    // +-PI meaning directly behind - used both to place the arrow around
    // the view edge and to rotate it (2D sprite rotation) to point outward
    // toward that bearing.
    const local = this.xrApp.camera.worldToLocal(this._threatWorldPos.clone());
    const angle = Math.atan2(local.x, -local.z);
    const radius = 0.06;
    this.threatArrow.position.set(Math.sin(angle) * radius, Math.cos(angle) * radius * 0.6, -0.16);
    this.threatArrow.material.rotation = -angle;
    this.threatArrow.material.opacity = Math.min(1, this._threatT * 2);
  }

  _updateCrosshair() {
    if (!this.crosshair) return;
    const grip = this.xrApp.controllers[this.weaponSystem.shootingHand]?.grip;
    if (!grip) {
      this.crosshair.visible = false;
      if (this.hitMarker) this.hitMarker.visible = false;
      return;
    }
    const entry = this.weaponSystem.models.get(this.weaponSystem.currentId);
    const muzzle = entry?.muzzle;
    if (!muzzle) return;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    muzzle.getWorldPosition(pos);
    muzzle.getWorldQuaternion(quat);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    pos.addScaledVector(fwd, 1.1);
    this.crosshair.visible = true;
    this.crosshair.position.copy(pos);
    if (this.hitMarker) this.hitMarker.position.copy(pos);
  }

  _updateHitMarker(dt) {
    if (!this.hitMarker) return;
    this._hitMarkerT = Math.min(1, this._hitMarkerT + dt / 0.35);
    const visible = this._hitMarkerT < 1;
    this.hitMarker.visible = visible;
    if (visible) {
      this.hitMarker.material.opacity = 1 - this._hitMarkerT;
      this.hitMarker.material.color.set(this._hitMarkerKilled ? 0xffcf3a : 0xff5544);
      this.hitMarker.scale.setScalar(0.028 + this._hitMarkerT * 0.02);
    }
  }

  _updateVignette(dt) {
    this._vignetteT = damp(this._vignetteT, 0, 3.2, dt);
    this.vignette.material.opacity = Math.min(0.55, this._vignetteT);
  }

  _updatePanel(gameData) {
    if (this.weaponSystem.calibrating) {
      // Numbers change every frame while nudging, so skip the dirty-check.
      this._redrawPanel(gameData);
      return;
    }
    let text;
    if (this.mode === 'select') {
      const def = weaponDef(this.weaponSystem.currentId);
      text = `SELECT:${def?.id}`;
    } else if (this.mode === 'formation') {
      text = `FORMATION:${this._formationReady}`;
    } else if (this.mode === 'gameover') {
      text = `OVER:${this._gameOverData?.score}:${this._gameOverData?.wave}`;
    } else {
      text = `HUD:${gameData?.wave}:${gameData?.score}:${Math.ceil(gameData?.health ?? 0)}:${this.weaponSystem.state.ammo}:${this.weaponSystem.state.magSize}:${this.weaponSystem.state.reloading}:${this.weaponSystem.currentId}`;
    }
    if (text === this._lastDraw) return;
    this._lastDraw = text;
    this._redrawPanel(gameData);
  }

  _redrawPanel(gameData) {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8,12,16,0.78)';
    roundRect(ctx, 4, 4, w - 8, h - 8, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,157,46,0.85)';
    ctx.lineWidth = 4;
    roundRect(ctx, 4, 4, w - 8, h - 8, 18);
    ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffb347';

    if (this.weaponSystem.calibrating) {
      const def = weaponDef(this.weaponSystem.currentId);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('CALIBRATING', 20, 14);
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = '#eef6ff';
      ctx.fillText(def?.name || '', 20, 46);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#9fb4c4';
      ctx.fillText(`hand: ${this.weaponSystem.shootingHand}`, 20, 78);
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = '#5be07a';
      const [line1, line2] = this.weaponSystem.calibrationReadout().split(' rot:');
      ctx.fillText(line1, 20, 100);
      ctx.fillText(`rot:${line2 || ''}`, 20, 118);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#9fb4c4';
      ctx.fillText('off-hand stick: move X/Z', 20, 148);
      ctx.fillText('gun-hand stick: yaw / up-down', 20, 168);
      ctx.fillText('A/B each hand: pitch / roll', 20, 188);
      ctx.fillText('hold both triggers: exit', 20, 208);
    } else if (this.mode === 'select') {
      const def = weaponDef(this.weaponSystem.currentId);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('SELECT WEAPON', 20, 18);
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#eef6ff';
      ctx.fillText(def?.name || '', 20, 60);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#9fb4c4';
      ctx.fillText('Stick or B: browse', 20, 130);
      ctx.fillText('Right trigger: confirm', 20, 156);
      ctx.fillText('Stick-click: swap hands', 20, 182);
    } else if (this.mode === 'formation') {
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('SQUAD FORMED', 20, 18);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#eef6ff';
      ctx.fillText('20 hostiles, lined up', 20, 56);
      ctx.font = '17px sans-serif';
      ctx.fillStyle = '#9fb4c4';
      ctx.fillText('15 Soldiers + 5 Elites', 20, 84);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = this._formationReady ? '#5be07a' : '#ffb347';
      ctx.fillText(this._formationReady ? 'READY' : 'FORMING…', 20, 130);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#9fb4c4';
      ctx.fillText('Right trigger: BEGIN ASSAULT', 20, 168);
    } else if (this.mode === 'gameover') {
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('MISSION FAILED', 20, 18);
      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#eef6ff';
      ctx.fillText(`SCORE ${this._gameOverData?.score ?? 0}`, 20, 70);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#9fb4c4';
      ctx.fillText(`Reached wave ${this._gameOverData?.wave ?? 1}`, 20, 130);
      ctx.fillText('Right trigger: restart', 20, 165);
    } else {
      const def = weaponDef(this.weaponSystem.currentId);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`WAVE ${gameData?.wave ?? 1}`, 20, 14);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#eef6ff';
      ctx.fillText(`SCORE ${gameData?.score ?? 0}`, 150, 16);

      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#ffd88a';
      const ammoTxt = this.weaponSystem.state.reloading ? 'RELOAD…' : `${this.weaponSystem.state.ammo}/${this.weaponSystem.state.magSize}`;
      ctx.fillText(`${def?.name || ''}`, 20, 54);
      ctx.fillText(ammoTxt, 20, 90);

      // health bar
      const hp = Math.max(0, (gameData?.health ?? 100) / (gameData?.maxHealth ?? 100));
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, 20, 140, w - 40, 22, 10);
      ctx.fill();
      ctx.fillStyle = hp > 0.4 ? '#5be07a' : '#ff5544';
      roundRect(ctx, 20, 140, (w - 40) * hp, 22, 10);
      ctx.fill();
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#9fb4c4';
      ctx.fillText('HEALTH', 20, 172);
      ctx.fillText('Stick/B: switch | A: reload', 20, 198);
      ctx.fillText('Stick-click: swap hands', 20, 218);
    }

    this._panelTex.needsUpdate = true;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
