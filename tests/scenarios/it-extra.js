// it-extra: Rüzgar Kesesi atılım yavaşlatması (ızgara güncel), sürüngen sandıklarına açıklıktan yürüme, evrim sonrası kayıt
T.start('normal');
const g = EV.Game;
const I = EV.Items;
const P = g.player;
const In = EV.Input;
const out = {};
function tick(n) { for (let i = 0; i < n; i++) { g.paused = false; g.time += 1 / 30; EV.tick(1 / 30); In.endFrame(); } }
g.apexTimer = 1e9;

/* Rüzgar Kesesi */
{
  let it = null;
  for (let i = 0; i < 500 && !(it && it.unique.name === 'Rüzgar Kesesi'); i++) it = I.makeItem('organ', 4, 0);
  g.inv.bag.fill(null); g.inv.bag[0] = it; I.equipFrom(g, 'bag', 0);
  EV.Enemies.clearAll(g);
  const p = P.group.position;
  const e = EV.Enemies.make(g, EV.MOBS.ENEMIES[0][1], { pos: { x: p.x + 2.5, z: p.z }, hp: 1e9, dmg: 0 });
  e.behavior = 'passive'; e.speed = 0;
  tick(3);                       // ızgara yeniden kurulsun
  const d = EV.Creature.surfDist(e.group, P.group.position.x, P.group.position.z);
  P.energy = P.stats.maxEnergy; P.dashCd = 0;
  In._press('Space'); tick(1);
  out.wind = { dist: +d.toFixed(2), slowed: EV.Status.has(e, 'slow'), st: e.st };
}

/* Sürüngen: kaya kovuğu açıklığından yürüyerek */
{
  g.stageIndex = 1; g.startStage(false);
  for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
  EV.Enemies.clearAll(g);
  const toasts = [];
  const o = EV.UI.toast; EV.UI.toast = function (t) { toasts.push(String(t)); return o.apply(this, arguments); };
  const covers = EV.World.covers.filter((c, i) => i % 2 === 0);
  const res = [];
  covers.forEach((c) => {
    // açıklığın yönünü, merkezden en uzak kaya boşluğundan bul
    const rocks = EV.World.obstacles.filter((ob) => Math.abs(Math.hypot(ob.x - c.x, ob.z - c.z) - c.r) < 0.6).map((ob) => Math.atan2(ob.x - c.x, ob.z - c.z)).sort((a, b) => a - b);
    let best = 0, gapA = 0;
    for (let i = 0; i < rocks.length; i++) {
      const a = rocks[i], b = i + 1 < rocks.length ? rocks[i + 1] : rocks[0] + Math.PI * 2;
      if (b - a > best) { best = b - a; gapA = (a + b) / 2; }
    }
    const sx = c.x + Math.sin(gapA) * (c.r + 8), sz = c.z + Math.cos(gapA) * (c.r + 8);
    P.group.position.set(sx, EV.World.groundY(sx, sz), sz);
    const n0 = toasts.length;
    let k = 0;
    for (; k < 300; k++) {
      P.yaw = Math.atan2(c.x - P.group.position.x, c.z - P.group.position.z);
      In.keys.KeyW = true; tick(1);
      if (toasts.slice(n0).some((t) => /Sandık/.test(t))) break;
    }
    In.keys.KeyW = false;
    const pp = P.group.position;
    res.push({ rocks: rocks.length, gapDeg: Math.round(best * 57.3), opened: toasts.slice(n0).some((t) => /Sandık/.test(t)), secs: +(k / 30).toFixed(1), endDist: +Math.hypot(pp.x - c.x, pp.z - c.z).toFixed(2) });
  });
  out.reptileGapWalk = res;
  EV.UI.toast = o;
}

/* evrim sonrası tam kayıt gidiş-dönüş (genler/parçalar dahil) */
{
  g.inv.bag[3] = I.makeItem('hide', 3, 1);
  const a = EV.Enemies.spawnAlpha(g); g.killEnemy(a);
  for (let k = 0; k < 6 && T.handleModals({ pick: 'first' }); k++);
  const leg = JSON.stringify(g.legacy);
  const stats = { ...P.stats };
  const inv = JSON.stringify(I.serialize(g.inv));
  g.save(); g.applySave(g.loadRaw());
  for (let k = 0; k < 6 && T.handleModals({ pick: 'first' }); k++);
  out.evoRoundtrip = {
    stage: g.stageIndex,
    legacyBefore: leg, legacyAfter: JSON.stringify(g.legacy),
    invSame: inv === JSON.stringify(I.serialize(g.inv)),
    statDiffs: Object.keys(stats).filter((k) => Math.abs(stats[k] - P.stats[k]) > 1e-9).map((k) => k + ':' + stats[k] + '->' + P.stats[k]),
  };
}
return out;
