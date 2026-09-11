import * as THREE from 'three';
import { loadTexture } from '../assets/AssetLoader.js';
import { VFX } from '../assets/paths.js';
import { ObjectPool } from '../utils/ObjectPool.js';

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

/**
 * Pools every recurring visual (muzzle flash, smoke puff, tracer streak,
 * impact burst + sparks) so waves of enemies + sustained player fire never
 * allocate geometry at runtime. All effects self-expire via an internal
 * "alive" timer ticked from the main update loop.
 */
export class EffectsSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this._ready = this._init();
  }

  async _init() {
    const [flashTex, smokeTex, tracerTex, impactTex] = await Promise.all([
      loadTexture(VFX.muzzleFlash),
      loadTexture(VFX.smoke),
      loadTexture(VFX.tracer),
      loadTexture(VFX.bulletImpact)
    ]);
    this.textures = { flash: flashTex, smoke: smokeTex, tracer: tracerTex, impact: impactTex };

    this.flashPool = new ObjectPool(
      () => this._makeSprite(this.textures.flash, 0xffffff),
      (s) => this._hide(s),
      16
    );
    this.smokePool = new ObjectPool(
      () => this._makeSprite(this.textures.smoke, 0xffffff),
      (s) => this._hide(s),
      32
    );
    this.impactPool = new ObjectPool(
      () => this._makeSprite(this.textures.impact, 0xffffff),
      (s) => this._hide(s),
      16
    );
    this.sparkPool = new ObjectPool(() => this._makeSpark(), (s) => this._hide(s), 32);
    this.tracerPool = new ObjectPool(
      () => this._makeTracer(),
      (m) => this._hide(m),
      16
    );
  }

  _makeSprite(map, color) {
    const mat = new THREE.SpriteMaterial({
      map,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.renderOrder = 10;
    this.scene.add(sprite);
    return sprite;
  }

  _makeSpark() {
    const mat = new THREE.SpriteMaterial({
      color: 0xffcf7a,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.renderOrder = 10;
    this.scene.add(sprite);
    return sprite;
  }

  _makeTracer() {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0.5, 0, 0); // pivot at the tail so scale.x stretches toward the tip
    const mat = new THREE.MeshBasicMaterial({
      map: this.textures.tracer,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.renderOrder = 9;
    this.scene.add(mesh);
    return mesh;
  }

  _hide(obj) {
    obj.visible = false;
  }

  _track(pool, obj, life, onUpdate) {
    this.active.push({ pool, obj, life, age: 0, onUpdate });
  }

  /** Bright flash at the muzzle. `size` and `life` let each weapon feel different. */
  muzzleFlash(position, quaternion, { size = 0.06, life = 0.05, color = 0xffffff } = {}) {
    if (!this.flashPool) return;
    const sprite = this.flashPool.acquire();
    sprite.visible = true;
    sprite.position.copy(position);
    sprite.quaternion.copy(quaternion);
    sprite.material.color.set(color);
    sprite.material.rotation = Math.random() * Math.PI;
    sprite.scale.set(size, size, size);
    sprite.material.opacity = 1;
    this._track(this.flashPool, sprite, life, (t) => {
      const k = 1 - t;
      sprite.material.opacity = k;
      sprite.scale.setScalar(size * (1 + t * 1.6));
    });
  }

  /** Drifting smoke puff; heavier/denser for automatic weapons under sustained fire. */
  smokePuff(position, { size = 0.05, life = 1.1, drift = null, density = 0.5 } = {}) {
    if (!this.smokePool) return;
    const sprite = this.smokePool.acquire();
    sprite.visible = true;
    sprite.position.copy(position);
    sprite.material.rotation = Math.random() * Math.PI;
    sprite.material.opacity = density;
    sprite.scale.setScalar(size);
    const driftVec = drift || new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.15);
    this._track(this.smokePool, sprite, life, (t) => {
      sprite.position.addScaledVector(driftVec, 0.016);
      sprite.scale.setScalar(size * (1 + t * 2.2));
      sprite.material.opacity = density * (1 - t);
    });
  }

  /** Impact burst + a few directional sparks at a hit point. */
  impact(position, normal = _up, { size = 0.05, sparks = 5, color = 0xffffff } = {}) {
    if (!this.impactPool) return;
    const sprite = this.impactPool.acquire();
    sprite.visible = true;
    sprite.position.copy(position).addScaledVector(normal, 0.002);
    sprite.material.color.set(color);
    sprite.material.rotation = Math.random() * Math.PI;
    sprite.scale.setScalar(size);
    sprite.material.opacity = 1;
    this._track(this.impactPool, sprite, 0.22, (t) => {
      sprite.material.opacity = 1 - t;
      sprite.scale.setScalar(size * (1 + t * 1.2));
    });

    for (let i = 0; i < sparks; i++) {
      const spark = this.sparkPool.acquire();
      spark.visible = true;
      spark.position.copy(position);
      spark.scale.setScalar(0.006 + Math.random() * 0.008);
      spark.material.opacity = 1;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.4,
        Math.random() * 1.2,
        (Math.random() - 0.5) * 1.4
      ).addScaledVector(normal, 0.8 + Math.random() * 0.6);
      const life = 0.18 + Math.random() * 0.12;
      this._track(this.sparkPool, spark, life, (t) => {
        spark.position.addScaledVector(vel, 0.016);
        vel.y -= 0.06;
        spark.material.opacity = 1 - t;
      });
    }
  }

  /** A short glowing streak from `from` to `to` that fades quickly (hitscan tracer). */
  tracer(from, to, { width = 0.01, life = 0.06, color = 0xfff2c0 } = {}) {
    if (!this.tracerPool) return;
    const mesh = this.tracerPool.acquire();
    const dist = from.distanceTo(to);
    if (dist < 1e-4) return;
    _dir.copy(to).sub(from).normalize();
    _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), _dir);
    mesh.position.copy(from);
    mesh.quaternion.copy(_q);
    mesh.scale.set(dist, width, 1);
    mesh.material.color.set(color);
    mesh.material.opacity = 1;
    mesh.visible = true;
    this._track(this.tracerPool, mesh, life, (t) => {
      mesh.material.opacity = 1 - t;
    });
  }

  update(dt) {
    if (!this.active.length) return;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      entry.age += dt;
      const t = Math.min(1, entry.age / entry.life);
      entry.onUpdate?.(t);
      if (t >= 1) {
        entry.pool.release(entry.obj);
        this.active.splice(i, 1);
      }
    }
  }
}
