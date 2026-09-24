// Nesil 2, memeli: 4 dk bot oyunu — olaylar/şampiyonlar/yeni türler doğal akışta hata vermiyor mu, yoğunluk
T.start('normal');
const G = EV.Game;
G.stageIndex = 2; G.generation = 2; G.startStage(false);
G.eventT = 20;
const seen = { behaviors: {}, champs: 0, maxAlive: 0, variants: {} , events: [] };
let moon = false;
T.sim(240, { dt: 1 / 30, until: (g) => {
  const alive = g.enemies.filter((e) => e.alive && !e.ally);
  seen.maxAlive = Math.max(seen.maxAlive, alive.length);
  alive.forEach((e) => { seen.behaviors[e.def.behavior || '?'] = 1; if (e.isChampion) seen.champs = Math.max(seen.champs, 1); seen.variants[e.variant || 1] = 1; });
  if (g.bloodMoon > 0 && !moon) { moon = true; seen.events.push('moon@' + Math.round(g.time)); }
  return false;
} });
return { seen, state: T.state(), deaths: T.stats.deaths, deathBy: T.stats.deathBy, level: G.build.level };
