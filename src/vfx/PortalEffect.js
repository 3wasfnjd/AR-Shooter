import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool.js';

const MAX_CONCURRENT_LIGHTS = 3;

function makeRingTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, size * 0.28, cx, cy, size * 0.5);
  grad.addColorStop(0, 'rgba(255,150,40,0)');
  grad.addColorStop(0.72, 'rgba(255,150,40,0)');
  grad.addColorStop(0.82, 'rgba(255,190,90,0.95)');
  grad.addColorStop(0.9, 'rgba(120,210,255,0.9)');
  grad.addColorStop(1, 'rgba(120,210,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDiscTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(180,230,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,170,60,0.5)');
  grad.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A small tactical-breach / energy-distortion effect that flashes open on
 * the floor before a soldier rises out of it. Kept cheap for mobile XR:
 * additive ring + disc sprites, no particle systems, and real-time
 * PointLights are capped and reused rather than created per spawn.
 */
export class PortalEffect {
  constructor(scene, audioManager) {
    this.scene = scene;
    this.audioManager = audioManager;
    this.ringTex = makeRingTexture();
    this.discTex = makeDiscTexture();

    this.ringPool = new ObjectPool(() => this._makeRing(), (m) => (m.visible = false), 6);
    this.discPool = new ObjectPool(() => this._makeDisc(), (m) => (m.visible = false), 6);
    this.lightPool = new ObjectPool(
      () => {
        const light = new THREE.PointLight(0xffab5c, 0, 1.2, 2);
        scene.add(light);
        return light;
      },
      (l) => {
        l.intensity = 0;
      },
      MAX_CONCURRENT_LIGHTS
    );

    this.active = [];
  }

  _makeRing() {
    const geo = new THREE.RingGeometry(0.001, 1, 48);
    const mat = new THREE.MeshBasicMaterial({
      map: this.ringTex,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 8;
    this.scene.add(mesh);
    return mesh;
  }

  _makeDisc() {
    const geo = new THREE.CircleGeometry(1, 32);
    const mat = new THREE.MeshBasicMaterial({
      map: this.discTex,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    mesh.renderOrder = 7;
    this.scene.add(mesh);
    return mesh;
  }

  /** Opens a breach at `position` (floor point). Resolves once the visual has fully bloomed (~0.45s). */
  async spawn(position, { radius = 0.28 } = {}) {
    const ring = this.ringPool.acquire();
    const disc = this.discPool.acquire();
    // Real-time PointLights are expensive on mobile GPUs: cap how many
    // portals can be lit simultaneously, the rest still get full ring/disc VFX.
    const light = this.lightPool.active.size < MAX_CONCURRENT_LIGHTS ? this.lightPool.acquire() : null;

    ring.position.copy(position).setY(position.y + 0.002);
    disc.position.copy(position).setY(position.y + 0.001);
    ring.visible = true;
    disc.visible = true;
    ring.scale.setScalar(0.001);
    disc.scale.setScalar(0.001);
    ring.material.opacity = 0;
    disc.material.opacity = 0;

    if (light) {
      light.position.copy(position).setY(position.y + 0.15);
      light.intensity = 0;
    }

    this.audioManager?.playPortalOpen(this._anchorFor(position));

    const total = 1.1;
    this.active.push({
      ring,
      disc,
      light,
      age: 0,
      total,
      radius
    });

    return new Promise((resolve) => setTimeout(resolve, 420));
  }

  _anchorFor(position) {
    const anchor = new THREE.Object3D();
    anchor.position.copy(position);
    this.scene.add(anchor);
    setTimeout(() => this.scene.remove(anchor), 2000);
    return anchor;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.age += dt;
      const t = p.age / p.total;
      // bloom in (0 -> 0.35), hold+rotate, fade out (0.6 -> 1)
      const bloom = Math.min(1, t / 0.3);
      const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      const scale = p.radius * (0.15 + 0.85 * easeOutCubic(bloom));
      p.ring.scale.setScalar(scale * 1.15);
      p.disc.scale.setScalar(scale * 0.7);
      p.ring.material.opacity = 0.9 * bloom * fade;
      p.disc.material.opacity = 0.6 * bloom * fade;
      p.ring.rotation.z += dt * 2.2;
      if (p.light) {
        p.light.intensity = 6 * bloom * fade;
      }
      if (t >= 1) {
        this.ringPool.release(p.ring);
        this.discPool.release(p.disc);
        if (p.light) this.lightPool.release(p.light);
        this.active.splice(i, 1);
      }
    }
  }
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
