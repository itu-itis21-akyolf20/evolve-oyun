// UI test: stealth statistics — do aggroed melee enemies >4 away stop chasing when hidden?
T.start('normal');
const G = EV.Game, P = G.player, I = EV.Input, W = EV.World;
const step = (n) => { for (let i = 0; i < n; i++) { G.time += 1 / 30; EV.tick(1 / 30); I.endFrame(); } };
EV.Enemies.clearAll(G); G.spawnTimer = 1e9; G.apexTimer = 1e9; G.build.picks = 0; P.iframe = 1e9;
const defs = EV.MOBS.ENEMIES ? EV.MOBS.ENEMIES[0] : null;
const keys = Object.keys(EV.MOBS);
const pool = (EV.MOBS.ENEMIES || EV.MOBS.MOBS || [])[0] || [];
const def = pool.find((d) => d.behavior === 'aggressive');
function trial(hide) {
  EV.Enemies.clearAll(G);
  const c = W.covers[1];
  const cx = hide ? c.x : c.x + 30, cz = c.z;
  P.group.position.set(cx, W.groundY(cx, cz), cz); P.vel.set(0,0,0);
  P.lastCombatT = hide ? -99 : G.time; step(2);
  const es = [];
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; const e = EV.Enemies.make(G, def, { pos: { x: cx + Math.sin(a) * 9, z: cz + Math.cos(a) * 9 } }); e.aggroT = 3; es.push(e); }
  const d = () => es.reduce((s, e) => s + EV.Creature.surfDist(e.group, P.group.position.x, P.group.position.z), 0) / es.length;
  const d0 = d(); step(90); const d3 = d(); step(90);
  return { hidden: P.hidden, avgD0: +d0.toFixed(2), avgD3s: +d3.toFixed(2), avgD6s: +d(), within4: es.filter((e) => EV.Creature.surfDist(e.group, P.group.position.x, P.group.position.z) < 4).length };
}
return { keys, def: def && def.name, hidden: trial(true), visible: trial(false), hidden2: trial(true) };
