# Miniature Ops — Quest 3 AR Shooter

A WebXR (`immersive-ar`) passthrough shooter built with Three.js: realistic
~35–45cm miniature soldiers breach your real room through tactical portals
and attack from multiple directions while you fight back with five distinct
hand-held weapons. Built entirely on the assets already in `assets/`.

## Running it on a Quest 3

WebXR's `immersive-ar` requires a "secure context" (HTTPS, or `localhost`).
The fastest path is ADB port-forwarding, which makes the headset treat the
dev server as `localhost` — no certificates needed:

```bash
npm install
npm run dev              # starts Vite on http://localhost:5173

# with the Quest 3 connected over USB (USB debugging enabled) and adb
# available (Android platform-tools, or Meta Quest Developer Hub):
adb reverse tcp:5173 tcp:5173
```

Then, in the Quest Browser, open `http://localhost:5173`. Tap **Enter AR**
and grant the passthrough/camera permission prompt.

Alternatively, for a build you can open without a tether, run
`npm run build`, host the `dist/` folder behind any HTTPS static host, and
open that URL in the Quest Browser.

Stand in a clear area with a few meters of open floor before entering AR —
the game does not (yet) query Quest's Scene/Room mesh, so it doesn't know
where your furniture actually is (see **Known simplifications** below).

## Controls

- **Right trigger**: fire the held weapon (also confirms menus).
- **Left thumbstick, flick left/right**: cycle weapon (Pistol → SMG →
  Assault Rifle → Shotgun → Sniper).
- **Left "A" button**: reload.
- The left wrist carries a status panel (weapon, ammo, wave, score, health).

At the start of a session you're in a weapon-select browse: cycle through
weapons with the left stick (the actual 3D model updates in your hand so
you can look it over), then pull the right trigger to confirm and start
Wave 1.

## How this maps to the brief

- **Miniature realistic soldiers, not cartoonish/robotic/full-size** —
  `assets/characters/humans/swat.glb` is scaled at runtime (via bounding-box
  measurement, not a hardcoded factor, so it's robust to the source asset's
  authored units) to 0.36–0.40m; `swat_elite_quest.glb` to 0.42–0.46m. See
  `src/enemies/SoldierTypes.js`.
- **Both SWAT characters used, Elite reads as higher-tier** — `swat.glb` is
  the fully animated rank-and-file soldier; `swat_elite_quest.glb` (which
  ships as a static, un-animated Sketchfab mesh with its rifle fused into
  the geometry — see **Known simplifications**) is leaned into as a
  tougher, more mechanically precise unit instead of fought against.
- **Five weapons, each with a distinct feel** — Pistol, SMG, Assault Rifle,
  Shotgun (pellet spread + pump lockout), Sniper (bolt-action lockout, huge
  damage, tight spread) — `src/weapons/WeaponDefs.js` tunes fire rate,
  recoil curve, spread, haptics, and VFX per weapon independently.
- **Enemies visibly carry correctly-proportioned weapons** — the enemy
  rifle glb is parented directly onto the soldier's `Wrist.R` bone at
  identity scale, so it inherits the same uniform scale-down factor as the
  body — see the comment in `Soldier._attachWeapon`.
- **Realistic, non-robotic movement** — driven by `swat.glb`'s real
  animation set (Idle/Walk/Run/Run_Back/Run_Left/Run_Right/Idle_Gun_Shoot/
  Run_Shoot/HitRecieve ×2/Roll/Death/…), crossfaded rather than snapped, in
  `src/enemies/Soldier.js`.
- **Tactical combat behavior** — a per-soldier FSM (spawn → alert →
  reposition/strafe/retreat → aim → shoot / shoot-while-moving → reload →
  cover → hit-react → dodge → death) in `Soldier.js`, orchestrated per-wave
  by `src/game/Game.js`. Soldiers are assigned spread-out approach sectors
  so a squad attacks from multiple directions rather than balling up.
- **Room integration** — soldiers spawn/stand exactly at floor height
  (WebXR `local-floor` reference space) and never float or appear at eye
  level. See **Known simplifications** for what this does *not* do (real
  furniture occlusion).
- **Polished arrival effect** — `src/vfx/PortalEffect.js`: an additive
  ring/disc breach flash + brief point light, capped at 3 concurrent lights
  for mobile GPU headroom, soldiers materialize by scaling up out of it
  (see **Known simplifications** for why scale-up was chosen over rising
  through the floor).
- **Strong, weapon-differentiated shooting feedback** — muzzle flash,
  smoke, tracers and impact sparks (`src/vfx/EffectsSystem.js`) all reuse
  `assets/effects/*.svg` as sprite/quad textures, sized/timed per weapon;
  recoil is a per-shot impulse damped back to rest; haptics intensity/
  duration also differ per weapon (`WeaponDefs.js`).
- **Varied hit reactions and deaths** — hit zone (head/chest/hips/arms/
  legs) comes from closest-hurtbox raycasting, with a headshot damage
  multiplier; `HitRecieve`/`HitRecieve_2` are chosen by front/side, and
  roughly every third hit triggers a `Roll` dodge instead. Death direction
  (fall backward/forward/sideways) is derived from the dot/cross product of
  the soldier's facing vs. the shot's travel direction and applied as a
  procedural tip-over on top of the single `Death` clip (see
  `Soldier._die`); a soldier that was sprinting gets a momentum-slide phase
  before the tip-over ("stumble").
- **Audio** — all weapon/reload/footstep/enemy sounds are the provided
  `assets/audio/*.ogg` files, played through `THREE.PositionalAudio` so
  enemy gunfire is spatially locatable. Portal and combat-ambience sounds
  have no corresponding asset files, so they're synthesized procedurally at
  startup via `OfflineAudioContext` (`src/audio/synth.js`) rather than
  faked as asset files that don't exist.
- **Haptics** — per-weapon intensity/duration on fire; a shared pulse on
  both controllers when the player takes damage.
- **Game flow / progression** — `src/game/Game.js`: weapon select → waves
  with growing regular-soldier counts, Elites introduced from wave 3,
  staggered per-soldier spawn timing capped at 7 concurrent (performance),
  a small between-wave heal, score with headshot/Elite bonuses, and a
  restartable game-over screen.
- **Performance** — every recurring VFX (flash/smoke/tracer/impact/portal)
  is pooled (`src/utils/ObjectPool.js`), hit detection is analytic
  sphere-vs-ray against a handful of per-soldier hurtboxes (no per-triangle
  mesh raycasting), and concurrent alive enemies are capped.

## Known simplifications (and why)

These are deliberate, documented trade-offs given the constraints of
building this without a live on-device preview or Quest Scene API access:

- **No real furniture/room-mesh awareness.** Quest 3's Scene API (plane/
  mesh detection with semantic labels) would be the "correct" way to place
  cover behind real furniture. This build instead generates a ring of
  virtual cover points anchored to the room the first time you start a
  wave (`EnemyManager._makeCoverPoints` / `recenter`), which soldiers path
  to and peek from. Swapping in real anchors later is a matter of feeding
  `EnemyManager.coverPoints` from the Scene API instead.
- **Weapon/mesh forward-axis orientation is heuristic, not hand-verified.**
  Every glb's "barrel forward" is inferred from its bounding box (longest
  horizontal axis = barrel), and character "front" is assumed from a
  configurable `facingOffsetDeg`. If a weapon's muzzle flash appears at the
  wrong end, or soldiers appear to walk backwards toward the player, these
  are the first two knobs to flip — see the comments atop
  `src/weapons/WeaponDefs.js` and `SOLDIER_TYPES` in
  `src/enemies/SoldierTypes.js`. This wasn't possible to verify without a
  Quest headset in the loop.
- **`swat_elite_quest.glb` ships with zero animation clips** (it's a static
  bind-pose Sketchfab mesh with its rifle fused into the geometry, per
  `assets/config/model_metadata.json`). Rather than treat this as broken,
  the Elite is a rigid unit that translates/rotates as a whole and fires
  from its own fused muzzle geometry — see the comment in
  `SoldierTypes.js`.
- **Enemy fire against the player is probabilistic, not a physical
  raycast against a player collider.** Each shot rolls hit/miss from the
  soldier's accuracy stat (Elites are more accurate); a tracer is still
  drawn from the enemy's actual muzzle toward the player for visual/audio
  spatial feedback either way. A literal raycast against a moving XR
  camera collider was judged not worth the complexity for the fidelity it
  would add.
- **No screen-space HUD.** A single-pass `immersive-ar` session doesn't
  have an easy 2D screen overlay, so the crosshair/hit-marker are
  world-space sprites held a fixed distance in front of the weapon muzzle
  (standard VR-shooter technique), and score/health/ammo live on a
  wrist-mounted panel instead of a screen corner.
- **Player damage feedback is visual+haptic, not audio.** No "player was
  hit" sound asset exists in `assets/audio`; feedback is a camera-attached
  red vignette flash plus a haptic pulse on both controllers, which reads
  clearly in an immersive headset without inventing a fake asset file.

## Project layout

```
src/
  core/       XR session bootstrap, controller/gamepad input polling
  assets/     asset path registry + cached glTF/texture/audio loading
  weapons/    weapon tuning data, orientation heuristic, WeaponSystem
  vfx/        pooled muzzle flash/smoke/tracer/impact + portal breach effect
  audio/      PositionalAudio wrapper + procedural portal/ambience synthesis
  enemies/    Soldier (rig, hurtboxes, FSM, hit/death logic), EnemyManager
  ui/         world-space HUD (crosshair, hit marker, vignette, wrist panel)
  game/       Game: wiring, wave composition, scoring, win/lose flow
  utils/      math helpers, generic object pool
```

## Tech

Three.js + WebXR, bundled with Vite. `vite.config.js` mounts `assets/` as
the dev/build static root so every path in `src/assets/paths.js` matches
the existing `assets/**` tree exactly — no assets were moved or renamed.
