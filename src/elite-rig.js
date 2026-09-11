import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const ELITE_SWAT_PATH = 'assets/characters/humans/swat_elite_quest.glb';

// SkeletonUtils.retargetClip expects a target-bone -> source-bone dictionary.
// The source SWAT uses a compact Quaternius rig; the Elite model uses a Mixamo rig.
export const ELITE_TO_SWAT_BONES = {
  'mixamorig:Hips_01': 'Hips',
  'mixamorig:Spine_02': 'Abdomen',
  'mixamorig:Spine1_03': 'Chest',
  'mixamorig:Neck_04': 'Neck',
  'mixamorig:Head_05': 'Head',

  'mixamorig:LeftShoulder_07': 'Shoulder.L',
  'mixamorig:LeftArm_08': 'UpperArm.L',
  'mixamorig:LeftForeArm_09': 'LowerArm.L',
  'mixamorig:LeftHand_010': 'Wrist.L',
  'mixamorig:RightShoulder_030': 'Shoulder.R',
  'mixamorig:RightArm_031': 'UpperArm.R',
  'mixamorig:RightForeArm_032': 'LowerArm.R',
  'mixamorig:RightHand_033': 'Wrist.R',

  'mixamorig:LeftHandThumb1_011': 'Thumb1.L',
  'mixamorig:LeftHandThumb2_012': 'Thumb2.L',
  'mixamorig:LeftHandThumb3_013': 'Thumb3.L',
  'mixamorig:RightHandThumb1_034': 'Thumb1.R',
  'mixamorig:RightHandThumb2_035': 'Thumb2.R',
  'mixamorig:RightHandThumb3_036': 'Thumb3.R',

  'mixamorig:LeftHandIndex1_015': 'Index1.L',
  'mixamorig:LeftHandIndex2_00': 'Index2.L',
  'mixamorig:LeftHandIndex3_016': 'Index3.L',
  'mixamorig:RightHandIndex1_038': 'Index1.R',
  'mixamorig:RightHandIndex2_039': 'Index2.R',
  'mixamorig:RightHandIndex3_040': 'Index3.R',

  'mixamorig:LeftHandMiddle1_018': 'Middle1.L',
  'mixamorig:LeftHandMiddle2_019': 'Middle2.L',
  'mixamorig:LeftHandMiddle3_020': 'Middle3.L',
  'mixamorig:RightHandMiddle1_042': 'Middle1.R',
  'mixamorig:RightHandMiddle2_043': 'Middle2.R',
  'mixamorig:RightHandMiddle3_044': 'Middle3.R',

  'mixamorig:LeftHandRing1_022': 'Ring1.L',
  'mixamorig:LeftHandRing2_023': 'Ring2.L',
  'mixamorig:LeftHandRing3_024': 'Ring3.L',
  'mixamorig:RightHandRing1_046': 'Ring1.R',
  'mixamorig:RightHandRing2_047': 'Ring2.R',
  'mixamorig:RightHandRing3_048': 'Ring3.R',

  'mixamorig:LeftHandPinky1_026': 'Pinky1.L',
  'mixamorig:LeftHandPinky2_027': 'Pinky2.L',
  'mixamorig:LeftHandPinky3_028': 'Pinky3.L',
  'mixamorig:RightHandPinky1_050': 'Pinky1.R',
  'mixamorig:RightHandPinky2_051': 'Pinky2.R',
  'mixamorig:RightHandPinky3_052': 'Pinky3.R',

  'mixamorig:LeftUpLeg_054': 'UpperLeg.L',
  'mixamorig:LeftLeg_055': 'LowerLeg.L',
  'mixamorig:LeftFoot_056': 'Foot.L',
  'mixamorig:LeftToeBase_057': 'PT.L',
  'mixamorig:RightUpLeg_059': 'UpperLeg.R',
  'mixamorig:RightLeg_060': 'LowerLeg.R',
  'mixamorig:RightFoot_061': 'Foot.R',
  'mixamorig:RightToeBase_062': 'PT.R'
};

export const ELITE_COMBAT_CLIPS = [
  'Idle_Gun',
  'Idle_Gun_Pointing',
  'Walk',
  'Run',
  'Run_Left',
  'Run_Right',
  'Run_Back',
  'Run_Shoot',
  'Gun_Shoot',
  'HitRecieve',
  'HitRecieve_2',
  'Death'
];

export function findFirstSkinnedMesh(root) {
  let found = null;
  root?.traverse((object) => {
    if (!found && object.isSkinnedMesh && object.skeleton) found = object;
  });
  return found;
}

function clipByShortName(animations, shortName) {
  return animations.find((clip) => clip.name.endsWith(`|${shortName}`)) ||
    animations.find((clip) => clip.name.toLowerCase().includes(shortName.toLowerCase()));
}

export function buildEliteAnimationSet(sourceGltf, eliteGltf) {
  const sourceMesh = findFirstSkinnedMesh(sourceGltf?.scene);
  const targetMesh = findFirstSkinnedMesh(eliteGltf?.scene);
  if (!sourceMesh || !targetMesh) {
    console.warn('Elite retargeting skipped: skinned mesh not found');
    return [];
  }

  sourceGltf.scene.updateMatrixWorld(true);
  eliteGltf.scene.updateMatrixWorld(true);

  const clips = [];
  for (const shortName of ELITE_COMBAT_CLIPS) {
    const sourceClip = clipByShortName(sourceGltf.animations || [], shortName);
    if (!sourceClip) continue;
    try {
      const clip = SkeletonUtils.retargetClip(targetMesh, sourceMesh, sourceClip, {
        names: ELITE_TO_SWAT_BONES,
        hip: 'Hips',
        hipInfluence: new THREE.Vector3(0, 0, 0),
        preserveBoneMatrix: true,
        preserveBonePositions: true,
        useFirstFramePosition: false,
        fps: 30
      });
      clip.name = sourceClip.name;
      clips.push(clip);
    } catch (error) {
      console.warn(`Failed to retarget ${shortName}`, error);
    }
  }
  return clips;
}
