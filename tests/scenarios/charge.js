// Uzak atış şarjı: tık = zayıf, tam şarj = güçlü + delici; saniyelik hasar yakın dövüşten düşük kalır
T.start('normal');
T.sim(1, { dt: 1 / 30 });
const G = EV.Game, P = G.player, I = EV.Input;
const def = EV.MOBS.ENEMIES[0][1];
const pp = P.group.position;
const clearAll = () => G.enemies.slice().forEach((e) => { if (!e.ally && e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
const setup = (d) => {
  clearAll();
  const e = EV.Enemies.make(G, def, { pos: { x: pp.x + Math.sin(P.aimYaw) * d, z: pp.z + Math.cos(P.aimYaw) * d }, hp: 1e6, dmg: 0 });
  e.behavior = 'passive'; e.speed = 0; P.lockTarget = e; P.hp = P.stats.maxHp;
  const ep = e.group.position.clone(), p0 = pp.clone();
  return () => { e.group.position.x = ep.x; e.group.position.z = ep.z; e.knock.set(0, 0, 0); pp.x = p0.x; pp.z = p0.z; P.impulse.set(0, 0, 0); return false; };
};
const shot = (hold) => {
  const pin = setup(12);
  const d0 = G.stats.totalDmg;
  I.mouse.right = true; I.mouse.left = true;
  T.sim(hold, { dt: 1 / 30, bot: false, until: pin });
  const fullShown = document.getElementById('crosshair').classList.contains('full');
  I.mouse.left = false;
  T.sim(1.2, { dt: 1 / 30, bot: false, until: pin });
  I.mouse.right = false;
  return { dmg: Math.round(G.stats.totalDmg - d0), fullShown };
};
const dps = (holdEach) => {
  const pin = setup(12);
  const d0 = G.stats.totalDmg;
  I.mouse.right = true;
  let t = 0;
  while (t < 10) { I.mouse.left = true; T.sim(holdEach, { dt: 1 / 30, bot: false, until: pin }); I.mouse.left = false; T.sim(0.1, { dt: 1 / 30, bot: false, until: pin }); t += holdEach + 0.1; }
  T.sim(1, { dt: 1 / 30, bot: false, until: pin });
  I.mouse.right = false;
  return Math.round((G.stats.totalDmg - d0) / t);
};
return { tap: shot(0.05), half: shot(0.55), full: shot(1.1), dpsTap: dps(0.05), dpsFull: dps(1.05), dmgStat: P.stats.dmg };
