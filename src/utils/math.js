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

// NOTE: there used to be a Box3.setFromObject()-based measureHeight/
// scaleToHeight here. That's correct for a static mesh but silently wrong
// for a SkinnedMesh: the geometry's vertex buffer lives in an unposed
// reference space that skinning deforms at render time via bone matrices,
// which Box3.setFromObject never applies - it measured raw vertex data
// with no relation to final on-screen size (confirmed on swat.glb: it
// computed a scale factor making the character render at ~6mm instead of
// the intended ~50cm). Bones themselves aren't skinned meshes, so their
// world positions are a reliable stand-in - see measureRigHeight below,
// used for every skinned character instead.

const _rigTop = new THREE.Vector3();
const _rigBottom = new THREE.Vector3();
/**
 * Height (world-space Y) between a top landmark bone/node (e.g. the top of
 * the skull) and the lowest of one or more bottom landmark bones (e.g.
 * toe-tip nodes, tried in order so an asymmetric bind pose still works).
 * `object3d` may be parented or not; call after any pose is applied.
 */
export function measureRigHeight(object3d, topName, bottomNames) {
  const top = object3d.getObjectByName(topName);
  if (!top) return 0;
  top.getWorldPosition(_rigTop);
  return _rigTop.y - lowestWorldY(object3d, bottomNames);
}

/** Lowest world-space Y among the named nodes (first match per name; skips missing ones). */
export function lowestWorldY(object3d, names) {
  let bottomY = Infinity;
  for (const name of names) {
    const node = object3d.getObjectByName(name);
    if (!node) continue;
    node.getWorldPosition(_rigBottom);
    bottomY = Math.min(bottomY, _rigBottom.y);
  }
  return Number.isFinite(bottomY) ? bottomY : 0;
}

/** Uniformly scales a skinned `object3d` so measureRigHeight(...) equals targetHeight (meters). */
export function scaleRigToHeight(object3d, targetHeight, topName, bottomNames) {
  object3d.updateMatrixWorld(true);
  const height = measureRigHeight(object3d, topName, bottomNames);
  if (height > 1e-5) {
    object3d.scale.multiplyScalar(targetHeight / height);
    object3d.updateMatrixWorld(true);
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
