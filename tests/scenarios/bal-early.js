// bal- early-game hit log: first 90 s on each difficulty
const out = {};
for (const diff of ['dehset', 'normal']) {
  T.start(diff);
  const G = EV.Game;
  const log = []; const h = EV.Combat.hitPlayer;
  EV.Combat.hitPlayer = function (g, a, o) { const d = h.call(this, g, a, o); if (d > 0) log.push([+g.time.toFixed(1), (o && o.attacker && o.attacker.name) || (o && o.dot ? 'dot' : 'proj'), d, Math.round(g.player.hp)]); return d; };
  const t0 = G.time, d0 = T.stats.deaths;
  const near = [];
  T.sim(90, { dt: 1 / 30, until: (g) => { if (Math.round((g.time - t0) * 30) % 300 === 0) { const p = g.player.group.position; near.push(g.enemies.filter((e) => e.alive && !e.ally && !e.peaceful && e.group.position.distanceTo(p) < 20).length); } return false; } });
  EV.Combat.hitPlayer = h;
  const by = {}; log.forEach((l) => { by[l[1]] = (by[l[1]] || 0) + l[2]; });
  out[diff] = { deaths: T.stats.deaths - d0, dmgBy: by, total: log.reduce((s, l) => s + l[2], 0), within20: near, first40: log.slice(0, 40), lvl: G.build.level, maxHp: Math.round(G.player.stats.maxHp) };
  // reset: go back to menu is complicated; reload state for next diff via new start
}
return out;
