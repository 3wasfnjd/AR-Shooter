import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const $ = (id) => document.getElementById(id);
const ui = {
  loading: $('loading'), loadingText: $('loadingText'), modeLabel: $('modeLabel'),
  healthBar: $('healthBar'), healthValue: $('healthValue'), ammoValue: $('ammoValue'),
  reserveValue: $('reserveValue'), scoreValue: $('scoreValue'), waveValue: $('waveValue'),
  hitMarker: $('hitMarker'), damageFlash: $('damageFlash'), message: $('message'),
  weaponButton: $('weaponButton'), weaponName: $('weaponName'), reloadButton: $('reloadButton'),
  startPanel: $('startPanel'), previewButton: $('previewButton'), arButtonMount: $('arButtonMount'),
  xrNote: $('xrNote'), gameOver: $('gameOver'), finalScore: $('finalScore'),
  restartButton: $('restartButton'), debug: $('debug')
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f16);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.01, 60);
camera.position.set(0, 1.62, 3.4);
camera.lookAt(0, 1.1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc9e4ff, 0x332718, 2.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(3, 6, 2);
scene.add(keyLight);

const previewWorld = new THREE.Group();
const previewFloor = new THREE.Mesh(
  new THREE.CircleGeometry(7, 64),
  new THREE.MeshStandardMaterial({ color: 0x17212c, roughness: 0.92, metalness: 0.02 })
);
previewFloor.rotation.x = -Math.PI / 2;
previewWorld.add(previewFloor);
const grid = new THREE.GridHelper(14, 28, 0x445464, 0x26323e);
grid.position.y = 0.004;
previewWorld.add(grid);
scene.add(previewWorld);

const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.085, 0.115, 40).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xf0ba3c, side: THREE.DoubleSide })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
for (const xrController of controllers) scene.add(xrController);
let activeController = controllers[0];
const weaponHolder = new THREE.Group();
weaponHolder.position.set(0.025, -0.07, -0.09);
weaponHolder.rotation.set(-0.05, Math.PI, 0);
activeController.add(weaponHolder);
const xrButtonState = new Map();

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpMat = new THREE.Matrix4();

let manifest;
let enemyGltf;
let enemyTemplate;
let muzzleTexture;
let impactTexture;
let hitTestSource = null;
let hitTestRequested = false;
let isAR = false;
let previewStarted = false;
let arenaPlaced = false;
let placementPoint = new THREE.Vector3(0, 0, 0);
let currentWeaponModel = null;
let weaponLoadToken = 0;
let messageTimer = null;
let hitTimer = null;
let damageTimer = null;
let nextWaveTimer = null;
let lastShotAt = 0;
let isReloading = false;
let gameEnded = false;

const enemies = [];
const audioCache = new Map();

const weaponProfiles = [
  { name: 'ASSAULT RIFLE', label: 'بندقية هجومية', file: 'assets/weapons/west/Rifle_Assault_West.glb', fire: 'assets/audio/weapons/rifle_fire.ogg', reload: 'assets/audio/weapons/reload_rifle.ogg', damage: 34, mag: 30, reserve: 120, delay: 115, length: 0.68 },
  { name: 'PISTOL', label: 'مسدس', file: 'assets/weapons/west/Pistol_Full_West.glb', fire: 'assets/audio/weapons/pistol_fire.ogg', reload: 'assets/audio/weapons/reload_pistol.ogg', damage: 38, mag: 15, reserve: 75, delay: 240, length: 0.34 },
  { name: 'PUMP SHOTGUN', label: 'شوزن', file: 'assets/weapons/west/Shotgun_Pump_West.glb', fire: 'assets/audio/weapons/shotgun_fire.ogg', reload: 'assets/audio/weapons/shotgun_pump.ogg', damage: 72, mag: 8, reserve: 40, delay: 720, length: 0.72 },
  { name: 'SNIPER RIFLE', label: 'قناصة', file: 'assets/weapons/west/Sniper_Rifle_West.glb', fire: 'assets/audio/weapons/sniper_fire.ogg', reload: 'assets/audio/weapons/reload_rifle.ogg', damage: 100, mag: 5, reserve: 25, delay: 900, length: 0.82 }
];

const state = {
  health: 100,
  score: 0,
  wave: 1,
  weaponIndex: 0,
  ammo: weaponProfiles[0].mag,
  reserve: weaponProfiles[0].reserve
};

function loadGLTF(url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function preloadAudio(url) {
  if (!url || audioCache.has(url)) return;
  const audio = new Audio(url);
  audio.preload = 'auto';
  audioCache.set(url, audio);
}

function playSound(url, volume = 0.7, rate = 1) {
  const base = audioCache.get(url);
  if (!base) return;
  const audio = base.cloneNode();
  audio.volume = volume;
  audio.playbackRate = rate;
  audio.play().catch(() => {});
}

function normalizeCharacter(model, targetHeight = 1.72) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 0.001) model.scale.multiplyScalar(targetHeight / size.y);
  model.updateMatrixWorld(true);
  const fixed = new THREE.Box3().setFromObject(model);
  const center = fixed.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fixed.min.y;
  model.updateMatrixWorld(true);
}

function normalizeWeapon(model, targetLength = 0.65) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (longest > 0.001) model.scale.multiplyScalar(targetLength / longest);
  model.updateMatrixWorld(true);
  const fixed = new THREE.Box3().setFromObject(model);
  const center = fixed.getCenter(new THREE.Vector3());
  model.position.sub(center);
}

function findClip(name) {
  if (!enemyGltf) return null;
  return enemyGltf.animations.find((clip) => clip.name.endsWith(`|${name}`)) ||
    enemyGltf.animations.find((clip) => clip.name.toLowerCase().includes(name.toLowerCase())) || null;
}

function playEnemyAnimation(enemy, name, loop = true, fade = 0.12) {
  if (!enemy?.mixer || enemy.dead) return;
  if (enemy.animName === name && loop) return;
  const clip = findClip(name);
  if (!clip) return;
  const next = enemy.mixer.clipAction(clip);
  next.reset();
  next.enabled = true;
  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  next.clampWhenFinished = !loop;
  if (enemy.action && enemy.action !== next) enemy.action.fadeOut(fade);
  next.fadeIn(fade).play();
  enemy.action = next;
  enemy.animName = name;
}

function updateHud() {
  ui.healthValue.textContent = Math.max(0, Math.round(state.health));
  ui.healthBar.style.width = `${Math.max(0, state.health)}%`;
  ui.ammoValue.textContent = state.ammo;
  ui.reserveValue.textContent = state.reserve;
  ui.scoreValue.textContent = state.score;
  ui.waveValue.textContent = state.wave;
  ui.weaponName.textContent = `${weaponProfiles[state.weaponIndex].name} · ${weaponProfiles[state.weaponIndex].label}`;
}

function showMessage(text, duration = 1800) {
  clearTimeout(messageTimer);
  ui.message.textContent = text;
  ui.message.classList.add('show');
  messageTimer = setTimeout(() => ui.message.classList.remove('show'), duration);
}

function showHitMarker() {
  clearTimeout(hitTimer);
  ui.hitMarker.classList.add('show');
  hitTimer = setTimeout(() => ui.hitMarker.classList.remove('show'), 85);
}

function showDamageFlash() {
  clearTimeout(damageTimer);
  ui.damageFlash.classList.add('show');
  damageTimer = setTimeout(() => ui.damageFlash.classList.remove('show'), 110);
}

function getPlayerPosition(target = new THREE.Vector3()) {
  if (renderer.xr.isPresenting) return renderer.xr.getCamera(camera).getWorldPosition(target);
  return camera.getWorldPosition(target);
}

function handLabel(controller) {
  const hand = controller?.userData?.handedness;
  if (hand === 'right') return 'اليمنى';
  if (hand === 'left') return 'اليسرى';
  return 'المختارة';
}

function setActiveController(controller, announce = false) {
  if (!controller) return;
  const changed = activeController !== controller || weaponHolder.parent !== controller;
  activeController = controller;
  controller.add(weaponHolder);
  const leftHand = controller.userData.handedness === 'left';
  weaponHolder.position.set(leftHand ? -0.025 : 0.025, -0.07, -0.09);
  weaponHolder.rotation.set(-0.05, Math.PI, 0);
  if (announce && changed && arenaPlaced) showMessage(`السلاح في اليد ${handLabel(controller)}`, 1100);
}

function cycleWeapon(controller = activeController) {
  setActiveController(controller, false);
  equipWeapon(state.weaponIndex + 1, true);
  showMessage('تم تغيير السلاح', 750);
}

async function equipWeapon(index, resetAmmo = true) {
  state.weaponIndex = (index + weaponProfiles.length) % weaponProfiles.length;
  const profile = weaponProfiles[state.weaponIndex];
  const token = ++weaponLoadToken;
  ui.weaponName.textContent = `تحميل ${profile.label}...`;
  try {
    const gltf = await loadGLTF(profile.file);
    if (token !== weaponLoadToken) return;
    const model = gltf.scene;
    normalizeWeapon(model, profile.length);
    model.rotation.set(0, Math.PI, 0);
    if (currentWeaponModel) weaponHolder.remove(currentWeaponModel);
    currentWeaponModel = model;
    weaponHolder.add(model);
    if (resetAmmo) {
      state.ammo = profile.mag;
      state.reserve = profile.reserve;
    }
    updateHud();
  } catch (error) {
    console.error('Weapon load failed', error);
    showMessage('تعذر تحميل السلاح');
  }
}

function clearEnemies() {
  while (enemies.length) {
    const enemy = enemies.pop();
    enemy.mixer?.stopAllAction();
    scene.remove(enemy.root);
  }
}

function createEnemy(position, index = 0) {
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

function spawnWave() {
  if (!arenaPlaced || gameEnded) return;
  clearTimeout(nextWaveTimer);
  const count = Math.min(2 + state.wave, 6);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.7;
    const radius = 1.25 + Math.random() * 1.45;
    const pos = placementPoint.clone().add(new THREE.Vector3(Math.sin(angle) * radius, 0, Math.cos(angle) * radius));
    createEnemy(pos, i);
  }
  showMessage(`الموجة ${state.wave} — عدد الجنود ${count}`, 1300);
  updateHud();
}

function startNextWaveIfReady() {
  if (gameEnded || enemies.some((enemy) => !enemy.dead) || nextWaveTimer) return;
  nextWaveTimer = setTimeout(() => {
    nextWaveTimer = null;
    state.wave += 1;
    updateHud();
    spawnWave();
  }, 1400);
}

function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.hp = 0;
  state.score += 1;
  updateHud();
  playSound('assets/audio/enemies/enemy_death.ogg', 0.62, 0.96 + Math.random() * 0.08);
  const clip = findClip('Death');
  if (clip) {
    const action = enemy.mixer.clipAction(clip);
    enemy.action?.fadeOut(0.08);
    action.reset().setLoop(THREE.LoopOnce, 1);
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
}

function hitEnemy(enemy, point) {
  if (!enemy || enemy.dead) return;
  const profile = weaponProfiles[state.weaponIndex];
  enemy.hp -= profile.damage;
  showHitMarker();
  playSound('assets/audio/ui/hit_confirm.ogg', 0.5, 1.05);
  playSound('assets/audio/enemies/enemy_hit.ogg', 0.42, 0.94 + Math.random() * 0.15);
  createImpact(point);
  if (enemy.hp <= 0) {
    killEnemy(enemy);
  } else {
    playEnemyAnimation(enemy, Math.random() > 0.5 ? 'HitRecieve' : 'HitRecieve_2', false, 0.05);
    setTimeout(() => {
      if (!enemy.dead) playEnemyAnimation(enemy, 'Idle_Gun', true, 0.08);
    }, 360);
  }
}

function createTracer(origin, end) {
  const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const material = new THREE.LineBasicMaterial({ color: 0xffd35b, transparent: true, opacity: 0.95 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  setTimeout(() => {
    scene.remove(line);
    geometry.dispose();
    material.dispose();
  }, 65);
}

function createMuzzleFlash(origin, direction) {
  if (!muzzleTexture) return;
  const material = new THREE.SpriteMaterial({ map: muzzleTexture, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(0.24);
  sprite.position.copy(origin).addScaledVector(direction, 0.34);
  scene.add(sprite);
  setTimeout(() => {
    scene.remove(sprite);
    material.dispose();
  }, 55);
}

function createImpact(point) {
  if (!impactTexture) return;
  const material = new THREE.SpriteMaterial({ map: impactTexture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(0.13);
  sprite.position.copy(point).addScalar(0.002);
  scene.add(sprite);
  setTimeout(() => {
    scene.remove(sprite);
    material.dispose();
  }, 850);
}

function getShotRay() {
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(0, 0, -1);
  if (renderer.xr.isPresenting) {
    activeController.getWorldPosition(origin);
    activeController.getWorldQuaternion(tmpQuat);
    direction.applyQuaternion(tmpQuat).normalize();
  } else {
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction).normalize();
  }
  return { origin, direction };
}

function shoot() {
  if (!arenaPlaced || gameEnded || isReloading) return;
  const profile = weaponProfiles[state.weaponIndex];
  const now = performance.now();
  if (now - lastShotAt < profile.delay) return;
  if (state.ammo <= 0) {
    playSound('assets/audio/weapons/empty_click.ogg', 0.65);
    reload();
    return;
  }

  lastShotAt = now;
  state.ammo -= 1;
  updateHud();
  playSound(profile.fire, 0.78, 0.97 + Math.random() * 0.05);

  const { origin, direction } = getShotRay();
  raycaster.set(origin, direction);
  raycaster.far = 16;
  const liveMeshes = [];
  for (const enemy of enemies) {
    if (!enemy.dead) enemy.model.traverse((obj) => { if (obj.isMesh) liveMeshes.push(obj); });
  }
  const hits = raycaster.intersectObjects(liveMeshes, false);
  const end = hits.length ? hits[0].point.clone() : origin.clone().addScaledVector(direction, 9);
  createMuzzleFlash(origin, direction);
  createTracer(origin, end);

  if (hits.length) hitEnemy(hits[0].object.userData.enemyRef, hits[0].point);
  if (state.ammo === 0 && state.reserve > 0) setTimeout(reload, 180);
}

function reload() {
  if (isReloading || gameEnded) return;
  const profile = weaponProfiles[state.weaponIndex];
  if (state.ammo >= profile.mag || state.reserve <= 0) return;
  isReloading = true;
  showMessage('جاري التلقيم...', 900);
  playSound(profile.reload, 0.62);
  setTimeout(() => {
    const needed = profile.mag - state.ammo;
    const moved = Math.min(needed, state.reserve);
    state.ammo += moved;
    state.reserve -= moved;
    isReloading = false;
    updateHud();
  }, profile.name.includes('SHOTGUN') ? 950 : 1150);
}

function damagePlayer(amount) {
  if (gameEnded) return;
  state.health = Math.max(0, state.health - amount);
  showDamageFlash();
  updateHud();
  if (state.health <= 0) endGame();
}

function endGame() {
  gameEnded = true;
  ui.finalScore.textContent = state.score;
  ui.gameOver.classList.remove('hidden');
  for (const enemy of enemies) enemy.mixer.timeScale = 0.2;
}

function resetGame() {
  clearTimeout(nextWaveTimer);
  nextWaveTimer = null;
  clearEnemies();
  state.health = 100;
  state.score = 0;
  state.wave = 1;
  const profile = weaponProfiles[state.weaponIndex];
  state.ammo = profile.mag;
  state.reserve = profile.reserve;
  isReloading = false;
  gameEnded = false;
  ui.gameOver.classList.add('hidden');
  updateHud();
  if (arenaPlaced) spawnWave();
}

function placeArena(point) {
  placementPoint.copy(point);
  // Quest uses local-floor reference space, where Y=0 is the physical floor.
  placementPoint.y = isAR ? 0 : point.y;
  arenaPlaced = true;
  reticle.visible = false;
  resetGame();
  showMessage('تم تثبيت الساحة — الزناد الآن للإطلاق', 2100);
}

function updateEnemies(delta) {
  if (!arenaPlaced || gameEnded) return;
  const player = getPlayerPosition(tmpVec);
  const now = performance.now();

  for (const enemy of enemies) {
    enemy.mixer.update(delta);
    if (enemy.dead) continue;

    const pos = enemy.root.position;
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

async function requestHitTest(session) {
  if (hitTestRequested) return;
  hitTestRequested = true;
  try {
    const viewerSpace = await session.requestReferenceSpace('viewer');
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  } catch (error) {
    console.warn('Hit test unavailable', error);
    showMessage('تعذر تشغيل اكتشاف الأرضية');
  }
}

function updateHitTest(frame) {
  if (!isAR || arenaPlaced || !frame) return;
  const session = renderer.xr.getSession();
  if (!hitTestRequested && session) requestHitTest(session);
  if (!hitTestSource) return;
  const refSpace = renderer.xr.getReferenceSpace();
  const results = frame.getHitTestResults(hitTestSource);
  if (results.length) {
    const pose = results[0].getPose(refSpace);
    reticle.visible = true;
    reticle.matrix.fromArray(pose.transform.matrix);
  } else {
    reticle.visible = false;
  }
}

function startPreview() {
  isAR = false;
  previewStarted = true;
  previewWorld.visible = true;
  scene.background = new THREE.Color(0x0a0f16);
  ui.startPanel.classList.add('hidden');
  ui.modeLabel.textContent = 'وضع المعاينة';
  camera.position.set(0, 1.62, 3.4);
  camera.lookAt(0, 1.05, 0);
  placeArena(new THREE.Vector3(0, 0, -0.15));
  showMessage('المعاينة: اضغط في الشاشة للإطلاق', 2200);
}

function setupARButton() {
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test', 'local-floor'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.body }
  });
  button.textContent = 'دخول AR';
  ui.arButtonMount.appendChild(button);

  if (!navigator.xr) ui.xrNote.textContent = 'WebXR غير متاح في هذا المتصفح. استخدم Quest Browser لتجربة AR.';
}

renderer.xr.addEventListener('sessionstart', async () => {
  isAR = true;
  previewStarted = false;
  arenaPlaced = false;
  hitTestSource = null;
  hitTestRequested = false;
  clearEnemies();
  scene.background = null;
  previewWorld.visible = false;
  document.body.classList.add('xr-session-active');
  ui.startPanel.classList.add('hidden');
  ui.modeLabel.textContent = 'AR مباشر';
  xrButtonState.clear();
  showMessage('وجّه المؤشر للأرض واضغط الزناد. بعدها: الزناد إطلاق، Grip ينقل السلاح بين اليدين، A/X أو ضغط العصا يغيّر السلاح، B/Y تلقيم', 5200);
  const session = renderer.xr.getSession();
  if (session) await requestHitTest(session);
});

renderer.xr.addEventListener('sessionend', () => {
  isAR = false;
  arenaPlaced = false;
  hitTestSource?.cancel?.();
  hitTestSource = null;
  hitTestRequested = false;
  reticle.visible = false;
  clearEnemies();
  scene.background = new THREE.Color(0x0a0f16);
  previewWorld.visible = true;
  document.body.classList.remove('xr-session-active');
  ui.startPanel.classList.remove('hidden');
  ui.modeLabel.textContent = 'وضع المعاينة';
});

for (const xrController of controllers) {
  xrController.addEventListener('connected', (event) => {
    xrController.userData.inputSource = event.data;
    xrController.userData.handedness = event.data.handedness || 'none';
    // Prefer the right hand on connection, but either hand can take control at any time.
    if (event.data.handedness === 'right') setActiveController(xrController, false);
  });

  xrController.addEventListener('disconnected', () => {
    xrController.userData.inputSource = null;
    xrController.userData.handedness = 'none';
  });

  xrController.addEventListener('squeeze', () => {
    if (!isAR) return;
    setActiveController(xrController, true);
  });

  xrController.addEventListener('select', () => {
    if (!isAR) return;
    setActiveController(xrController, arenaPlaced);
    if (!arenaPlaced) {
      if (reticle.visible) {
        tmpVec.setFromMatrixPosition(reticle.matrix);
        placeArena(tmpVec);
      } else {
        showMessage('حرّك الجهاز حتى يتم اكتشاف سطح الأرض');
      }
      return;
    }
    shoot();
  });
}

function updateXRButtons() {
  if (!isAR || !renderer.xr.isPresenting) return;
  for (let index = 0; index < controllers.length; index++) {
    const xrController = controllers[index];
    const gamepad = xrController.userData.inputSource?.gamepad;
    if (!gamepad?.buttons) continue;

    const previous = xrButtonState.get(index) || { switchWeapon: false, reload: false };
    // Quest Touch: thumbstick click or A/X cycles weapons; B/Y reloads.
    const switchWeapon = Boolean(gamepad.buttons[3]?.pressed || gamepad.buttons[4]?.pressed);
    const reloadPressed = Boolean(gamepad.buttons[5]?.pressed);

    if (switchWeapon && !previous.switchWeapon && arenaPlaced && !gameEnded) {
      setActiveController(xrController, true);
      cycleWeapon(xrController);
    }
    if (reloadPressed && !previous.reload && arenaPlaced && !gameEnded) {
      setActiveController(xrController, true);
      reload();
    }

    xrButtonState.set(index, { switchWeapon, reload: reloadPressed });
  }
}

ui.previewButton.addEventListener('click', startPreview);
ui.reloadButton.addEventListener('click', reload);
ui.weaponButton.addEventListener('click', () => cycleWeapon(activeController));
ui.restartButton.addEventListener('click', resetGame);

document.addEventListener('pointerdown', (event) => {
  if (isAR || !previewStarted || event.target.closest('button')) return;
  shoot();
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') shoot();
  if (event.code === 'KeyR') reload();
  if (event.code === 'KeyQ') equipWeapon(state.weaponIndex + 1, true);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function render(_time, frame) {
  const delta = Math.min(clock.getDelta(), 0.05);
  updateHitTest(frame);
  updateXRButtons();
  updateEnemies(delta);
  renderer.render(scene, camera);
}

async function init() {
  try {
    ui.loadingText.textContent = 'قراءة قائمة الأصول...';
    const response = await fetch('./assets/config/assets.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Asset manifest ${response.status}`);
    manifest = await response.json();

    ui.loadingText.textContent = 'تحميل شخصية SWAT...';
    enemyGltf = await loadGLTF(manifest.recommendedPrototype.enemy);
    enemyTemplate = enemyGltf.scene;
    normalizeCharacter(enemyTemplate, 1.72);

    ui.loadingText.textContent = 'تحميل المؤثرات والصوت...';
    muzzleTexture = await textureLoader.loadAsync(manifest.recommendedPrototype.muzzleFlash);
    impactTexture = await textureLoader.loadAsync(manifest.recommendedPrototype.impact);
    muzzleTexture.colorSpace = THREE.SRGBColorSpace;
    impactTexture.colorSpace = THREE.SRGBColorSpace;

    for (const category of Object.values(manifest.audio || {})) {
      for (const file of category) preloadAudio(file);
    }

    setupARButton();
    await equipWeapon(0, true);
    updateHud();
    renderer.setAnimationLoop(render);

    ui.loadingText.textContent = 'جاهز';
    setTimeout(() => ui.loading.classList.add('done'), 220);
    setTimeout(() => ui.loading.classList.add('hidden'), 650);
  } catch (error) {
    console.error(error);
    ui.loadingText.textContent = 'تعذر تشغيل اللعبة. افتح Console لمعرفة الخطأ.';
    ui.loading.querySelector('.loader-ring')?.classList.add('hidden');
  }
}

init();
