// Oto yetenek: G ile aç; menzilde hedef varken Q/E/F/R kendiliğinden atılır, atılım (c_zap) atılmaz; G ile kapanır
T.start('normal');
T.sim(0.5, { dt: 1 / 30, bot: false });
const G = EV.Game, P = G.player, b = G.build;
const key = (c) => { window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); window.dispatchEvent(new KeyboardEvent('keyup', { code: c })); };
b.skills = [{ id: 'c_drop', rank: 1, cd: 0 }, { id: 'c_zap', rank: 1, cd: 0 }, { id: 'c_acid', rank: 1, cd: 0 }];
b.ult = { id: 'c_u_nova', rank: 1, cd: 0 };
b.uses = {};
EV.Build.recompute(G);
G.enemies.slice().forEach((e) => { if (!e.ally && e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
const pp = P.group.position;
const def = EV.MOBS.ENEMIES[0][1];
const r = {};
// hedef yokken hiçbir şey atılmamalı
key('KeyG');
T.sim(0.2, { dt: 1 / 30, bot: false });
r.autoOn = P.autoCast === true && document.getElementById('skillbar').classList.contains('auto');
T.sim(2, { dt: 1 / 30, bot: false });
const near = EV.Enemies.nearest(pp.x, pp.z, 22, (x) => !x.ally && !x.peaceful);
r.noTargetNoCast = Object.keys(b.uses).length === 0 || !!near;   // 2 sn'de yakına yeni canlı doğmuş olabilir
r.bgSpawnNear = near ? near.name : null;
G.enemies.slice().forEach((x) => { if (!x.ally && x.alive) EV.Enemies.despawn(G, G.enemies.indexOf(x)); });
b.uses = {};
const e = EV.Enemies.make(G, def, { pos: { x: pp.x + 8, z: pp.z }, hp: 1e6, dmg: 0 });
e.behavior = 'passive'; e.speed = 0;
const ep = e.group.position.clone(), p0 = pp.clone();
P.rage = EV.CFG.TUNE.rageMax;
let minEnergy = 999;
T.sim(8, { dt: 1 / 30, bot: false, until: () => { e.group.position.copy(ep); e.knock.set(0, 0, 0); minEnergy = Math.min(minEnergy, P.energy); return false; } });
r.uses = Object.assign({}, b.uses);
r.dashNotUsed = !b.uses.c_zap;
r.ultNotUsed = !b.uses.c_u_nova && P.rage >= EV.CFG.TUNE.rageMax - 1;
r.minEnergy = Math.round(minEnergy);
r.playerStayed = +pp.distanceTo(p0).toFixed(1);
key('KeyG');
const u0 = JSON.stringify(b.uses);
T.sim(4, { dt: 1 / 30, bot: false, until: () => { e.group.position.copy(ep); return false; } });
r.offStops = P.autoCast === false && JSON.stringify(b.uses) === u0;
return r;
