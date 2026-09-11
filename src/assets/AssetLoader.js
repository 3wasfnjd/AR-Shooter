import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
// Reuse three.js's shared AudioContext singleton so decoded buffers play
// cleanly through THREE.AudioListener / THREE.PositionalAudio nodes.
const audioCtx = THREE.AudioContext.getContext();

const gltfCache = new Map(); // path -> Promise<GLTF>
const textureCache = new Map(); // path -> Promise<Texture>
const audioBufferCache = new Map(); // path -> Promise<AudioBuffer>

/** Loads (and caches) a glTF. Returns the raw GLTF result (do not mutate the scene directly). */
export function loadGLTF(path) {
  if (!gltfCache.has(path)) {
    gltfCache.set(
      path,
      new Promise((resolve, reject) => {
        gltfLoader.load(path, resolve, undefined, (err) => {
          console.error(`[AssetLoader] failed to load glTF: ${path}`, err);
          reject(err);
        });
      })
    );
  }
  return gltfCache.get(path);
}

/**
 * Loads a glTF and returns a fresh, independently-animatable clone of its
 * scene graph (skeleton-aware) plus the source animation clips.
 */
export async function instantiateGLTF(path) {
  const gltf = await loadGLTF(path);
  const scene = cloneSkeleton(gltf.scene);
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.frustumCulled = true;
    }
  });
  return { scene, animations: gltf.animations };
}

export function loadTexture(path) {
  if (!textureCache.has(path)) {
    textureCache.set(
      path,
      new Promise((resolve, reject) => {
        textureLoader.load(
          path,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            resolve(tex);
          },
          undefined,
          reject
        );
      })
    );
  }
  return textureCache.get(path);
}

export function getAudioContext() {
  return audioCtx;
}

export function loadAudioBuffer(path) {
  if (!audioBufferCache.has(path)) {
    audioBufferCache.set(
      path,
      fetch(path)
        .then((r) => r.arrayBuffer())
        .then((buf) => audioCtx.decodeAudioData(buf))
        .catch((err) => {
          console.error(`[AssetLoader] failed to decode audio: ${path}`, err);
          return null;
        })
    );
  }
  return audioBufferCache.get(path);
}

/** Kick off loading for a list of glTF/audio/texture paths without blocking. */
export function preload({ gltfs = [], textures = [], audio = [] } = {}) {
  return Promise.all([
    ...gltfs.map(loadGLTF),
    ...textures.map(loadTexture),
    ...audio.map(loadAudioBuffer)
  ]);
}
