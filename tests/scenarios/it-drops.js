// it-drops: öldürme başına eşya düşüşü + nadirlik dağılımı + öz ekonomisi
T.start('normal');
const g = EV.Game;
const R = EV.CFG.RARITY;
const P = g.player;
const out = { stages: [] };
const N = Number(window.__N || 2000);

function collect() {
  // yerdeki eşyaları oyuncunun ayağına düşmüş sayıp gerçek toplama yoluyla al
  EV.Items.update(g, 0.001);
  const got = [];
  g.inv.bag.forEach((it, i) => { if (it) { got.push(it); g.inv.bag[i] = null; } });
  return got;
}

function runKills(e, n, useOnKill) {
  const res = { kills: n, drops: 0, rar: [0, 0, 0, 0, 0], ess: 0, leftOnGround: 0 };
  for (let i = 0; i < n; i++) {
    e.alive = true;
    e.group.position.copy(P.group.position);
    const e0 = g.inv.essence;
    if (useOnKill) EV.Items.onKill(g, e); else g.killEnemy(e);
    res.ess += g.inv.essence - e0;
    g.evo = 0;
    const got = collect();
    res.drops += got.length;
    got.forEach((it) => { res.rar[it.rarity]++; });
    if (i % 200 === 0) { EV.Pickups.clear(g); EV.FX.clear(); }
  }
  res.leftOnGround = EV.Items.groundCount;
  res.dropsPer100 = +(100 * res.drops / n).toFixed(2);
  res.essPerKill = +(res.ess / n).toFixed(2);
  return res;
}

for (let s = 0; s < 3; s++) {
  g.stageIndex = s; g.generation = 0;
  g.startStage(false);
  for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
  EV.Items.clear(g);           // sandıklar toplamayı bozmasın
  const pool = EV.MOBS.ENEMIES[s];
  const tiers = {};
  pool.forEach((d) => { if (!tiers[d.tier]) tiers[d.tier] = d; });
  const st = { stage: s, tiers: {} };
  const e = EV.Enemies.make(g, pool[0], { pos: { x: P.group.position.x, z: P.group.position.z }, hp: 1 });
  e.behavior = 'passive';
  for (const t in tiers) { e.def = tiers[t]; st.tiers[t] = runKills(e, N, false); }
  // Apex ve Alfa: onKill doğrudan (killEnemy Alfa'da evrim ekranını açar)
  e.def = EV.MOBS.APEX[s]; e.isApex = true;
  st.apex = runKills(e, 1000, true); e.isApex = false;
  e.def = EV.MOBS.ALPHAS[s]; e.isAlpha = true;
  st.alpha = runKills(e, 1000, true); e.isAlpha = false;
  e.alive = false;
  g.cleanupDead();
  out.stages.push(st);
}
// nesil 2 öz çarpanı
g.stageIndex = 2; g.generation = 2;
{
  const e = EV.Enemies.make(g, EV.MOBS.ENEMIES[2][0], { pos: { x: P.group.position.x, z: P.group.position.z }, hp: 1 });
  e.def = EV.MOBS.ENEMIES[2].find((d) => d.tier === 3);
  out.gen2tier3 = runKills(e, 300, false);
  e.alive = false; g.cleanupDead();
}
out.expectedDropPct = R.map((r) => r.drop);
return out;
