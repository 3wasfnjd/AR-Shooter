# Miniature Ops — Quest 3 AR Shooter

A WebXR (`immersive-ar`) passthrough shooter built with Three.js: realistic
~50–60cm miniature soldiers breach your real room through tactical portals
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

## Desktop preview (no headset)

`npm run dev` and open the page in any regular browser (phone, tablet, or
desktop), then tap/click **Preview in browser (no headset)** — this skips
WebXR entirely and runs the exact same game (weapons, soldiers, waves,
VFX, HUD) with a fly-camera in front of a placeholder floor grid instead
of a real room. See `src/core/DesktopPreview.js`. Useful for iterating on
anything visual without a Quest attached.

On-screen buttons appear automatically (work by touch or mouse click):

- **Joystick** (bottom-left): move/strafe.
- **Drag anywhere else on screen**: look around.
- **FIRE** (bottom-right, big red button): hold to fire.
- **◀ WPN / WPN ▶**: cycle weapon. **RELOAD**. **SWAP HANDS**: switch
  which hand holds the gun.
- **▲ / ▼** (top-right): fly up/down.

A keyboard also works alongside the on-screen controls: **WASD** to move,
**Space**/**Ctrl** up/down, **Shift** to run, **left mouse** = gun-hand
trigger, **right mouse** = off-hand trigger (both together = the
calibration-mode gesture), **Q/E** = cycle weapon, **R** = reload, **H** =
swap hands, **arrow keys** = gun-hand stick (yaw/height in calibration),
**T/G** = off-hand stick Y, **R/F** and **[ ]** = the two hands' A/B
buttons.

This is also how the soldier-scale and enemy-weapon-attachment bugs
described below were actually found and confirmed fixed — `window.__game`
is exposed for poking at from the browser console (e.g.
`__game.enemies.soldiers[0].model.scale`).

## Controls

Controls follow whichever hand is currently holding the gun (default:
right), not a fixed hand — see the hand-swap control below.

- **Gun-hand trigger**: fire the held weapon (also confirms menus).
- **Off-hand thumbstick flick, or off-hand "B"**: cycle weapon (Pistol →
  SMG → Assault Rifle → Shotgun → Sniper).
- **Off-hand "A"**: reload.
- **Either thumbstick click**: swap which hand holds the gun.
- **Hold both triggers ~0.6s**: toggle weapon-grip calibration (see
  below). Hold again to exit.
- The off-hand wrist carries a status panel (weapon, ammo, wave, score,
  health) and always follows whichever hand is currently the off-hand.

At the start of a session you're in a weapon-select browse: cycle through
weapons (the actual 3D model updates in your hand so you can look it
over), then pull the trigger to confirm and start
Wave 1.

### Calibrating the weapon grip

Every weapon's hand offset/orientation started as a guess (see **Known
simplifications**) — feedback from the first on-device test was that guess
was visibly wrong. Rather than guess again blindly, hold both triggers for
about 0.6 seconds to enter **calibration mode**: firing is disabled, and
you can nudge the currently-held weapon in real time:

- **Off-hand thumbstick**: move left/right and forward/back.
- **Gun-hand thumbstick**: move up/down, and yaw (rotate around vertical).
- **Off-hand A / B**: pitch down / up in 15° steps.
- **Gun-hand A / B**: roll in 15° steps.

The wrist panel shows the live `pos:[x,y,z] rot:[x,y,z]` numbers as you
adjust. Once a weapon looks right in-hand, read those numbers off and drop
them into that weapon's `grip: { pos: [...], rotDeg: [...] }` entry in
`src/weapons/WeaponDefs.js` (each weapon needs calibrating separately —
cycling weapons mid-calibration keeps you in calibration mode so you can
do all five in one session). Hold both triggers again to exit.

## How this maps to the brief

- **Miniature realistic soldiers, not cartoonish/robotic/full-size** —
  `assets/characters/humans/swat.glb` is scaled at runtime, from a bone
  landmark measurement (see **Known simplifications**, not a hardcoded
  factor, so it's robust to the source asset's authored units), to
  0.50–0.55m; `swat_elite_quest.glb` to 0.55–0.60m (nudged above the
  brief's 35-45cm after on-device feedback that smaller figures were hard
  to spot; the desktop preview also surfaced a real geometry factor -
  standing eye height versus a floor-level target means close range
  demands a steep, unnatural downward look angle, so engagement distance
  was widened back out rather than tightened further). See
  `src/enemies/SoldierTypes.js` and `EnemyManager`.
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
  rifle glb is parented directly onto the soldier's `WristR` bone at
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
  horizontal axis = barrel, grip pivot ~38% back from the muzzle end), and
  character "front" is assumed from a configurable `facingOffsetDeg`. This
  guess was confirmed wrong on the first on-device test, so rather than
  keep guessing blind, there's now an in-headset **calibration mode** (hold
  both triggers ~0.6s — see the README section above) to nudge the grip
  into place live and read back exact numbers for `WeaponDefs.js`. If
  soldiers appear to walk backwards toward the player, `facingOffsetDeg` in
  `src/enemies/SoldierTypes.js` is the equivalent knob for that (no
  in-headset tool for it yet).
- **`Box3.setFromObject()` silently lies about a `SkinnedMesh`'s size** —
  this was a real, now-fixed bug, not a caveat: it measures the raw
  geometry vertex buffer, which for a skinned character lives in an
  unposed reference space that bone matrices deform at render time. It
  has nothing to do with final on-screen size. This made the enemy scale
  factor ~100x too small (soldiers rendering at a few millimeters despite
  a correct-looking `heightRange`) until it was caught with the desktop
  preview + a manual bone-position bounding-box dump. The fix,
  `measureRigHeight`/`scaleRigToHeight` in `src/utils/math.js`, measures
  distance between named bone/landmark nodes (skull-top to toe-tip)
  instead, which isn't skinning-dependent. If a future character asset
  renders at the wrong scale, suspect this before anything else.
- **glTF strips `.`/`:` from node names on load.** `assets/config/
  rig_metadata.json` documents bone names with separators (Blender/Mixamo
  convention: `"UpperArm.L"`, `"mixamorig:Head_05"`), but the live-loaded
  glb has them stripped (`"UpperArmL"`, `"mixamorigHead_05"`) — confirmed
  by traversing a loaded instance, not assumed. This silently broke the
  enemy weapon-hand attachment (wrong bone name → `_attachWeapon` found
  nothing → no exception, no visible weapon) and 4 of 7 hurtboxes on the
  regular soldier. `SoldierTypes.js` now uses the real stripped names and
  says so in a comment; trust that file over `rig_metadata.json` if they
  disagree again.
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
