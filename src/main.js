import { Game } from './game/Game.js';

const appEl = document.getElementById('app');
const overlay = document.getElementById('overlay');
const button = document.getElementById('enter-ar');
const statusLine = document.getElementById('status-line');

function setStatus(msg) {
  statusLine.textContent = msg;
}

async function boot() {
  const game = new Game(appEl);

  if (!navigator.xr) {
    button.textContent = 'WebXR not available';
    setStatus('Open this page in the Meta Quest Browser.');
    return;
  }

  setStatus('Loading assets…');
  try {
    await game.preloadAssets();
  } catch (err) {
    console.error(err);
    setStatus('Failed to load game assets — check console.');
    return;
  }

  const supported = await game.xrApp.checkArSupport();
  if (!supported) {
    button.textContent = 'AR not supported on this device';
    setStatus('This experience requires a Meta Quest 3 in the Quest Browser.');
    return;
  }

  button.disabled = false;
  button.textContent = 'Enter AR';
  setStatus('Stand in a clear area with a few meters of open floor.');

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Starting…';
    try {
      await game.start(overlay);
      overlay.classList.add('hidden');
    } catch (err) {
      console.error(err);
      button.disabled = false;
      button.textContent = 'Enter AR';
      setStatus('Could not start AR session — see console for details.');
    }
  });

  game.xrApp.onSessionEnd(() => {
    overlay.classList.remove('hidden');
    button.disabled = false;
    button.textContent = 'Enter AR';
    setStatus('Session ended.');
  });
}

boot();
