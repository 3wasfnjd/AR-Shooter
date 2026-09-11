// No portal/ambience recordings exist in assets/audio (only weapon, footstep,
// enemy and UI one-shots were provided). These two atmospheric sounds are
// synthesized procedurally at startup via OfflineAudioContext rendering so
// the game still has audio cues for enemy breaches and combat ambience
// without inventing fake "asset files".

function offlineCtx(durationSec, sampleRate) {
  const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new Ctor(1, Math.ceil(durationSec * sampleRate), sampleRate);
}

function whiteNoiseBuffer(ctx, durationSec) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * durationSec), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Rising energy sweep + metallic tail: a tactical breach/portal-open cue. */
export async function synthPortalOpen(sampleRate) {
  const duration = 0.85;
  const ctx = offlineCtx(duration, sampleRate);

  const sweep = ctx.createOscillator();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(70, 0);
  sweep.frequency.exponentialRampToValueAtTime(920, duration * 0.55);
  sweep.frequency.exponentialRampToValueAtTime(340, duration);

  const sweepFilter = ctx.createBiquadFilter();
  sweepFilter.type = 'lowpass';
  sweepFilter.frequency.setValueAtTime(300, 0);
  sweepFilter.frequency.exponentialRampToValueAtTime(4200, duration * 0.6);
  sweepFilter.Q.value = 4;

  const sweepGain = ctx.createGain();
  sweepGain.gain.setValueAtTime(0.0001, 0);
  sweepGain.gain.exponentialRampToValueAtTime(0.55, duration * 0.5);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, duration);

  sweep.connect(sweepFilter).connect(sweepGain).connect(ctx.destination);

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = whiteNoiseBuffer(ctx, duration);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1800;
  noiseFilter.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, 0);
  noiseGain.gain.exponentialRampToValueAtTime(0.4, 0.06);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, 0.4);
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);

  sweep.start(0);
  sweep.stop(duration);
  noiseSrc.start(0);

  return ctx.startRendering();
}

/** Low sustained combat-ambience drone, seamlessly loopable. */
export async function synthAmbienceLoop(sampleRate) {
  const duration = 6.0;
  const ctx = offlineCtx(duration, sampleRate);

  const drone = ctx.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 52;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.12;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.05;
  lfo.connect(lfoGain).connect(droneGain.gain);

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = whiteNoiseBuffer(ctx, duration);
  noiseSrc.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 220;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.05;

  drone.connect(droneGain).connect(ctx.destination);
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);

  drone.start(0);
  lfo.start(0);
  noiseSrc.start(0);
  drone.stop(duration);
  lfo.stop(duration);

  return ctx.startRendering();
}
