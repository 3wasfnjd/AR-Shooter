import { CHARACTERS, WEAPON_MODELS } from '../assets/paths.js';

// swat.glb is a fully rigged/animated Quaternius-derived soldier: it drives
// the FSM through real locomotion + combat clips (see ANIM below).
// swat_elite_quest.glb ships with zero AnimationClips (it's a static
// Sketchfab bind-pose mesh with its rifle fused into the geometry) — rather
// than fight that limitation, the Elite is leaned into as a different kind
// of threat: a rigid, higher-fidelity, higher-health unit that advances and
// fires with mechanical precision instead of fluid movement, which reads
// intentionally as "more advanced" rather than "broken animation".
export const ANIM = {
  idle: 'CharacterArmature|Idle_Gun',
  alert: 'CharacterArmature|Idle_Gun_Pointing',
  walk: 'CharacterArmature|Walk',
  run: 'CharacterArmature|Run',
  runBack: 'CharacterArmature|Run_Back',
  runLeft: 'CharacterArmature|Run_Left',
  runRight: 'CharacterArmature|Run_Right',
  shootStand: 'CharacterArmature|Idle_Gun_Shoot',
  shootBurst: 'CharacterArmature|Gun_Shoot',
  shootMoving: 'CharacterArmature|Run_Shoot',
  reload: 'CharacterArmature|Interact',
  hitA: 'CharacterArmature|HitRecieve',
  hitB: 'CharacterArmature|HitRecieve_2',
  dodge: 'CharacterArmature|Roll',
  death: 'CharacterArmature|Death'
};

export const SOLDIER_TYPES = {
  regular: {
    id: 'regular',
    label: 'Soldier',
    model: CHARACTERS.soldier,
    animated: true,
    // Bumped past the spec's 35-45cm range after two rounds of on-device
    // feedback that soldiers were still hard to spot even at 42-46cm - the
    // deeper issue turned out to be as much about *where to look* (floor
    // level, easy to miss) as raw size, addressed with the threat-arrow
    // indicator and contact ping in HUD.js/Soldier.js, but a further size
    // bump is a cheap complementary fix. Readability wins over the exact
    // lower bound here.
    heightRange: [0.5, 0.55],
    // Measuring height from raw mesh geometry (Box3.setFromObject) is
    // wrong for a SkinnedMesh: the geometry's vertex buffer is in an
    // unposed reference space skinning deforms at render time, unrelated
    // to final on-screen size - this was silently producing a ~100x-too-
    // small scale factor (confirmed via the desktop preview + a manual
    // bone-position bbox dump; visible height was ~6mm, not ~50cm).
    // Bones themselves aren't skinned meshes, so their world positions
    // (top of skull to toe tip) give the real bind-pose height instead.
    // NOTE: `assets/config/rig_metadata.json` documents these bone names
    // WITH dots (e.g. "UpperArm.L", "PT.L_end") - that's apparently taken
    // from the pre-export source, not the actual glb. GLTFLoader sees them
    // without dots at runtime (confirmed by traversing a live-loaded
    // instance): "UpperArmL", "PTL_end", etc. Trust this list, not the
    // rig_metadata file, if the two ever disagree again.
    heightBones: { top: 'Head_end', bottom: ['PTL_end', 'PTR_end', 'FootL_end', 'FootR_end'] },
    boneNames: {
      head: 'Head',
      chest: 'Chest',
      hips: 'Hips',
      armL: 'UpperArmL',
      armR: 'UpperArmR',
      legL: 'UpperLegL',
      legR: 'UpperLegR',
      weaponHand: 'WristR'
    },
    weaponModel: WEAPON_MODELS.enemyRifle,
    // Left at identity: gunOrient.js's orientKenneyBlaster already
    // recenters/positions the Kenney blaster model from its own bounding
    // box, same as the player's weapons.
    weaponGrip: { pos: [0, 0, 0], rotDeg: [0, 0, 0] },
    stats: {
      health: 65,
      damage: 5,
      accuracy: 0.52,
      fireCooldown: 1.15,
      burstShots: 3,
      moveSpeed: 0.55,
      sprintSpeed: 1.05,
      reactionTime: 0.4,
      reloadTime: 1.6
    }
  },
  elite: {
    id: 'elite',
    label: 'Elite Soldier',
    model: CHARACTERS.elite,
    animated: false,
    heightRange: [0.55, 0.6],
    // Same bone-based measurement as `regular` (see its comment) - the
    // Elite is also a SkinnedMesh even though it has no animation clips.
    // Like `regular`, GLTFLoader strips the separator from these at
    // runtime - "mixamorig:Head_05" (rig_metadata.json / Mixamo's own
    // convention) loads as "mixamorigHead_05". Confirmed by traversing a
    // live-loaded instance; trust this list over rig_metadata.json.
    heightBones: { top: 'mixamorigHeadTop_End_06', bottom: ['mixamorigLeftToe_End_058', 'mixamorigRightToe_End_063'] },
    muzzleNodeNames: ['frontSIght_low', 'barrel_low', 'topGun_low'],
    boneNamesFallback: {
      head: 'mixamorigHead_05',
      chest: 'mixamorigSpine1_03',
      hips: 'mixamorigHips_01',
      armL: 'mixamorigLeftArm_08',
      armR: 'mixamorigRightArm_031',
      legL: 'mixamorigLeftUpLeg_054',
      legR: 'mixamorigRightUpLeg_059'
    },
    stats: {
      health: 130,
      damage: 9,
      accuracy: 0.72,
      fireCooldown: 0.85,
      burstShots: 5,
      moveSpeed: 0.4,
      sprintSpeed: 0.4,
      reactionTime: 0.25,
      reloadTime: 1.2
    }
  }
};

export const HITZONE_MULTIPLIER = {
  head: 3,
  chest: 1,
  hips: 1,
  armL: 0.6,
  armR: 0.6,
  legL: 0.6,
  legR: 0.6
};
