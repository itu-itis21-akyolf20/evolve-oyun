// Hücre aşaması temposu: her seviyenin zamanı, Alfa'nın gelişi, dövüş süresi (2 koşu)
const G = EV.Game;
const runs = [];
for (let r = 0; r < 2; r++) {
  if (r === 0) T.start('normal'); else { G.newGame('normal'); T.handleModals({ pick: 'first' }); }
  const t0 = G.time, d0 = T.stats.deaths;
  const lv = []; let last = G.build.level, alfa = null, done = null;
  T.sim(30 * 60, { dt: 1 / 30, pick: r ? 'first' : undefined, until: (g) => {
    if (g.stageIndex !== 0) { done = g.time; return true; }
    if (g.build.level !== last) { last = g.build.level; lv.push(+((g.time - t0) / 60).toFixed(2)); }
    if (g.bossActive && alfa == null) alfa = g.time;
    return false;
  } });
  const gaps = lv.map((m, i) => +(m - (i ? lv[i - 1] : 0)).toFixed(2));
  runs.push({ levelUpAtMin: lv, gapsMin: gaps, alfaAtMin: alfa && +((alfa - t0) / 60).toFixed(1),
    fightSec: alfa && done ? Math.round(done - alfa) : null, stageMin: done && +((done - t0) / 60).toFixed(1),
    finalLevel: last, deaths: T.stats.deaths - d0 });
}
return runs;
