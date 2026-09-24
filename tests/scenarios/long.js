// Uzun koşu: aşama süreleri, boss, evrim — dakikalık anlık görüntülerle
T.start('normal');
const snaps = [];
for (let m = 1; m <= 40; m++) {
  const s = T.sim(60, { dt: 1 / 30 });
  snaps.push({ m, st: s.stage, gen: s.gen, lv: s.level, evo: s.evo + '/' + s.evoMax, k: s.kills, hp: s.hp,
               boss: s.boss ? s.boss.name + ' ' + s.boss.hp + ' f' + s.boss.phase : '', apex: s.apex || '',
               host: s.hostiles, pick: s.pickups });
  if (s.gen >= 1) break;
}
return { snaps, stats: { deaths: T.stats.deaths, stages: T.stats.stages, genes: T.stats.genes, modalLoops: T.stats.modalLoops }, final: T.state() };
