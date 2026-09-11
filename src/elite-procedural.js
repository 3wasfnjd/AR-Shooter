import * as THREE from 'three';

const BONE_NAMES = {
  hips: 'mixamorig:Hips_01',
  spine: 'mixamorig:Spine_02',
  chest: 'mixamorig:Spine1_03',
  neck: 'mixamorig:Neck_04',
  head: 'mixamorig:Head_05',
  leftShoulder: 'mixamorig:LeftShoulder_07',
  leftArm: 'mixamorig:LeftArm_08',
  leftForeArm: 'mixamorig:LeftForeArm_09',
  rightShoulder: 'mixamorig:RightShoulder_030',
  rightArm: 'mixamorig:RightArm_031',
  rightForeArm: 'mixamorig:RightForeArm_032',
  leftUpLeg: 'mixamorig:LeftUpLeg_054',
  leftLeg: 'mixamorig:LeftLeg_055',
  leftFoot: 'mixamorig:LeftFoot_056',
  rightUpLeg: 'mixamorig:RightUpLeg_059',
  rightLeg: 'mixamorig:RightLeg_060',
  rightFoot: 'mixamorig:RightFoot_061'
};

const qOffset = new THREE.Quaternion();
const euler = new THREE.Euler();

export function createElitePoseRig(root) {
  const bones = {};
  const base = {};
  for (const [key, name] of Object.entries(BONE_NAMES)) {
    const bone = root.getObjectByName(name);
    if (!bone) continue;
    bones[key] = bone;
    base[key] = bone.quaternion.clone();
  }
  return { bones, base };
}

function resetRig(rig) {
  if (!rig) return;
  for (const [key, bone] of Object.entries(rig.bones)) {
    const base = rig.base[key];
    if (base) bone.quaternion.copy(base);
  }
}

function rotate(rig, key, x = 0, y = 0, z = 0) {
  const bone = rig?.bones?.[key];
  const base = rig?.base?.[key];
  if (!bone || !base) return;
  euler.set(x, y, z, 'XYZ');
  qOffset.setFromEuler(euler);
  bone.quaternion.copy(base).multiply(qOffset);
}

export function setEliteMotionState(enemy, name, loop = true) {
  if (!enemy) return;
  if (enemy.animName === name && loop) return;
  enemy.animName = name;
  enemy.motionStartedAt = performance.now();
  enemy.motionLoop = loop;
}

export function updateEliteMotion(enemy, now) {
  const rig = enemy?.poseRig;
  if (!rig) return;
  resetRig(rig);

  const state = enemy.animName || 'Idle_Gun';
  const t = (now - (enemy.spawnedAt || now)) / 1000;
  const localT = Math.max(0, (now - (enemy.motionStartedAt || now)) / 1000);
  const breathe = Math.sin(t * 2.6) * 0.025;

  if (state === 'Death') {
    const p = THREE.MathUtils.smoothstep(Math.min(localT / 0.7, 1), 0, 1);
    rotate(rig, 'hips', 0.25 * p, 0, 0.15 * p);
    rotate(rig, 'spine', -0.2 * p, 0, 0.18 * p);
    rotate(rig, 'chest', -0.28 * p, 0.08 * p, 0.22 * p);
    rotate(rig, 'leftArm', -0.7 * p, 0, -0.35 * p);
    rotate(rig, 'rightArm', 0.55 * p, 0, 0.25 * p);
    rotate(rig, 'leftUpLeg', 0.25 * p, 0, 0);
    rotate(rig, 'rightUpLeg', -0.2 * p, 0, 0);
    return;
  }

  if (state.startsWith('HitRecieve')) {
    const kick = Math.sin(Math.min(localT / 0.32, 1) * Math.PI) * 0.42;
    rotate(rig, 'spine', -kick * 0.6, 0, state.endsWith('_2') ? -kick * 0.45 : kick * 0.45);
    rotate(rig, 'chest', -kick, 0, state.endsWith('_2') ? -kick * 0.2 : kick * 0.2);
    rotate(rig, 'head', kick * 0.28, 0, 0);
    return;
  }

  const isRun = state === 'Run' || state === 'Run_Left' || state === 'Run_Right' || state === 'Run_Back' || state === 'Run_Shoot';
  const isWalk = state === 'Walk';
  const moving = isRun || isWalk;
  const speed = isRun ? 9.5 : 5.2;
  const stride = Math.sin(t * speed);
  const stride2 = Math.sin(t * speed + Math.PI);
  const legAmp = isRun ? 0.72 : 0.38;

  if (moving) {
    rotate(rig, 'leftUpLeg', stride * legAmp, 0, 0);
    rotate(rig, 'rightUpLeg', stride2 * legAmp, 0, 0);
    rotate(rig, 'leftLeg', Math.max(0, -stride) * (isRun ? 0.75 : 0.42), 0, 0);
    rotate(rig, 'rightLeg', Math.max(0, -stride2) * (isRun ? 0.75 : 0.42), 0, 0);
    rotate(rig, 'hips', 0.03 + Math.abs(stride) * 0.045, 0, stride * 0.055);
    rotate(rig, 'spine', isRun ? -0.12 : -0.04, 0, -stride * 0.035);
  }

  const aiming = state.includes('Gun') || state.includes('Shoot') || state === 'Run_Shoot';
  if (aiming) {
    const recoil = (state === 'Gun_Shoot' || state === 'Run_Shoot')
      ? Math.sin(Math.min(localT / 0.23, 1) * Math.PI) * 0.22
      : 0;
    rotate(rig, 'leftShoulder', -0.16, 0.05, -0.08);
    rotate(rig, 'rightShoulder', -0.12, -0.04, 0.06);
    rotate(rig, 'leftArm', -0.9 + breathe, -0.18, -0.42);
    rotate(rig, 'rightArm', -0.82 + breathe - recoil, 0.12, 0.38);
    rotate(rig, 'leftForeArm', -0.72, 0, 0.06);
    rotate(rig, 'rightForeArm', -0.95 - recoil * 0.7, 0, -0.05);
    rotate(rig, 'chest', moving ? -0.1 : breathe * 0.8, 0, 0);
  } else if (moving) {
    rotate(rig, 'leftArm', stride2 * legAmp * 0.55, 0, -0.08);
    rotate(rig, 'rightArm', stride * legAmp * 0.55, 0, 0.08);
  } else {
    rotate(rig, 'spine', breathe, 0, 0);
    rotate(rig, 'chest', breathe * 0.7, 0, 0);
  }

  if (state === 'Run_Left') rotate(rig, 'chest', -0.08, 0, 0.18);
  if (state === 'Run_Right') rotate(rig, 'chest', -0.08, 0, -0.18);
  if (state === 'Run_Back') rotate(rig, 'spine', 0.08, 0, 0);
}
