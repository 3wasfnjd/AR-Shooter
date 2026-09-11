from pathlib import Path

p = Path('src/main.js')
s = p.read_text()

def replace(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'{label} not found')
    s = s.replace(old, new)

s = s.replace('normalizeCharacter(enemyTemplate, 1.72);', 'normalizeCharacter(enemyTemplate, 1.20);')

replace(
"""function hitEnemy(enemy, point) {
  if (!enemy || enemy.dead) return;
  const profile = weaponProfiles[state.weaponIndex];
  enemy.hp -= profile.damage;
""",
"""function hitEnemy(enemy, point, shotDirection = null) {
  if (!enemy || enemy.dead) return;
  const profile = weaponProfiles[state.weaponIndex];
  enemy.hp -= profile.damage;

  // Small directional body reaction so impacts do not look robotic.
  if (shotDirection) {
    const worldQuat = enemy.root.getWorldQuaternion(new THREE.Quaternion());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQuat);
    const side = Math.sign(right.dot(shotDirection)) || (Math.random() > 0.5 ? 1 : -1);
    enemy.hitTilt = side * (0.10 + Math.random() * 0.08);
    enemy.root.position.addScaledVector(shotDirection, 0.025 + Math.random() * 0.02);
  }
""",
'hitEnemy signature')

replace(
"if (hits.length) hitEnemy(hits[0].object.userData.enemyRef, hits[0].point);",
"if (hits.length) hitEnemy(hits[0].object.userData.enemyRef, hits[0].point, direction);",
'shoot hit call')

replace(
"""    root, model, mixer, action: null, animName: '', hp: 100, dead: false,
    speed: 0.62 + Math.min(state.wave, 6) * 0.035 + Math.random() * 0.12,
""",
"""    root, model, mixer, action: null, animName: '', hp: 100, dead: false,
    hitTilt: 0,
    speed: 0.62 + Math.min(state.wave, 6) * 0.035 + Math.random() * 0.12,
""",
'enemy object')

replace(
"""    action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(0.06).play();
    enemy.action = action;
  }
  setTimeout(() => {
    scene.remove(enemy.root);
    const idx = enemies.indexOf(enemy);
    if (idx >= 0) enemies.splice(idx, 1);
    startNextWaveIfReady();
  }, 1900);
""",
"""    action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = 0.88 + Math.random() * 0.18;
    action.fadeIn(0.06).play();
    enemy.action = action;
  }

  // Vary the final lean slightly and keep bodies visible for several seconds.
  enemy.hitTilt += (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.08);
  setTimeout(() => {
    scene.remove(enemy.root);
    const idx = enemies.indexOf(enemy);
    if (idx >= 0) enemies.splice(idx, 1);
    startNextWaveIfReady();
  }, 7800 + Math.random() * 2200);
""",
'death block')

replace(
"""    const pos = enemy.root.position;
    tmpVec2.set(player.x - pos.x, 0, player.z - pos.z);
""",
"""    const pos = enemy.root.position;
    enemy.root.rotation.z = THREE.MathUtils.damp(enemy.root.rotation.z, enemy.hitTilt || 0, 12, delta);
    enemy.hitTilt = THREE.MathUtils.damp(enemy.hitTilt || 0, 0, enemy.dead ? 1.1 : 7.5, delta);
    tmpVec2.set(player.x - pos.x, 0, player.z - pos.z);
""",
'enemy update')

p.write_text(s)
