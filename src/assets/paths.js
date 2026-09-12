// Central registry of every runtime asset, served from the repo's assets/
// tree (mounted at "/" by vite.config.js -> publicDir: 'assets').
//
// Paths are prefixed with Vite's BASE_URL (not hardcoded to "/") because
// this app isn't always served from a domain root - e.g. a GitHub Pages
// project site serves it under "/<repo-name>/". BASE_URL is "/" in dev and
// resolves to whatever `base` is set to in vite.config.js for a build.
const BASE = import.meta.env.BASE_URL;
const p = (path) => `${BASE}${path}`;

export const CHARACTERS = {
  soldier: p('characters/humans/swat.glb'),
  elite: p('characters/humans/swat_elite_quest.glb')
};

// Stylized "Fortnite-closer" weapon pass: Kenney's Blaster Kit 2.1 (CC0,
// www.kenney.nl) replacing the earlier realistic SkinnedMesh weapon pack.
// Every model here is a plain static Mesh (no skeleton/bones at all,
// unlike the old pack) and the whole kit is consistently authored with its
// barrel along local -Z and no baked rotation needed - see gunOrient.js's
// orientKenneyBlaster for how these are positioned/oriented at runtime.
export const WEAPON_MODELS = {
  pistol: p('weapons/kenney/Blaster_Pistol.glb'),
  smg: p('weapons/kenney/Blaster_SMG.glb'),
  rifle: p('weapons/kenney/Blaster_Rifle.glb'),
  shotgun: p('weapons/kenney/Blaster_Shotgun.glb'),
  sniper: p('weapons/kenney/Blaster_Sniper.glb'),
  // used as the enemy's carried weapon (scaled down with the enemy)
  enemyRifle: p('weapons/kenney/Blaster_Enemy.glb')
};

export const AUDIO = {
  weapons: {
    pistol: p('audio/weapons/pistol_fire.ogg'),
    smg: p('audio/weapons/rifle_fire.ogg'),
    rifle: p('audio/weapons/rifle_fire.ogg'),
    shotgun: p('audio/weapons/shotgun_fire.ogg'),
    sniper: p('audio/weapons/sniper_fire.ogg'),
    emptyClick: p('audio/weapons/empty_click.ogg'),
    reloadPistol: p('audio/weapons/reload_pistol.ogg'),
    reloadRifle: p('audio/weapons/reload_rifle.ogg'),
    shotgunPump: p('audio/weapons/shotgun_pump.ogg')
  },
  enemy: {
    hit: p('audio/enemies/enemy_hit.ogg'),
    death: p('audio/enemies/enemy_death.ogg')
  },
  ui: {
    hitConfirm: p('audio/ui/hit_confirm.ogg')
  },
  footsteps: [
    p('audio/footsteps/Fantozzi-SandL1.ogg'),
    p('audio/footsteps/Fantozzi-SandL2.ogg'),
    p('audio/footsteps/Fantozzi-SandL3.ogg'),
    p('audio/footsteps/Fantozzi-SandR1.ogg'),
    p('audio/footsteps/Fantozzi-SandR2.ogg'),
    p('audio/footsteps/Fantozzi-SandR3.ogg'),
    p('audio/footsteps/Fantozzi-StoneL1.ogg'),
    p('audio/footsteps/Fantozzi-StoneL2.ogg'),
    p('audio/footsteps/Fantozzi-StoneL3.ogg'),
    p('audio/footsteps/Fantozzi-StoneR1.ogg'),
    p('audio/footsteps/Fantozzi-StoneR2.ogg'),
    p('audio/footsteps/Fantozzi-StoneR3.ogg')
  ]
};

export const VFX = {
  muzzleFlash: p('effects/muzzle_flash.svg'),
  smoke: p('effects/smoke.svg'),
  tracer: p('effects/tracer.svg'),
  bulletImpact: p('effects/bullet_impact.svg')
};

export const UI = {
  crosshair: p('ui/crosshair.svg'),
  hitMarker: p('ui/hit_marker.svg')
};
