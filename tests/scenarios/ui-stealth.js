// UI test: hiding in covers
T.start('normal');
const G = EV.Game, P = G.player, I = EV.Input, W = EV.World;
const step = (n) => { for (let i = 0; i < n; i++) { G.time += 1 / 30; EV.tick(1 / 30); I.endFrame(); } };
EV.Enemies.clearAll(G); G.spawnTimer = 1e9; G.apexTimer = 1e9; G.build.picks = 0; P.iframe = 1e9;
EV.Enemies.spawnPack(G);
const aggressiveDef = G.enemies.map((e) => e.def).find((d) => (d.behavior || 'aggressive') === 'aggressive') || G.enemies[0].def;
EV.Enemies.clearAll(G);
const c = W.covers[0];
const out = { cover: { x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: +c.r.toFixed(1) }, def: aggressiveDef.name };
P.group.position.set(c.x, W.groundY(c.x, c.z), c.z);
P.lastCombatT = G.time; step(1);
out.inCover = !!P.cover;
// enemy at 9 units, already aggroed
const ex = c.x + 9, ez = c.z;
const e = EV.Enemies.make(G, aggressiveDef, { pos: { x: ex, z: ez } }); e.aggroT = 3;
const dist = () => +EV.Creature.surfDist(e.group, P.group.position.x, P.group.position.z).toFixed(2);
out.d0 = dist();
step(15); out.at05s = { hidden: P.hidden, d: dist() };
step(60); out.at2_5s = { hidden: P.hidden, chip: !document.getElementById('hideChip').hidden, d: dist(), aggroT: +e.aggroT.toFixed(2) };
const dd = []; for (let i = 0; i < 6; i++) { step(15); dd.push(dist()); } out.distOverNext3s = dd;
// enemy teleported to 3 units: should detect
e.group.position.set(c.x + 2.5 + e.radius, W.groundY(c.x + 3, c.z), c.z); step(30);
out.close = { hidden: P.hidden, d: dist(), hpLost: +(P.stats.maxHp - P.hp).toFixed(1) };
// attacking breaks it
e.group.position.set(c.x + 12, W.groundY(c.x + 12, c.z), c.z); P.lastCombatT = -99; step(3);
out.beforeAttack = P.hidden;
I.mouse.left = true; step(2); I.mouse.left = false; step(2);
out.afterAttack = { hidden: P.hidden, chip: !document.getElementById('hideChip').hidden };
// hiding during boss fight disabled
P.lastCombatT = -99; step(2); out.hiddenBeforeBoss = P.hidden;
// screenshot state: hidden in cover
P.lastCombatT = -99; e.group.position.set(c.x + 15, W.groundY(c.x + 15, c.z), c.z); step(4);
P.yaw = 1.2; P.pitch = 0.35; step(10);
out.final = { hidden: P.hidden, chip: !document.getElementById('hideChip').hidden };
G.paused = true;
return out;
