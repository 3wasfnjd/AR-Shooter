import * as THREE from 'three';
import { loadAudioBuffer } from '../assets/AssetLoader.js';
import { AUDIO } from '../assets/paths.js';
import { synthPortalOpen, synthAmbienceLoop, synthWhistle } from './synth.js';
import { choice } from '../utils/math.js';

const MAX_VOICES = 24;

/**
 * Wraps THREE.AudioListener/PositionalAudio. Every one-shot borrows a
 * PositionalAudio node from a small round-robin pool (attached to whatever
 * Object3D triggered the sound) so gunfire/hits/footsteps from many enemies
 * at once never leak nodes or thrash the audio graph.
 */
export class AudioManager {
  constructor(xrApp) {
    this.xrApp = xrApp;
    this.listener = new THREE.AudioListener();
    xrApp.camera.add(this.listener);
    this.ctx = this.listener.context;

    this.voices = [];
    this._voiceCursor = 0;
    for (let i = 0; i < MAX_VOICES; i++) {
      const voice = new THREE.PositionalAudio(this.listener);
      voice.setRefDistance(0.6);
      voice.setRolloffFactor(1.4);
      voice.setDistanceModel('inverse');
      voice.setMaxDistance(30);
      voice.setVolume(1);
      this.voices.push(voice);
    }

    this.synth = {};
    this._synthReady = this._prepareSynthBuffers();

    this.masterAmbience = null;
  }

  async _prepareSynthBuffers() {
    const [portal, ambience, whistle] = await Promise.all([
      synthPortalOpen(this.ctx.sampleRate),
      synthAmbienceLoop(this.ctx.sampleRate),
      synthWhistle(this.ctx.sampleRate)
    ]);
    this.synth.portalOpen = portal;
    this.synth.ambience = ambience;
    this.synth.whistle = whistle;
  }

  async startAmbience(volume = 0.35) {
    await this._synthReady;
    if (this.masterAmbience || !this.synth.ambience) return;
    const audio = new THREE.Audio(this.listener);
    audio.setBuffer(this.synth.ambience);
    audio.setLoop(true);
    audio.setVolume(volume);
    audio.play();
    this.masterAmbience = audio;
  }

  stopAmbience() {
    this.masterAmbience?.stop();
    this.masterAmbience = null;
  }

  _nextVoice() {
    this._voiceCursor = (this._voiceCursor + 1) % this.voices.length;
    const voice = this.voices[this._voiceCursor];
    if (voice.isPlaying) voice.stop();
    if (voice.parent) voice.parent.remove(voice);
    return voice;
  }

  /** Plays a one-shot buffer positioned at (attached to) `object3d`. */
  async playAt(path, object3d, { volume = 1, detune = 0, refDistance } = {}) {
    if (!object3d) return null;
    const buffer = await loadAudioBuffer(path);
    if (!buffer) return null;
    const voice = this._nextVoice();
    voice.setBuffer(buffer);
    voice.setVolume(volume);
    if (refDistance) voice.setRefDistance(refDistance);
    if (voice.detune !== undefined) voice.detune = detune;
    object3d.add(voice);
    voice.position.set(0, 0, 0);
    voice.play();
    return voice;
  }

  async playPortalOpen(object3d, volume = 0.8) {
    await this._synthReady;
    if (!this.synth.portalOpen) return;
    const voice = this._nextVoice();
    voice.setBuffer(this.synth.portalOpen);
    voice.setVolume(volume);
    voice.setRefDistance(1.2);
    object3d.add(voice);
    voice.position.set(0, 0, 0);
    voice.play();
  }

  /** The "begin assault" signal - non-positional so it reads clearly over combat ambience regardless of where the player is looking. */
  async playWhistle(volume = 0.9) {
    await this._synthReady;
    if (!this.synth.whistle) return;
    const audio = new THREE.Audio(this.listener);
    audio.setBuffer(this.synth.whistle);
    audio.setVolume(volume);
    audio.play();
  }

  /** Non-positional UI sound (HUD feedback, player got hit, etc). */
  async playUI(path, volume = 0.7) {
    const buffer = await loadAudioBuffer(path);
    if (!buffer) return;
    const audio = new THREE.Audio(this.listener);
    audio.setBuffer(buffer);
    audio.setVolume(volume);
    audio.play();
  }

  playFootstep(object3d, surface = 'stone', volume = 0.5) {
    const pool = AUDIO.footsteps.filter((p) => p.toLowerCase().includes(surface));
    const path = choice(pool.length ? pool : AUDIO.footsteps);
    this.playAt(path, object3d, { volume, refDistance: 0.5 });
  }
}
