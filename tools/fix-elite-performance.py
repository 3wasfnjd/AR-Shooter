from pathlib import Path
p=Path('src/main.js')
s=p.read_text()

s=s.replace("renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));", "renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));")

s=s.replace("const TOY_SOLDIER_HEIGHT = 0.42;\nconst GROUND_SINK = 0.008;", "const TOY_SOLDIER_HEIGHT = 0.42;\nconst ELITE_TOY_HEIGHT = 0.38;\nconst GROUND_SINK = 0.008;\nconst MAX_ACTIVE_ENEMIES = 4;\nconst CORPSE_LIFETIME_MS = 3200;")

# Make Elite load non-fatal and always keep template when GLB loads.
old="""      eliteGltf = await loadGLTF(ELITE_SWAT_PATH);\n      eliteTemplate = eliteGltf.scene;\n      normalizeCharacter(eliteTemplate, TOY_SOLDIER_HEIGHT);\n      const testRig = createElitePoseRig(eliteTemplate);\n      if (Object.keys(testRig.bones).length < 8) throw new Error('Elite Mixamo rig bones not found');\n      console.info(`Elite toy soldier ready with ${Object.keys(testRig.bones).length} procedural bones`);"""
new="""      eliteGltf = await loadGLTF(ELITE_SWAT_PATH);\n      eliteTemplate = eliteGltf.scene;\n      normalizeCharacter(eliteTemplate, ELITE_TOY_HEIGHT);\n      eliteTemplate.traverse((obj) => {\n        obj.visible = true;\n        if (obj.isMesh) {\n          obj.frustumCulled = false;\n          if (obj.material) {\n            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];\n            for (const mat of mats) {\n              mat.transparent = false;\n              mat.opacity = 1;\n              mat.depthWrite = true;\n            }\n          }\n        }\n      });\n      const testRig = createElitePoseRig(eliteTemplate);\n      console.info(`Elite toy soldier loaded with ${Object.keys(testRig.bones).length} procedural bones`);"""
if old not in s: raise SystemExit('elite init block not found')
s=s.replace(old,new,1)

# Only one Elite per wave, guaranteed first slot if template loaded.
s=s.replace("const useElite = eliteReady && (index === 0 || (state.wave > 1 && Math.random() < 0.32));", "const useElite = eliteReady && index === 0;")

# Force clone visible and normalize Elite clone again as a safety net.
old="""  const model = SkeletonUtils.clone(template);\n  const root = new THREE.Group();"""
new="""  const model = SkeletonUtils.clone(template);\n  if (useElite) {\n    normalizeCharacter(model, ELITE_TOY_HEIGHT);\n    model.traverse((obj) => { obj.visible = true; if (obj.isMesh) obj.frustumCulled = false; });\n  }\n  const root = new THREE.Group();"""
if old not in s: raise SystemExit('clone block not found')
s=s.replace(old,new,1)

# Cache hit meshes at spawn instead of traversing high-poly characters on every shot.
old="""  model.traverse((child) => {\n    if (child.isMesh) {\n      child.frustumCulled = false;\n      child.userData.enemyRef = enemy;\n    }\n  });"""
new="""  enemy.hitMeshes = [];\n  model.traverse((child) => {\n    if (child.isMesh) {\n      child.frustumCulled = false;\n      child.userData.enemyRef = enemy;\n      if (!child.userData.enemyWeapon) enemy.hitMeshes.push(child);\n    }\n  });"""
if old not in s: raise SystemExit('mesh traversal block not found')
s=s.replace(old,new,1)

# Weapon is attached after hit list build; ensure it never enters hit cache (already true) and simplify if needed.
# Cap wave size for Quest stability.
s=s.replace("const count = Math.min(2 + state.wave, 6);", "const count = Math.min(2 + state.wave, MAX_ACTIVE_ENEMIES);")

# Shorter corpse lifetime and store timer so it can be cancelled.
old="""  setTimeout(() => {\n    scene.remove(enemy.root);\n    const idx = enemies.indexOf(enemy);\n    if (idx >= 0) enemies.splice(idx, 1);\n    startNextWaveIfReady();\n  }, 7800 + Math.random() * 2200);"""
new="""  enemy.removeTimer = setTimeout(() => {\n    scene.remove(enemy.root);\n    const idx = enemies.indexOf(enemy);\n    if (idx >= 0) enemies.splice(idx, 1);\n    startNextWaveIfReady();\n  }, CORPSE_LIFETIME_MS);"""
if old not in s: raise SystemExit('corpse timer block not found')
s=s.replace(old,new,1)

# Clear delayed corpse timers on reset/session changes.
old="""    enemy.mixer?.stopAllAction();\n    scene.remove(enemy.root);"""
new="""    enemy.mixer?.stopAllAction();\n    if (enemy.removeTimer) clearTimeout(enemy.removeTimer);\n    scene.remove(enemy.root);"""
if old not in s: raise SystemExit('clearEnemies block not found')
s=s.replace(old,new,1)

# Replace per-shot traversal with cached arrays.
old="""  const liveMeshes = [];\n  for (const enemy of enemies) {\n    if (!enemy.dead) enemy.model.traverse((obj) => {\n      if (obj.isMesh && !obj.userData.enemyWeapon) liveMeshes.push(obj);\n    });\n  }"""
new="""  const liveMeshes = [];\n  for (const enemy of enemies) {\n    if (!enemy.dead && enemy.hitMeshes) liveMeshes.push(...enemy.hitMeshes);\n  }"""
if old not in s: raise SystemExit('shoot traversal block not found')
s=s.replace(old,new,1)

# Bound concurrent audio clones to avoid runaway media objects on Quest.
old="""function playSound(url, volume = 0.7, rate = 1) {\n  const base = audioCache.get(url);\n  if (!base) return;\n  const audio = base.cloneNode();\n  audio.volume = volume;\n  audio.playbackRate = rate;\n  audio.play().catch(() => {});\n}"""
new="""let activeAudioCount = 0;\nfunction playSound(url, volume = 0.7, rate = 1) {\n  const base = audioCache.get(url);\n  if (!base || activeAudioCount >= 10) return;\n  const audio = base.cloneNode();\n  audio.volume = volume;\n  audio.playbackRate = rate;\n  activeAudioCount += 1;\n  const release = () => { activeAudioCount = Math.max(0, activeAudioCount - 1); };\n  audio.addEventListener('ended', release, { once: true });\n  audio.addEventListener('error', release, { once: true });\n  audio.play().catch(() => release());\n}"""
if old not in s: raise SystemExit('playSound block not found')
s=s.replace(old,new,1)

p.write_text(s)
