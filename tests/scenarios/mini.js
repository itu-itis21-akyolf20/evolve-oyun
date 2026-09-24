// Ara boss + canavar seviyeleri: her aşamada EVO %45'te ara boss gelir, bot savaşır;
// ölünce garanti Değerli+ eşya ve Gen Özü düşer, bir daha gelmez.
T.start('normal');
const G = EV.Game;
const toasts = [];
const _t = EV.UI.toast; EV.UI.toast = function (m) { toasts.push(String(m).replace(/<[^>]+>/g, ' ')); return _t.apply(this, arguments); };
const out = [];
for (let st = 0; st < 3; st++) {
  const variants = { 1: 0, 2: 0, 3: 0 };
  T.sim(40, { dt: 1 / 30 });
  G.enemies.forEach((e) => { if (!e.ally && !e.isAlpha && !e.isApex && !e.isMini && e.variant) variants[e.variant]++; });
  const sample = G.enemies.find((e) => e.variant === 3);
  const ess0 = G.inv.essence;
  G.gainEvo(Math.ceil(G.evoMax() * 0.46 - G.evo), 0);
  const m = G.miniBoss;
  const info = { st, spawned: !!m, name: m && m.name, hp: m && Math.round(m.maxHp), lvl: m && m.lvl, variants,
    sampleIII: sample ? { name: sample.name, hp: Math.round(sample.maxHp), dmg: +sample.dmg.toFixed(1) } : null };
  let t0 = G.time, casts = 0;
  const seen = new Set();
  T.sim(120, { dt: 1 / 30, until: (g) => { if (m && m.boss) Object.keys(m.boss.cds).forEach((k) => { if (m.boss.cds[k] > 0.5) seen.add(k); }); return !m || !m.alive; } });
  info.naturalKill = m ? !m.alive : null;
  info.fightSec = Math.round(G.time - t0);
  info.abilitiesUsed = [...seen];
  if (m && m.alive) EV.Combat.hitEnemy(G, m, m.hp * 5, { source: 'player', pure: true });
  T.sim(1, { dt: 1 / 30 });
  info.miniDone = G.miniDone;
  info.essGain = G.inv.essence - ess0;
  info.toasts = toasts.filter((x) => /eşya düştü|ARA BOSS|DEVRİLDİ/.test(x)).slice(-4);
  toasts.length = 0;
  // tekrar gelmemeli
  G.gainEvo(Math.ceil(G.evoMax() * 0.1), 0);
  info.respawnedAgain = !!(G.miniBoss && G.miniBoss.alive);
  info.deaths = T.stats.deaths;
  out.push(info);
  // sonraki aşamaya geç
  G.gainEvo(G.evoMax(), 0);
  const k0 = G.stageIndex;
  T.sim(8 * 60, { dt: 1 / 30, until: (g) => g.stageIndex !== k0 });
  if (G.stageIndex === k0) { out.push({ stuck: st }); break; }
  info.miniDoneAfterStage = G.miniDone;
}
return { out, err: T.stats.errors, final: T.state() };
