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
    // Bumped toward (and slightly past) the top of the spec's 35-45cm
    // range: player feedback was that ~38cm soldiers a couple meters out
    // read as near-invisible in passthrough. Readability wins over the
    // exact lower bound here.
    heightRange: [0.42, 0.46],
    boneNames: {
      head: 'Head',
      chest: 'Chest',
      hips: 'Hips',
      armL: 'UpperArm.L',
      armR: 'UpperArm.R',
      legL: 'UpperLeg.L',
      legR: 'UpperLeg.R',
      weaponHand: 'Wrist.R'
    },
    weaponModel: WEAPON_MODELS.enemyRifle,
    weaponGrip: { pos: [0, 0.01, 0.02], rotDeg: [0, 90, 90] },
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
    heightRange: [0.46, 0.5],
    muzzleNodeNames: ['frontSIght_low', 'barrel_low', 'topGun_low'],
    boneNamesFallback: {
      head: 'mixamorig:Head_05',
      chest: 'mixamorig:Spine1_03',
      hips: 'mixamorig:Hips_01',
      armL: 'mixamorig:LeftArm_08',
      armR: 'mixamorig:RightArm_031',
      legL: 'mixamorig:LeftUpLeg_054',
      legR: 'mixamorig:RightUpLeg_059'
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
