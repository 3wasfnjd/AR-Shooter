# AR-Shooter

Playable browser-based AR / WebXR room shooter prototype using Three.js.

## Current playable prototype
- WebXR `immersive-ar` entry with floor hit-testing.
- Aim at a detected floor and press the XR trigger once to place the combat area.
- SWAT enemies spawn around the selected room position.
- Enemies walk toward the player, aim, fire and damage the player.
- Hitscan/raycast shooting with muzzle flash, tracer, impact and hit-marker feedback.
- Enemy hit, death, run, idle, aiming and shooting animations use clips already embedded in the SWAT GLB.
- Health, ammo, reserve ammo, score and wave systems.
- Reloading and automatic next-wave spawning.
- Four selectable weapons: assault rifle, pistol, pump shotgun and sniper rifle.
- Desktop/mobile preview mode for testing without a headset.
- Game-over and restart flow.

## Controls
### Meta Quest / WebXR AR
1. Open the site in a WebXR-compatible browser.
2. Press **دخول AR**.
3. Move the headset/controller until the floor reticle appears.
4. Aim the reticle at the floor and press the trigger once to place the arena.
5. After placement, the trigger fires the weapon.
6. Use the HUD buttons when DOM Overlay is supported to reload or change weapon.

### Desktop preview
- Press **تشغيل المعاينة**.
- Mouse/touch on the scene: fire.
- `Space`: fire.
- `R`: reload.
- `Q`: change weapon.

## Runtime assets
- 3 human GLB characters, including SWAT.
- 8 additional rigged/animated enemy GLBs.
- 20 GLB firearms.
- Original firing/reload/mechanical OGG sounds plus 12 CC0 footsteps.
- Enemy hit/death and hit-confirm audio.
- Muzzle flash, smoke, bullet-impact and tracer VFX.
- Crosshair and hit-marker HUD graphics.
- `assets/config/assets.json` — paths for game code.
- `assets/config/model_metadata.json` — detected skins/meshes/animation names.
- `assets/ASSET_SOURCES.md` and `assets/licenses/` — provenance/license records.

## Project files
- `index.html` — browser entry point and HUD.
- `styles.css` — responsive interface.
- `src/main.js` — renderer, WebXR placement, weapons, enemy AI, combat and waves.
- `.github/workflows/validate.yml` — checks JavaScript syntax and required runtime files on every push.

Three.js is pinned to `0.186.0` through an import map so GitHub Pages can run the project without a build step.
