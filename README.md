# AR-Shooter

AR / WebXR room-scale shooter prototype.

## Runtime asset pack
- 3 human GLB characters, including SWAT.
- 8 additional rigged/animated enemy GLBs.
- 20 GLB firearms: pistols, rifles, SMGs, shotguns and sniper rifles.
- Original firing/reload/mechanical OGG sounds plus 12 CC0 footsteps.
- Enemy hit/death and hit-confirm audio.
- Muzzle flash, smoke, bullet-impact and tracer VFX.
- Crosshair and hit-marker HUD graphics.
- `assets/config/assets.json` — paths for game code.
- `assets/config/model_metadata.json` — detected skins/meshes/animation names from character GLBs.
- `assets/ASSET_SOURCES.md` and `assets/licenses/` — provenance/license records.

The first prototype will use hitscan/raycast shooting rather than creating a physics body for every bullet.
