import * as THREE from 'three';

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const randRange = (min, max) => min + Math.random() * (max - min);
export const randSign = () => (Math.random() < 0.5 ? -1 : 1);
export const choice = (arr) => arr[(Math.random() * arr.length) | 0];

/** Exponential smoothing damp, framerate independent. */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Exponential smoothing damp for an angle (radians), taking the shortest path. */
export function dampAngle(current, target, lambda, dt) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

/** Returns the bounding-box world-space height of an object3D. */
export function measureHeight(object3d) {
  const box = new THREE.Box3().setFromObject(object3d);
  return box.max.y - box.min.y;
}

export function boundingBoxOf(object3d) {
  return new THREE.Box3().setFromObject(object3d);
}

/** Uniformly scales `object3d` so its bounding-box height equals targetHeight (meters). */
export function scaleToHeight(object3d, targetHeight) {
  const height = measureHeight(object3d);
  if (height > 1e-5) {
    const s = targetHeight / height;
    object3d.scale.multiplyScalar(s);
  }
  return object3d;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
/** Signed horizontal angle (radians) from `forward` to the direction toward `target`, seen from `origin`. */
export function signedAngleToXZ(origin, forward, target) {
  _v1.copy(target).sub(origin);
  _v1.y = 0;
  if (_v1.lengthSq() < 1e-8) return 0;
  _v1.normalize();
  _v2.copy(forward);
  _v2.y = 0;
  _v2.normalize();
  const dot = clamp(_v2.dot(_v1), -1, 1);
  const cross = _v2.x * _v1.z - _v2.z * _v1.x;
  return Math.atan2(cross, dot);
}
