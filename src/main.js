import { Game } from './game/Game.js';

const appEl = document.getElementById('app');
const overlay = document.getElementById('overlay');
const button = document.getElementById('enter-ar');
const previewButton = document.getElementById('preview-link');
const statusLine = document.getElementById('status-line');

function setStatus(msg) {
  statusLine.textContent = msg;
}

function fail(label, err) {
  console.error(label, err);
  button.disabled = true;
  button.textContent = 'Something went wrong';
  const detail = err?.message ? `: ${err.message}` : '';
  setStatus(`${label}${detail} (open devtools/logcat for the full error)`);
}

// Surface anything that goes wrong on-screen: a Quest headset usually has no
// devtools attached, so silent JS errors previously just left the button
// stuck on its initial "Checking WebXR…" state with no clue why.
window.addEventListener('error', (event) => {
  fail('Script error', event.error || new Error(event.message));
});
window.addEventListener('unhandledrejection', (event) => {
  fail('Unhandled promise rejection', event.reason);
});

async function boot() {
  let game;
  try {
    game = new Game(appEl);
    window.__game = game; // debug console access
  } catch (err) {
    fail('Failed to initialize the WebXR renderer', err);
    return;
  }

  setStatus('Loading assets…');
  const assetsReady = game.preloadAssets();

  // Wired up-front (not gated on WebXR support) so a plain desktop browser
  // can still preview weapons/soldiers/VFX - see DesktopPreview.js. Only
  // needs assets loaded, not an AR session.
  previewButton.addEventListener('click', async () => {
    previewButton.disabled = true;
    previewButton.textContent = 'Loading…';
    try {
      await assetsReady;
      game.startPreview();
      overlay.classList.add('hidden');
    } catch (err) {
      console.error(err);
      previewButton.disabled = false;
      previewButton.textContent = 'Preview in browser (no headset)';
      setStatus(`Preview failed${err?.message ? `: ${err.message}` : ''}`);
    }
  });

  try {
    await assetsReady;
  } catch (err) {
    fail('Failed to load game assets', err);
    return;
  }

  if (!navigator.xr) {
    button.textContent = 'WebXR not available';
    setStatus('Open this page in the Meta Quest Browser for AR, or try the preview below.');
    return;
  }

  setStatus('Checking AR support…');
  let supported;
  try {
    supported = await game.xrApp.checkArSupport();
  } catch (err) {
    fail('Failed to query WebXR support', err);
    return;
  }
  if (!supported) {
    button.textContent = 'AR not supported on this device';
    setStatus('This experience requires a Meta Quest 3 in the Quest Browser, served over HTTPS or localhost.');
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
      setStatus(`Could not start AR session${err?.message ? `: ${err.message}` : ''}`);
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
