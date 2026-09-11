from pathlib import Path
import json

p = Path('src/main.js')
s = p.read_text()

old = "import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';\n"
new = old + "import { ELITE_SWAT_PATH, buildEliteAnimationSet } from './elite-rig.js';\n"
if "from './elite-rig.js'" not in s:
    if old not in s:
        raise SystemExit('SkeletonUtils import not found')
    s = s.replace(old, new, 1)

old = "let enemyTemplate;\nlet muzzleTexture;"
new = "let enemyTemplate;\nlet eliteGltf;\nlet eliteTemplate;\nlet eliteClips = [];\nlet muzzleTexture;"
if 'let eliteGltf;' not in s:
    if old not in s:
        raise SystemExit('enemy declarations not found')
    s = s.replace(old, new, 1)

old = """function findClip(name) {
  if (!enemyGltf) return null;
  return enemyGltf.animations.find((clip) => clip.name.endsWith(`|${name}`)) ||
    enemyGltf.animations.find((clip) => clip.name.toLowerCase().includes(name.toLowerCase())) || null;
}
"""
new = """function findClip(name, clips = enemyGltf?.animations || []) {
  return clips.find((clip) => clip.name.endsWith(`|${name}`)) ||
    clips.find((clip) => clip.name.toLowerCase().includes(name.toLowerCase())) || null;
}
"""
if 'function findClip(name, clips =' not in s:
    if old not in s:
        raise SystemExit('findClip block not found')
    s = s.replace(old, new, 1)

s = s.replace(
    "  const clip = findClip(name);\n",
    "  const clip = findClip(name, enemy.clips || enemyGltf?.animations || []);\n",
    1
)

old = """function createEnemy(position, index = 0) {
  const model = SkeletonUtils.clone(enemyTemplate);
  const root = new THREE.Group();
  root.position.copy(position);
  root.rotation.y = Math.random() * Math.PI * 2;
  root.add(model);
  scene.add(root);
  // Final world-space correction: keep the character's lowest visible point on the detected floor.
  root.updateMatrixWorld(true);
  const groundBox = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(groundBox.min.y)) root.position.y += position.y - groundBox.min.y;

  const mixer = new THREE.AnimationMixer(model);
  const enemy = {
    root, model, mixer, action: null, animName: '', hp: 100, dead: false,
    hitTilt: 0,
    speed: 0.62 + Math.min(state.wave, 6) * 0.035 + Math.random() * 0.12,
    nextAttack: performance.now() + 800 + Math.random() * 1200,
    strafeSign: index % 2 ? 1 : -1
  };

  model.traverse((child) => {
    if (child.isMesh) {
      child.frustumCulled = false;
      child.userData.enemyRef = enemy;
    }
  });

  playEnemyAnimation(enemy, 'Idle_Gun');
  enemies.push(enemy);
  return enemy;
}
"""
new = """function createEnemy(position, index = 0) {
  const eliteReady = Boolean(eliteTemplate && eliteClips.length);
  const useElite = eliteReady && (index === 0 || (state.wave > 1 && Math.random() < 0.32));
  const template = useElite ? eliteTemplate : enemyTemplate;
  const clips = useElite ? eliteClips : (enemyGltf?.animations || []);
  const model = SkeletonUtils.clone(template);
  const root = new THREE.Group();
  root.position.copy(position);
  root.rotation.y = Math.random() * Math.PI * 2;
  root.add(model);
  scene.add(root);

  // Keep the lowest visible point on the detected physical floor for both character rigs.
  root.updateMatrixWorld(true);
  const groundBox = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(groundBox.min.y)) root.position.y += position.y - groundBox.min.y;

  const mixer = new THREE.AnimationMixer(model);
  const now = performance.now();
  const enemy = {
    root, model, mixer, clips, action: null, animName: '',
    kind: useElite ? 'elite' : 'swat',
    hp: useElite ? 125 : 100,
    dead: false,
    hitTilt: 0,
    speed: (useElite ? 0.55 : 0.62) + Math.min(state.wave, 6) * 0.03 + Math.random() * 0.10,
    nextAttack: now + 900 + Math.random() * 1200,
    nextStrafe: now + 700 + Math.random() * 1600,
    strafeUntil: 0,
    strafeSign: index % 2 ? 1 : -1
  };

  model.traverse((child) => {
    if (child.isMesh) {
      child.frustumCulled = false;
      child.userData.enemyRef = enemy;
    }
  });

  playEnemyAnimation(enemy, 'Idle_Gun', true, 0.18);
  enemies.push(enemy);
  return enemy;
}
"""
if 'const eliteReady = Boolean(eliteTemplate && eliteClips.length);' not in s:
    if old not in s:
        raise SystemExit('createEnemy block not found')
    s = s.replace(old, new, 1)

s = s.replace(
    "  const clip = findClip('Death');\n",
    "  const clip = findClip('Death', enemy.clips || enemyGltf?.animations || []);\n",
    1
)

old = """function updateEnemies(delta) {
  if (!arenaPlaced || gameEnded) return;
  const player = getPlayerPosition(tmpVec);
  const now = performance.now();

  for (const enemy of enemies) {
    enemy.mixer.update(delta);
    if (enemy.dead) continue;

    const pos = enemy.root.position;
    enemy.root.rotation.z = THREE.MathUtils.damp(enemy.root.rotation.z, enemy.hitTilt || 0, 12, delta);
    enemy.hitTilt = THREE.MathUtils.damp(enemy.hitTilt || 0, 0, enemy.dead ? 1.1 : 7.5, delta);
    tmpVec2.set(player.x - pos.x, 0, player.z - pos.z);
    const distance = tmpVec2.length();
    if (distance > 0.001) tmpVec2.normalize();

    // The SWAT mesh faces +Z. Point that forward axis toward the player.
    enemy.root.rotation.y = Math.atan2(tmpVec2.x, tmpVec2.z);

    if (distance > 2.45) {
      const advance = Math.min(enemy.speed * delta, Math.max(0, distance - 2.2));
      pos.addScaledVector(tmpVec2, advance);
      playEnemyAnimation(enemy, 'Run');
    } else {
      playEnemyAnimation(enemy, 'Idle_Gun_Pointing');
    }

    if (distance < 6.5 && now >= enemy.nextAttack) {
      enemy.nextAttack = now + Math.max(650, 1450 - state.wave * 55) + Math.random() * 650;
      playEnemyAnimation(enemy, 'Gun_Shoot', false, 0.05);
      setTimeout(() => {
        if (!enemy.dead && !gameEnded) {
          const currentDistance = enemy.root.position.distanceTo(getPlayerPosition(new THREE.Vector3()));
          const accuracy = THREE.MathUtils.clamp(0.88 - currentDistance * 0.045, 0.52, 0.82);
          if (Math.random() < accuracy) damagePlayer(6 + Math.min(state.wave, 8) * 0.7);
          playEnemyAnimation(enemy, 'Idle_Gun_Pointing', true, 0.08);
        }
      }, 210);
    }
  }
}
"""
new = """function updateEnemies(delta) {
  if (!arenaPlaced || gameEnded) return;
  const player = getPlayerPosition(tmpVec);
  const now = performance.now();

  for (const enemy of enemies) {
    enemy.mixer.update(delta);
    if (enemy.dead) continue;

    const pos = enemy.root.position;
    enemy.root.rotation.z = THREE.MathUtils.damp(enemy.root.rotation.z, enemy.hitTilt || 0, 12, delta);
    enemy.hitTilt = THREE.MathUtils.damp(enemy.hitTilt || 0, 0, 7.5, delta);

    tmpVec2.set(player.x - pos.x, 0, player.z - pos.z);
    const distance = tmpVec2.length();
    if (distance > 0.001) tmpVec2.normalize();

    // Turn like a person instead of snapping instantly to the player.
    const desiredYaw = Math.atan2(tmpVec2.x, tmpVec2.z);
    const yawDelta = Math.atan2(Math.sin(desiredYaw - enemy.root.rotation.y), Math.cos(desiredYaw - enemy.root.rotation.y));
    enemy.root.rotation.y += yawDelta * Math.min(1, delta * (enemy.kind === 'elite' ? 5.2 : 6.2));

    let moving = false;
    if (distance > 3.65) {
      const advance = Math.min(enemy.speed * delta, Math.max(0, distance - 2.35));
      pos.addScaledVector(tmpVec2, advance);
      playEnemyAnimation(enemy, 'Run', true, 0.16);
      moving = true;
    } else if (distance > 2.55) {
      const advance = Math.min(enemy.speed * 0.55 * delta, Math.max(0, distance - 2.3));
      pos.addScaledVector(tmpVec2, advance);
      playEnemyAnimation(enemy, 'Walk', true, 0.18);
      moving = true;
    } else {
      if (now >= enemy.nextStrafe && now < enemy.nextAttack - 250) {
        enemy.strafeUntil = now + 420 + Math.random() * 520;
        enemy.nextStrafe = now + 1700 + Math.random() * 2200;
        if (Math.random() > 0.5) enemy.strafeSign *= -1;
      }

      if (now < enemy.strafeUntil) {
        const side = new THREE.Vector3(-tmpVec2.z, 0, tmpVec2.x).multiplyScalar(enemy.strafeSign);
        pos.addScaledVector(side, enemy.speed * 0.32 * delta);
        playEnemyAnimation(enemy, enemy.strafeSign > 0 ? 'Run_Right' : 'Run_Left', true, 0.14);
        moving = true;
      } else {
        playEnemyAnimation(enemy, 'Idle_Gun_Pointing', true, 0.18);
      }
    }

    if (distance < 6.5 && now >= enemy.nextAttack) {
      enemy.nextAttack = now + Math.max(720, 1500 - state.wave * 50) + Math.random() * 720;
      playEnemyAnimation(enemy, moving ? 'Run_Shoot' : 'Gun_Shoot', false, 0.08);
      setTimeout(() => {
        if (!enemy.dead && !gameEnded) {
          const currentDistance = enemy.root.position.distanceTo(getPlayerPosition(new THREE.Vector3()));
          const accuracy = THREE.MathUtils.clamp(0.86 - currentDistance * 0.045, 0.50, 0.80);
          if (Math.random() < accuracy) damagePlayer(6 + Math.min(state.wave, 8) * 0.7);
          playEnemyAnimation(enemy, 'Idle_Gun_Pointing', true, 0.13);
        }
      }, enemy.kind === 'elite' ? 240 : 210);
    }
  }
}
"""
if 'Turn like a person instead of snapping instantly to the player.' not in s:
    if old not in s:
        raise SystemExit('updateEnemies block not found')
    s = s.replace(old, new, 1)

old = """    ui.loadingText.textContent = 'تحميل شخصية SWAT...';
    enemyGltf = await loadGLTF(manifest.recommendedPrototype.enemy);
    enemyTemplate = enemyGltf.scene;
    normalizeCharacter(enemyTemplate, 1.20);

    ui.loadingText.textContent = 'تحميل المؤثرات والصوت...';
"""
new = """    ui.loadingText.textContent = 'تحميل شخصية SWAT...';
    enemyGltf = await loadGLTF(manifest.recommendedPrototype.enemy);
    enemyTemplate = enemyGltf.scene;
    normalizeCharacter(enemyTemplate, 1.20);

    ui.loadingText.textContent = 'تحميل SWAT Elite والحركات...';
    try {
      eliteGltf = await loadGLTF(ELITE_SWAT_PATH);
      eliteTemplate = eliteGltf.scene;
      normalizeCharacter(eliteTemplate, 1.20);
      eliteClips = buildEliteAnimationSet(enemyGltf, eliteGltf);
      console.info(`Elite SWAT ready with ${eliteClips.length} retargeted clips`);
    } catch (error) {
      console.warn('Elite SWAT disabled; standard SWAT remains available', error);
      eliteGltf = null;
      eliteTemplate = null;
      eliteClips = [];
    }

    ui.loadingText.textContent = 'تحميل المؤثرات والصوت...';
"""
if "تحميل SWAT Elite والحركات" not in s:
    if old not in s:
        raise SystemExit('init SWAT block not found')
    s = s.replace(old, new, 1)

p.write_text(s)

ap = Path('assets/config/assets.json')
data = json.loads(ap.read_text())
elite = 'assets/characters/humans/swat_elite_quest.glb'
humans = data.setdefault('characters', {}).setdefault('humans', [])
if elite not in humans:
    humans.append(elite)
data.setdefault('recommendedPrototype', {})['eliteEnemy'] = elite
ap.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
