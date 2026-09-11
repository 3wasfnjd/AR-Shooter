from pathlib import Path

p = Path('src/main.js')
s = p.read_text()

if 'let enemyWeaponTemplate;' not in s:
    s = s.replace(
        "let eliteTemplate;\nlet standardClips = [];",
        "let eliteTemplate;\nlet standardClips = [];\nlet enemyWeaponTemplate;"
    )

if 'function attachEnemyWeapon(enemy)' not in s:
    marker = "function normalizeWeapon(model, targetLength = 0.65) {"
    idx = s.index(marker)
    end = s.index("\n}\n\nfunction findClip", idx) + 2
    block = s[idx:end]
    insert = block + """

function findBone(root, names) {
  for (const name of names) {
    const bone = root.getObjectByName(name);
    if (bone) return bone;
  }
  return null;
}

function attachEnemyWeapon(enemy) {
  if (!enemyWeaponTemplate || !enemy?.model) return null;

  const hand = enemy.kind === 'elite'
    ? findBone(enemy.model, ['mixamorig:RightHand_033', 'mixamorig:RightHand'])
    : findBone(enemy.model, ['Wrist.R', 'RightHand']);
  if (!hand) {
    console.warn(`Enemy weapon hand bone not found for ${enemy.kind}`);
    return null;
  }

  const weapon = enemyWeaponTemplate.clone(true);
  weapon.name = 'Enemy_Rifle';
  weapon.userData.enemyWeapon = true;
  weapon.position.set(0.015, -0.008, -0.055);
  weapon.rotation.set(-0.10, Math.PI, Math.PI / 2);

  weapon.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      child.userData.enemyWeapon = true;
      child.userData.enemyRef = null;
    }
  });

  hand.add(weapon);
  enemy.weapon = weapon;
  enemy.weaponHand = hand;
  return weapon;
}
"""
    s = s[:idx] + insert + s[end:]

old = """  playEnemyAnimation(enemy, 'Idle_Gun', true, 0.18);
  enemies.push(enemy);
  return enemy;
}"""
new = """  attachEnemyWeapon(enemy);
  playEnemyAnimation(enemy, 'Idle_Gun', true, 0.18);
  enemies.push(enemy);
  return enemy;
}"""
if old in s and 'attachEnemyWeapon(enemy);' not in s[s.index('function createEnemy'):s.index('function spawnWave')]:
    s = s.replace(old, new, 1)

old = """    for (const category of Object.values(manifest.audio || {})) {
      for (const file of category) preloadAudio(file);
    }

    setupARButton();"""
new = """    for (const category of Object.values(manifest.audio || {})) {
      for (const file of category) preloadAudio(file);
    }

    ui.loadingText.textContent = 'تجهيز أسلحة الجنود...';
    const enemyWeaponGltf = await loadGLTF('assets/weapons/west/Rifle_Assault_West.glb');
    enemyWeaponTemplate = enemyWeaponGltf.scene;
    normalizeWeapon(enemyWeaponTemplate, 0.18);

    setupARButton();"""
if old in s and "normalizeWeapon(enemyWeaponTemplate, 0.18)" not in s:
    s = s.replace(old, new, 1)

old = """  for (const enemy of enemies) {
    if (!enemy.dead) enemy.model.traverse((obj) => { if (obj.isMesh) liveMeshes.push(obj); });
  }"""
new = """  for (const enemy of enemies) {
    if (!enemy.dead) enemy.model.traverse((obj) => {
      if (obj.isMesh && !obj.userData.enemyWeapon) liveMeshes.push(obj);
    });
  }"""
if old in s:
    s = s.replace(old, new, 1)

required = [
    'let enemyWeaponTemplate;',
    'function attachEnemyWeapon(enemy)',
    'attachEnemyWeapon(enemy);',
    'normalizeWeapon(enemyWeaponTemplate, 0.18)',
    '!obj.userData.enemyWeapon'
]
for token in required:
    if token not in s:
        raise SystemExit(f'missing expected token after patch: {token}')

p.write_text(s)
