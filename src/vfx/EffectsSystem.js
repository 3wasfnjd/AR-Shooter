import * as THREE from 'three';
import { loadTexture } from '../assets/AssetLoader.js';
import { VFX } from '../assets/paths.js';
import { ObjectPool } from '../utils/ObjectPool.js';
import { randRange } from '../utils/math.js';

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _back = new THREE.Vector3();
const MAX_MUZZLE_LIGHTS = 3;

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
    this.shellPool = new ObjectPool(() => this._makeShell(), (s) => this._hide(s), 24);
    // Real-time PointLights are expensive on mobile GPUs (same tradeoff as
    // PortalEffect.js's breach lights): cap concurrent muzzle flashes that
    // get a light, sustained automatic fire just skips the light on the
    // sprite-only overflow rather than tanking frame rate.
    this.lightPool = new ObjectPool(
      () => {
        const light = new THREE.PointLight(0xffb877, 0, 0.9, 2);
        this.scene.add(light);
        return light;
      },
      (l) => {
        l.intensity = 0;
      },
      MAX_MUZZLE_LIGHTS
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

  _makeShell() {
    // Brass casing: a short hexagonal cylinder reads fine at the couple-cm
    // size it's actually seen at, and is far cheaper than a real mesh.
    const geo = new THREE.CylinderGeometry(0.0032, 0.0032, 0.013, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd8a53d,
      metalness: 0.75,
      roughness: 0.35,
      transparent: true,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.renderOrder = 6;
    this.scene.add(mesh);
    return mesh;
  }

  _hide(obj) {
    obj.visible = false;
  }

  _track(pool, obj, life, onUpdate) {
    this.active.push({ pool, obj, life, age: 0, onUpdate });
  }

  /** Bright flash at the muzzle, plus a brief real-time light pulse (capped, see MAX_MUZZLE_LIGHTS) for actual scene illumination instead of just an additive sprite. */
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

    if (this.lightPool && this.lightPool.active.size < MAX_MUZZLE_LIGHTS) {
      const light = this.lightPool.acquire();
      light.position.copy(position);
      light.intensity = 6 * (size / 0.06);
      const lightLife = life * 2.4;
      this._track(this.lightPool, light, lightLife, (t) => {
        light.intensity = 6 * (size / 0.06) * (1 - t) * (1 - t);
      });
    }
  }

  /** Ejects a brass casing sideways from the weapon's ejection port with a bit of tumble and gravity. `side` flips it for a left-handed grip. */
  shellEject(position, quaternion, { side = 1 } = {}) {
    if (!this.shellPool) return;
    const shell = this.shellPool.acquire();
    shell.visible = true;
    shell.position.copy(position);
    shell.quaternion.copy(quaternion);
    shell.rotation.z += Math.PI / 2; // cylinder axis -> weapon's local X (ejects sideways, not forward)
    shell.material.opacity = 1;

    _right.set(1, 0, 0).applyQuaternion(quaternion).multiplyScalar(side);
    _dir.set(0, 1, 0).applyQuaternion(quaternion);
    _back.set(0, 0, 1).applyQuaternion(quaternion); // +Z is "back" since the muzzle convention is -Z forward

    const vel = _right
      .clone()
      .multiplyScalar(0.75 + Math.random() * 0.5)
      .addScaledVector(_dir, 0.55 + Math.random() * 0.3)
      .addScaledVector(_back, 0.15 + Math.random() * 0.2);
    const spin = new THREE.Vector3(randRange(-25, 25), randRange(-25, 25), randRange(-25, 25));
    const life = 0.5 + Math.random() * 0.2;

    this._track(this.shellPool, shell, life, (t, dt = 0.016) => {
      vel.y -= 2.4 * dt; // gravity, tuned for a ~40cm-scale room rather than real-world 1x
      shell.position.addScaledVector(vel, dt);
      shell.rotateX(spin.x * dt);
      shell.rotateY(spin.y * dt);
      shell.rotateZ(spin.z * dt);
      if (t > 0.65) shell.material.opacity = 1 - (t - 0.65) / 0.35;
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
      entry.onUpdate?.(t, dt);
      if (t >= 1) {
        entry.pool.release(entry.obj);
        this.active.splice(i, 1);
      }
    }
  }
}
