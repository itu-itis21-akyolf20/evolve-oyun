// Tam koşu: doğal ilerleme, 3 aşama + 2 nesil. Alfa'yı bot doğal yoldan çağırır/yener.
// Bir aşama 22 dk içinde bitmezse EVO zorla doldurulur (sadece boss'u test etmek için).
T.start('normal');
const G = EV.Game;
const out = [];
for (let round = 0; round < 5; round++) {
  const tag = 'st' + G.stageIndex + '/g' + G.generation;
  const startT = G.time;
  const d0 = T.stats.deaths;
  const key = () => G.stageIndex * 10 + G.generation;
  const k0 = key();
  let forced = false, bossSeenAt = null, phases = 0, lvlAtBoss = null, bossName = null;
  const until = (g) => {
    if (g.bossActive && bossSeenAt == null) { bossSeenAt = g.time; lvlAtBoss = g.build.level; bossName = g.boss.name; }
    if (g.boss && g.boss.boss) phases = Math.max(phases, g.boss.boss.phase);
    return key() !== k0;
  };
  T.sim(22 * 60, { dt: 1 / 30, until });
  if (key() === k0) {                       // doğal bitmedi → boss'u zorla
    forced = true;
    G.gainEvo(G.evoMax(), 0);
    T.sim(8 * 60, { dt: 1 / 30, until });
  }
  out.push({ tag, stageMin: +((bossSeenAt != null ? bossSeenAt : G.time) - startT).toFixed(0) / 60,
             forced, boss: bossName, lvlAtBoss, fightSec: bossSeenAt != null ? Math.round(G.time - bossSeenAt) : null,
             maxPhase: phases, deaths: T.stats.deaths - d0, next: 'st' + G.stageIndex + '/g' + G.generation });
  if (key() === k0) break;
}
return { out, deathBy: T.stats.deathBy, genes: T.stats.genes, final: T.state() };
