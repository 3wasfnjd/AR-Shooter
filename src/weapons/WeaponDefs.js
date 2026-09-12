import { WEAPON_MODELS, AUDIO } from '../assets/paths.js';

// Per-weapon tuning. Models are Kenney's Blaster Kit 2.1 (CC0) - a
// stylized, chunky, colorful pack chosen to move the game's look closer to
// a Fortnite-like aesthetic, replacing the earlier realistic SkinnedMesh
// pack entirely. `grip.pos`/`grip.rotDeg` position/orient the glb relative
// to the controller grip space (WebXR grip space: -Z is roughly "into the
// palm", +Y up), ON TOP OF the pivot gunOrient.js's `orientKenneyBlaster`
// already establishes from each model's own bounding box (these are plain
// static meshes with no bones at all, unlike the old pack - see that
// file's comment for how the grip point is estimated without one). Left
// at [0,0,0] as a clean baseline; if a weapon doesn't sit right in-hand,
// use the in-game calibration mode (hold both triggers ~0.6s - see
// WeaponSystem.js and README.md) to nudge it and bake in what it reports.
// `muzzleForwardBias` nudges the muzzle tip forward/back and is 0 for
// every weapon - the old shotgun special-case (falling back to a cruder
// heuristic for a bone this kit doesn't have anyway) no longer applies,
// since every weapon here goes through the same bounding-box-based path.
export const WEAPON_DEFS = [
  {
    id: 'pistol',
    name: 'Sidearm',
    model: WEAPON_MODELS.pistol,
    kind: 'semi',
    damage: 22,
    fireCooldown: 0.18,
    magSize: 12,
    reloadTime: 1.1,
    spreadDeg: 0.9,
    scale: 1,
    grip: { pos: [0, 0, 0], rotDeg: [0, 0, 0] },
    muzzleForwardBias: 0,
    recoil: { kickBack: 0.02, riseDeg: 5, recoverySpeed: 14 },
    flash: { size: 0.06, life: 0.09, color: 0xfff0c0 },
    smoke: { chance: 0.35, size: 0.035, life: 0.7, density: 0.35 },
    tracer: { width: 0.008, life: 0.08, color: 0xfff2c0 },
    haptics: { intensity: 0.5, durationMs: 35 },
    sound: AUDIO.weapons.pistol,
    reloadSound: AUDIO.weapons.reloadPistol,
    pellets: 1
  },
  {
    id: 'smg',
    name: 'Compact SMG',
    model: WEAPON_MODELS.smg,
    kind: 'auto',
    damage: 12,
    fireCooldown: 0.09,
    magSize: 30,
    reloadTime: 1.6,
    spreadDeg: 2.2,
    scale: 1,
    grip: { pos: [0, 0, 0], rotDeg: [0, 0, 0] },
    muzzleForwardBias: 0,
    recoil: { kickBack: 0.012, riseDeg: 2.4, recoverySpeed: 20 },
    flash: { size: 0.055, life: 0.08, color: 0xfff0c0 },
    smoke: { chance: 0.5, size: 0.03, life: 0.6, density: 0.3 },
    tracer: { width: 0.007, life: 0.07, color: 0xfff2c0 },
    haptics: { intensity: 0.35, durationMs: 18 },
    sound: AUDIO.weapons.smg,
    reloadSound: AUDIO.weapons.reloadRifle,
    pellets: 1
  },
  {
    id: 'rifle',
    name: 'Assault Rifle',
    model: WEAPON_MODELS.rifle,
    kind: 'auto',
    damage: 18,
    fireCooldown: 0.1,
    magSize: 30,
    reloadTime: 1.9,
    spreadDeg: 1.4,
    scale: 1,
    grip: { pos: [0, 0, 0], rotDeg: [0, 0, 0] },
    muzzleForwardBias: 0,
    recoil: { kickBack: 0.018, riseDeg: 3.2, recoverySpeed: 16 },
    flash: { size: 0.09, life: 0.1, color: 0xffe6a8 },
    smoke: { chance: 0.65, size: 0.05, life: 1.0, density: 0.45 },
    tracer: { width: 0.01, life: 0.09, color: 0xffe6a0 },
    haptics: { intensity: 0.55, durationMs: 25 },
    sound: AUDIO.weapons.rifle,
    reloadSound: AUDIO.weapons.reloadRifle,
    pellets: 1
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    model: WEAPON_MODELS.shotgun,
    kind: 'pump',
    damage: 9,
    fireCooldown: 0.85,
    pumpTime: 0.45,
    magSize: 6,
    reloadTime: 2.3,
    spreadDeg: 9,
    scale: 1,
    grip: { pos: [0, 0, 0], rotDeg: [0, 0, 0] },
    muzzleForwardBias: 0,
    recoil: { kickBack: 0.05, riseDeg: 10, recoverySpeed: 8 },
    flash: { size: 0.14, life: 0.14, color: 0xffd68a },
    smoke: { chance: 1, size: 0.09, life: 1.3, density: 0.6 },
    tracer: { width: 0.012, life: 0.09, color: 0xffdca0 },
    haptics: { intensity: 1, durationMs: 70 },
    sound: AUDIO.weapons.shotgun,
    reloadSound: AUDIO.weapons.shotgunPump,
    pellets: 8
  },
  {
    id: 'sniper',
    name: 'Sniper Rifle',
    model: WEAPON_MODELS.sniper,
    kind: 'bolt',
    damage: 95,
    fireCooldown: 1.35,
    boltCycleTime: 0.9,
    magSize: 5,
    reloadTime: 2.6,
    spreadDeg: 0.15,
    scale: 1,
    grip: { pos: [0, 0, 0], rotDeg: [0, 0, 0] },
    muzzleForwardBias: 0,
    recoil: { kickBack: 0.07, riseDeg: 13, recoverySpeed: 6 },
    flash: { size: 0.17, life: 0.16, color: 0xffffff },
    smoke: { chance: 1, size: 0.1, life: 1.5, density: 0.55 },
    tracer: { width: 0.014, life: 0.16, color: 0xffffff },
    haptics: { intensity: 1, durationMs: 90 },
    sound: AUDIO.weapons.sniper,
    reloadSound: AUDIO.weapons.reloadRifle,
    pellets: 1
  }
];

export const WEAPON_ORDER = WEAPON_DEFS.map((w) => w.id);
export function weaponDef(id) {
  return WEAPON_DEFS.find((w) => w.id === id) || WEAPON_DEFS[0];
}
