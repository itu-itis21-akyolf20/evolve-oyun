// it-econ: gerçek bot oyunu — aşama başına öldürme, öz, düşüş, sandık; Alfa düşüşü kayboluyor mu?
T.start('normal');
const g = EV.Game;
const log = [];
const toasts = [];
const origToast = EV.UI.toast;
EV.UI.toast = function (t, c, ms) { toasts.push({ t: Math.round(g.time), s: String(t).replace(/<[^>]+>/g, '').slice(0, 80) }); return origToast.apply(this, arguments); };

// Alfa ölümünde yerdeki eşya sayısı ve temizlenen sayısı
const origClear = EV.Items.clear;
const clears = [];
EV.Items.clear = function (game) { clears.push({ t: Math.round(g.time), ground: EV.Items.groundCount, stage: g.stageIndex }); return origClear.apply(this, arguments); };
// not: startStage EV.Items.clear'ı modül nesnesi üzerinden çağırır → sarmalayıcı görülür

let stageStart = { t: 0, kills: 0, ess: 0, stage: 0 };
const essGain = { total: 0 };
let lastEss = g.inv.essence;
const origAlpha = g.onAlphaDefeated.bind(g);
g.onAlphaDefeated = function (e) {
  log.push({ stage: g.stageIndex, dur: Math.round(g.time - stageStart.t), kills: g.kills - stageStart.kills,
    essGained: essGain.total - stageStart.ess, groundAtAlphaDeath: EV.Items.groundCount, bagUsed: g.inv.bag.filter(Boolean).length });
  const r = origAlpha(e);
  stageStart = { t: g.time, kills: g.kills, ess: essGain.total, stage: g.stageIndex + 1 };
  return r;
};

const snaps = [];
for (let m = 1; m <= 45; m++) {
  // öz kazancını izlemek için dakikayı küçük parçalara böl
  for (let k = 0; k < 12; k++) {
    T.sim(5, { dt: 1 / 30 });
    const d = g.inv.essence - lastEss; if (d > 0) essGain.total += d; lastEss = g.inv.essence;
    // çanta dolmasın diye: çantadakileri sandığa taşı, sandık dolarsa parçala
    g.inv.bag.forEach((it, i) => { if (it && !EV.Items.move(g, 'bag', i, 'chest')) { /* sandık dolu */ } });
    lastEss = g.inv.essence;
  }
  const s = T.state();
  snaps.push({ m, st: s.stage, gen: s.gen, lv: s.level, k: s.kills, ess: g.inv.essence, bag: g.inv.bag.filter(Boolean).length, chest: g.inv.chest.filter(Boolean).length });
  if (s.gen >= 1) break;
}
const rarCount = [0, 0, 0, 0, 0];
[...g.inv.bag, ...g.inv.chest].forEach((it) => { if (it) rarCount[it.rarity]++; });
return {
  perStage: log, clears, snaps, rarCount, essTotal: essGain.total,
  chestToasts: toasts.filter((x) => /Sandık/.test(x.s)),
  itemToasts: toasts.filter((x) => /eşya düştü|Çanta dolu/.test(x.s)).slice(0, 40),
  deaths: T.stats.deaths, stages: T.stats.stages, modalLoops: T.stats.modalLoops,
};
