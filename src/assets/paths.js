// Central registry of every runtime asset, served from the repo's assets/
// tree (mounted at "/" by vite.config.js -> publicDir: 'assets').

export const CHARACTERS = {
  soldier: '/characters/humans/swat.glb',
  elite: '/characters/humans/swat_elite_quest.glb'
};

export const WEAPON_MODELS = {
  pistol: '/weapons/west/Pistol_Full_West.glb',
  smg: '/weapons/west/SMG_Full_West.glb',
  rifle: '/weapons/west/Rifle_Assault_West.glb',
  shotgun: '/weapons/west/Shotgun_Pump_West.glb',
  sniper: '/weapons/west/Sniper_Rifle_West.glb',
  // used as the enemy's carried weapon (scaled down with the enemy)
  enemyRifle: '/weapons/east/Rifle_Assault_East.glb',
  enemyEliteRifle: '/weapons/east/Rifle_Battle_East.glb'
};

export const AUDIO = {
  weapons: {
    pistol: '/audio/weapons/pistol_fire.ogg',
    smg: '/audio/weapons/rifle_fire.ogg',
    rifle: '/audio/weapons/rifle_fire.ogg',
    shotgun: '/audio/weapons/shotgun_fire.ogg',
    sniper: '/audio/weapons/sniper_fire.ogg',
    emptyClick: '/audio/weapons/empty_click.ogg',
    reloadPistol: '/audio/weapons/reload_pistol.ogg',
    reloadRifle: '/audio/weapons/reload_rifle.ogg',
    shotgunPump: '/audio/weapons/shotgun_pump.ogg'
  },
  enemy: {
    hit: '/audio/enemies/enemy_hit.ogg',
    death: '/audio/enemies/enemy_death.ogg'
  },
  ui: {
    hitConfirm: '/audio/ui/hit_confirm.ogg'
  },
  footsteps: [
    '/audio/footsteps/Fantozzi-SandL1.ogg',
    '/audio/footsteps/Fantozzi-SandL2.ogg',
    '/audio/footsteps/Fantozzi-SandL3.ogg',
    '/audio/footsteps/Fantozzi-SandR1.ogg',
    '/audio/footsteps/Fantozzi-SandR2.ogg',
    '/audio/footsteps/Fantozzi-SandR3.ogg',
    '/audio/footsteps/Fantozzi-StoneL1.ogg',
    '/audio/footsteps/Fantozzi-StoneL2.ogg',
    '/audio/footsteps/Fantozzi-StoneL3.ogg',
    '/audio/footsteps/Fantozzi-StoneR1.ogg',
    '/audio/footsteps/Fantozzi-StoneR2.ogg',
    '/audio/footsteps/Fantozzi-StoneR3.ogg'
  ]
};

export const VFX = {
  muzzleFlash: '/effects/muzzle_flash.svg',
  smoke: '/effects/smoke.svg',
  tracer: '/effects/tracer.svg',
  bulletImpact: '/effects/bullet_impact.svg'
};

export const UI = {
  crosshair: '/ui/crosshair.svg',
  hitMarker: '/ui/hit_marker.svg'
};
