import * as THREE from 'three';

/**
 * Heuristic auto-orientation shared by player and enemy weapon rigs: guns
 * are longer than they are tall, so the longest horizontal bounding-box
 * axis is rotated to local -Z ("forward"), the model is re-centered on that
 * axis, and the muzzle tip is taken as the -Z bounding extreme (nudged by
 * `forwardBias`). Mutates `scene` in place and returns the muzzle point in
 * scene-local space. See WeaponDefs.js for the on-device tuning note.
 */
export function autoOrientGun(scene, forwardBias = 0.02) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());

  if (size.x >= size.z) {
    scene.rotateY(-Math.PI / 2);
    scene.updateMatrixWorld(true);
  }

  const box2 = new THREE.Box3().setFromObject(scene);
  const center = box2.getCenter(new THREE.Vector3());
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.updateMatrixWorld(true);

  const box3 = new THREE.Box3().setFromObject(scene);
  const muzzleZ = box3.min.z - forwardBias;
  const muzzleY = box3.max.y * 0.35 + box3.min.y * 0.65;
  return new THREE.Vector3(0, muzzleY, muzzleZ);
}
