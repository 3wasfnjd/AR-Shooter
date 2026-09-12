import * as THREE from 'three';

/**
 * Positions/orients a Kenney Blaster Kit model (see assets/weapons/kenney)
 * for controller/hand attachment. Every model in this kit is a plain
 * static Mesh - no skeleton, no bones, no per-part naming convention like
 * the earlier realistic weapon pack had ("Body"/"Attach_Muzzle"/etc.) - so
 * `Box3.setFromObject` is fully reliable here (unlike on that pack's
 * SkinnedMeshes, see the comment in src/utils/math.js for why that
 * mattered there). Confirmed by rendering a side-profile with markers at
 * both Z extremes that the whole kit is consistently authored with the
 * barrel pointing along local -Z and the grip/stock toward +Z, with no
 * rotation needed at all - only recentering.
 *
 * None of these models have a dedicated grip/handle marker either, so the
 * recenter point is an estimate from the bounding box: `gripFraction` back
 * from the rear (+Z) end (a one-handed blaster's grip sits close to its
 * rear, not at the very back edge, which is often a stock/tail fin) and
 * `gripHeightFraction` up from the bottom (grips hang below the
 * body/sight line). `muzzleHeightFraction` separately estimates the bore's
 * height for the returned muzzle point. All three are tuned by eye against
 * this kit's silhouette - use the in-game calibration mode (hold both
 * triggers ~0.6s) for whatever small correction a given model still needs,
 * same as the realistic pack.
 */
export function orientKenneyBlaster(
  scene,
  { gripFraction = 0.22, gripHeightFraction = 0.28, muzzleHeightFraction = 0.6, forwardBias = 0 } = {}
) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());

  const centerX = (box.min.x + box.max.x) / 2;
  const gripY = box.min.y + gripHeightFraction * size.y;
  const gripZ = box.max.z - gripFraction * size.z; // +Z end = rear/grip (confirmed via side-profile render)

  scene.position.x -= centerX;
  scene.position.y -= gripY;
  scene.position.z -= gripZ;
  scene.updateMatrixWorld(true);

  const box2 = new THREE.Box3().setFromObject(scene);
  const muzzleZ = box2.min.z - forwardBias; // -Z end = muzzle
  const muzzleY = box2.min.y + muzzleHeightFraction * size.y;
  return new THREE.Vector3(0, muzzleY, muzzleZ);
}

/** Kept as the stable call-site name (WeaponSystem.js / Soldier.js) in case a future weapon pack needs a different strategy again. */
export function orientGun(scene, forwardBias = 0) {
  return orientKenneyBlaster(scene, { forwardBias });
}
