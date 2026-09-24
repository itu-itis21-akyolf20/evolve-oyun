// Menzilli temel saldırı: sağ tık basılıyken sol tık mermi atar, yakın dövüşten zayıf
T.start('normal');
T.sim(1, { dt: 1 / 30 });
const G = EV.Game, P = G.player, I = EV.Input;
const def = EV.MOBS.ENEMIES[0][1];
const pp = P.group.position;
const mk = (d) => { const e = EV.Enemies.make(G, def, { pos: { x: pp.x + Math.sin(P.aimYaw) * d, z: pp.z + Math.cos(P.aimYaw) * d }, hp: 1e6, dmg: 0 }); e.behavior = 'passive'; e.speed = 0; return e; };
const run = (ranged, d) => {
  G.enemies.slice().forEach((e) => { if (!e.ally) e.alive && EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
  const e = mk(d); P.lockTarget = e; P.hp = P.stats.maxHp;
  const d0 = G.stats.totalDmg;
  I.mouse.left = true; I.mouse.right = ranged;
  const ep = e.group.position.clone(), p0 = pp.clone();
  T.sim(10, { dt: 1 / 30, bot: false, until: () => { e.group.position.x = ep.x; e.group.position.z = ep.z; e.knock.set(0, 0, 0); pp.x = p0.x; pp.z = p0.z; P.impulse.set(0, 0, 0); return false; } });
  I.mouse.left = I.mouse.right = false;
  return { dps: Math.round((G.stats.totalDmg - d0) / 10), dist: Math.round(e.group.position.distanceTo(pp)), hp: Math.round(P.hp) };
};
return { melee: run(false, 2), rangedNear: run(true, 3), rangedFar: run(true, 18), dmgStat: P.stats.dmg };
