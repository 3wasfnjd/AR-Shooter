import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { SOLDIER_TYPES } from './SoldierTypes.js';
import { randRange } from '../utils/math.js';

const COVER_POINT_COUNT = 7;
const COVER_RADIUS_RANGE = [1.4, 2.6];

/**
 * Owns the live soldier roster: spawning (via PortalEffect), per-frame AI
 * ticking, the hitscan hurtbox query WeaponSystem calls into, and damage
 * resolution (both directions - player shooting enemies, enemies shooting
 * the player).
 */
export class EnemyManager {
  constructor({ scene, effects, audio, portalEffect, hud }) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.portalEffect = portalEffect;
    this.hud = hud;

    this.soldiers = [];
    this.coverPoints = this._makeCoverPoints();

    // This went too tight in an earlier pass on the (wrong) assumption
    // that "closer = more visible". Using the desktop preview to actually
    // look at it: a standing eye height (~1.6m) versus a ~0.5m floor-level
    // target means the downward look angle needed is atan((1.6-0.3)/d) -
    // at 0.5-1.0m that's 50-70 degrees below horizontal, well outside a
    // natural forward gaze. Backing the range back out reduces that angle
    // to something closer to a natural "glance down" (~25-35deg at
    // 1.9-2.8m) while the earlier size bump + forward-biased wave 1 +
    // threat arrow + contact ping carry the rest of the readability fix.
    this.engagementMin = 1.5;
    this.engagementMax = 2.4;

    this.onPlayerDamaged = null; // (amount) => void
    this.onSoldierKilled = null; // (soldier) => void
  }

  _makeCoverPoints() {
    const points = [];
    for (let i = 0; i < COVER_POINT_COUNT; i++) {
      const angle = (i / COVER_POINT_COUNT) * Math.PI * 2 + randRange(-0.2, 0.2);
      const radius = randRange(...COVER_RADIUS_RANGE);
      points.push({
        position: new THREE.Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius),
        claimed: false
      });
    }
    return points;
  }

  /** Re-centers the room-anchored cover ring and spawn sectors on the player's current spot. */
  recenter(playerPos) {
    for (const c of this.coverPoints) {
      const angle = Math.atan2(c.position.x, c.position.z);
      const radius = Math.hypot(c.position.x, c.position.z);
      c.position.set(playerPos.x + Math.sin(angle) * radius, 0, playerPos.z + Math.cos(angle) * radius);
    }
  }

  get aliveCount() {
    return this.soldiers.filter((s) => s.alive).length;
  }

  /**
   * Pre-battle lineup: materializes `composition.length` soldiers standing
   * in neat rows in front of wherever the player is currently facing
   * (`facingYaw`), all facing back toward the player, holding an idle pose
   * until beginAssault() releases them. No portal breach per-soldier (20 of
   * those flashing at once would be visual noise) - they just fade/scale in
   * together the same way a single breach-spawned soldier does.
   */
  async spawnFormation(playerPos, facingYaw, composition) {
    const cols = 5;
    const colSpacing = 0.34;
    const rowSpacing = 0.36;
    const frontDistance = 1.7;
    const startX = -((Math.min(cols, composition.length) - 1) * colSpacing) / 2;

    const loads = composition.map((typeId, i) => {
      const type = SOLDIER_TYPES[typeId];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const localX = startX + col * colSpacing;
      const localZ = frontDistance + row * rowSpacing;

      // Rotate the local (right, forward) grid offset by facingYaw so the
      // block forms in front of wherever the player happened to be looking
      // when they confirmed their weapon, not always along world +Z.
      const worldX = playerPos.x + Math.sin(facingYaw) * localZ + Math.cos(facingYaw) * localX;
      const worldZ = playerPos.z + Math.cos(facingYaw) * localZ - Math.sin(facingYaw) * localX;
      const spawnPos = new THREE.Vector3(worldX, 0, worldZ);

      // Same (sin, cos) convention as spawnAt's sector, so this soldier's
      // later engagement approach (_pickApproachTarget) radiates outward
      // from roughly where it was already standing instead of snapping to
      // some unrelated angle the moment the assault begins.
      const sector = Math.atan2(worldX - playerPos.x, worldZ - playerPos.z);
      const facingTowardPlayer = sector + Math.PI;

      const soldier = new Soldier({ scene: this.scene, effects: this.effects, audio: this.audio, type, sector });
      soldier.yaw = facingTowardPlayer;
      soldier.facingPivot.rotation.y = facingTowardPlayer;
      this.soldiers.push(soldier);
      return soldier.load(spawnPos, { formation: true });
    });

    await Promise.all(loads);
  }

  /** Releases every soldier currently holding formation into combat, each after its own small random delay so the line breaks apart organically instead of every soldier stepping off in lockstep. */
  beginAssault() {
    for (const s of this.soldiers) {
      if (s.state === 'formation') {
        s.beginAssault(randRange(0, 1.6));
      }
    }
  }

  /** Spawns one soldier of `typeId` via a portal breach at the given world-floor `sector` angle around the player. */
  async spawnAt(typeId, playerPos, sector, radiusScale = 1) {
    const type = SOLDIER_TYPES[typeId];
    const radius = randRange(this.engagementMax * 1.15, this.engagementMax * 1.55) * radiusScale;
    const spawnPos = new THREE.Vector3(playerPos.x + Math.sin(sector) * radius, 0, playerPos.z + Math.cos(sector) * radius);

    // Same angle used for the spawn position itself, so the soldier's
    // assigned engagement sector keeps it roughly on the side of the player
    // it breached from, instead of immediately crossing to the opposite side.
    const soldier = new Soldier({ scene: this.scene, effects: this.effects, audio: this.audio, type, sector });
    this.soldiers.push(soldier);

    const portalPromise = this.portalEffect.spawn(spawnPos);
    const loadPromise = soldier.load(spawnPos);
    await Promise.all([portalPromise, loadPromise]);
    return soldier;
  }

  update(dt, playerPos) {
    this.portalEffect.update(dt);

    const ctx = {
      playerPos,
      engagementMin: this.engagementMin,
      engagementMax: this.engagementMax,
      coverPoints: this.coverPoints,
      onEnemyFire: (soldier, damage) => this._onEnemyFire(soldier, damage)
    };

    for (let i = this.soldiers.length - 1; i >= 0; i--) {
      const s = this.soldiers[i];
      s.update(dt, ctx);
      if (s.canDespawn) {
        s.dispose();
        this.soldiers.splice(i, 1);
      }
    }
  }

  _onEnemyFire(soldier, damage) {
    if (damage > 0) {
      this.onPlayerDamaged?.(damage);
    }
    this.hud?.flashDirectionalHit?.(soldier.position);
  }

  /** WeaponSystem.onHitTest hook: closest hurtbox intersection across all live soldiers. */
  hitTest(origin, dir, maxDist) {
    let best = null;
    let bestSoldier = null;
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const result = s.testRay(origin, dir, maxDist);
      if (result && (!best || result.dist < best.dist)) {
        best = result;
        bestSoldier = s;
      }
    }
    if (!best) return null;
    return { point: best.point, normal: best.normal, zone: best.zone, enemy: bestSoldier };
  }

  /** WeaponSystem.onEnemyHit hook. `shotDir` is the fired bullet's travel direction. */
  applyPlayerDamage(result, damage, shotDir) {
    const soldier = result.enemy;
    if (!soldier) return;
    const killed = soldier.takeDamage(damage, result.point, result.zone, shotDir);
    if (killed) {
      this.onSoldierKilled?.(soldier, result.zone);
    }
    this.hud?.registerHit?.(killed, result.zone);
  }

  clearAll() {
    for (const s of this.soldiers) s.dispose();
    this.soldiers = [];
    for (const c of this.coverPoints) c.claimed = false;
  }
}
