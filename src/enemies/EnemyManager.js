import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { SOLDIER_TYPES } from './SoldierTypes.js';
import { randRange } from '../utils/math.js';

const COVER_POINT_COUNT = 7;
const COVER_RADIUS_RANGE = [0.8, 1.6];

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

    // Kept tight on purpose: at 35-45cm tall, soldiers standing 2m+ away
    // read as barely-visible specks in passthrough. Closer engagement
    // range keeps them a readable, threatening size.
    this.engagementMin = 0.6;
    this.engagementMax = 1.3;

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
