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

/**
 * Exact orientation using named bones instead of a bounding-box guess:
 * every weapon in assets/weapons/{west,east} is itself a SkinnedMesh with
 * a "Body" bone and, on 4 of 5, an "Attach_Muzzle" bone (purpose-built by
 * the source kit for exactly this). Box3.setFromObject doesn't work on a
 * SkinnedMesh at all (see the comment in src/utils/math.js - same
 * underlying issue that made enemy soldiers render ~100x too small), so
 * `autoOrientGun`'s bounding-box heuristic was never going to reliably
 * orient these regardless of tuning. This instead rotates the scene so
 * Body->Attach_Muzzle points down local -Z, then recenters on `gripName`
 * (default "Trigger") - both bone positions, unaffected by skinning.
 * Returns the muzzle point in scene-local space, or null if body/muzzle is
 * missing (the shotgun has no Attach_Muzzle - caller should fall back to
 * autoOrientGun for it).
 *
 * "Body" is NOT where a hand actually holds these rigs - measured via the
 * desktop preview (dumping every named bone's world position against the
 * geometry's own bounding box): on the rifle, Body sits ~4.5cm above the
 * bore-to-grip line where Trigger sits; on the pistol, Body sits ~3.7cm
 * further toward the muzzle than Trigger. Recentering on Body (as an
 * earlier version did) reliably put the rendered gun offset from the
 * actual controller position - reported on-device as the weapon "not
 * aligned with the hand", for both the player's own weapon and every
 * enemy's. None of these rigs have a dedicated grip/handle bone, but
 * Trigger sits right where a hand wraps the grip (a real trigger finger
 * is essentially at the palm's height and just in front of it), making it
 * a much closer stand-in than Body ever was.
 */
export function orientGunByBones(scene, { bodyName = 'Body', muzzleName = 'Attach_Muzzle', upRefName = 'Attach_Scope', gripName = 'Trigger', forwardBias = 0 } = {}) {
  scene.updateMatrixWorld(true);
  const body = scene.getObjectByName(bodyName);
  const muzzleBone = scene.getObjectByName(muzzleName);
  if (!body || !muzzleBone) return null;
  const gripBone = (gripName && scene.getObjectByName(gripName)) || body;

  const bodyPos = body.getWorldPosition(new THREE.Vector3());
  const muzzlePos = muzzleBone.getWorldPosition(new THREE.Vector3());
  const fwd = muzzlePos.clone().sub(bodyPos);
  if (fwd.lengthSq() < 1e-10) return null;
  fwd.normalize();

  // Forward alone leaves roll undetermined (many rotations point local -Z
  // along `fwd`); a scope/rail mount sits on TOP of every one of these
  // weapons in the source rig, so its position relative to Body doubles
  // as an "up" reference to pin the roll too, instead of the gun ending
  // up aimed correctly but sideways or upside down.
  let up = new THREE.Vector3(0, 1, 0);
  const upRef = upRefName ? scene.getObjectByName(upRefName) : null;
  if (upRef) {
    const upPos = upRef.getWorldPosition(new THREE.Vector3()).sub(bodyPos);
    const perp = upPos.sub(fwd.clone().multiplyScalar(upPos.dot(fwd))); // component of upPos perpendicular to fwd
    if (perp.lengthSq() > 1e-8) up = perp.normalize();
  }

  // Matrix4.lookAt(eye, target, up) is the standard, tested way to build
  // exactly the rotation wanted here: with eye at the origin and target
  // along `fwd`, its local -Z ends up pointing at `fwd` (the same
  // "camera looks down -Z" convention used for the controller ray
  // elsewhere), and `up` resolves the roll. An earlier hand-rolled
  // version building a basis matrix directly got this backwards (it
  // aligned the canonical +Z axis with -fwd, which is unrelated to where
  // `fwd` itself ends up) - confirmed backwards on-device, guns and
  // enemy weapons alike pointed into the player's hand instead of away
  // from it.
  const lookAt = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), fwd, up);
  scene.quaternion.setFromRotationMatrix(lookAt);
  scene.updateMatrixWorld(true);

  const newGripPos = gripBone.getWorldPosition(new THREE.Vector3());
  scene.position.sub(newGripPos);
  scene.updateMatrixWorld(true);

  const muzzleLocal = muzzleBone.getWorldPosition(new THREE.Vector3());
  muzzleLocal.z -= forwardBias;
  return muzzleLocal;
}

/** Tries the exact bone-based orientation first, falling back to the bounding-box heuristic (e.g. for the shotgun, which has no Attach_Muzzle bone). */
export function orientGun(scene, forwardBias = 0.02) {
  const bonePivot = orientGunByBones(scene, { forwardBias: 0 });
  if (bonePivot) return bonePivot;
  return autoOrientGun(scene, forwardBias);
}
