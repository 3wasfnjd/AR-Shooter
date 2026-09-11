import * as THREE from 'three';

/**
 * Heuristic auto-orientation shared by player and enemy weapon rigs: guns
 * are longer than they are tall, so the longest horizontal bounding-box
 * axis is rotated to local -Z ("forward"), and the muzzle tip is taken as
 * the -Z bounding extreme (nudged by `forwardBias`). Mutates `scene` in
 * place and returns the muzzle point in scene-local space.
 *
 * The pivot (what ends up at the controller grip) is placed `gripFraction`
 * of the way from the back/stock end toward the muzzle, not dead-center -
 * a real hand grips a rifle-shaped object well back of its midpoint, and
 * centering on the full bounding box (0.5) made longer weapons hover with
 * their middle at the hand instead of their grip. Still an untested
 * guess without a live headset in the loop; use the in-game calibration
 * mode (hold both triggers ~0.6s) to fine-tune, then bake the reported
 * numbers into WeaponDefs.js's `grip` field, which overrides this pivot.
 */
export function autoOrientGun(scene, forwardBias = 0.02, gripFraction = 0.38) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());

  if (size.x >= size.z) {
    scene.rotateY(-Math.PI / 2);
    scene.updateMatrixWorld(true);
  }

  const box2 = new THREE.Box3().setFromObject(scene);
  const center = box2.getCenter(new THREE.Vector3());
  const sizeZ = box2.max.z - box2.min.z;
  const gripZ = box2.max.z - gripFraction * sizeZ; // max.z = back/stock end, min.z = muzzle end
  scene.position.x -= center.x;
  scene.position.z -= gripZ;
  scene.updateMatrixWorld(true);

  const box3 = new THREE.Box3().setFromObject(scene);
  const muzzleZ = box3.min.z - forwardBias;
  const muzzleY = box3.max.y * 0.35 + box3.min.y * 0.65;
  return new THREE.Vector3(0, muzzleY, muzzleZ);
}
