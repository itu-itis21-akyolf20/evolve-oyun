// bal- time-to-kill: one mob next to the bot, per stage, at player level 1/7/13 (random cards)
T.start(typeof DIFF !== 'undefined' ? DIFF : 'normal');
const G = EV.Game;
G.diff = Object.assign({}, G.diff, { spawn: 0 });
const res = [];
for (let s = 0; s < 3; s++) {
  for (const L of [1, 7, 13]) {
    G.stageIndex = s; G.generation = 0;
    G.startStage(false);
    T.sim(0.2, { bot: false, pick: 'random' });
    G.build.level = L; G.build.picks = L - 1;
    for (let i = 0; i < 40 && G.build.picks > 0; i++) T.sim(0.2, { bot: false, pick: 'random' });
    G.apexTimer = 1e9;
    const P = G.player;
    const row = { stage: s, L, pdmg: Math.round(P.stats.dmg), php: Math.round(P.stats.maxHp), build: T.state().skills.concat(T.state().passives), mobs: {} };
    for (const def of EV.MOBS.ENEMIES[s]) {
      const r = { ttk: [], taken: [], died: 0, hp: 0 };
      for (let rep = 0; rep < 3; rep++) {
        EV.Enemies.clearAll(G); EV.Decal.clear(); EV.Boss.clear();
        P.hp = P.stats.maxHp; P.energy = P.stats.maxEnergy; P.st = null; P.shield = 0;
        (G.build.skills || []).forEach((k) => { k.cd = 0; });
        const pp = P.group.position;
        const sc = EV.Enemies.statScale(G, 'normal');
        const e = EV.Enemies.make(G, def, { pos: { x: pp.x + 5, z: pp.z }, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg });
        r.hp = Math.round(e.maxHp); r.dmg = Math.round(e.dmg);
        const hp0 = P.hp, d0 = T.stats.deaths, t0 = G.time;
        let taken = 0; const h = EV.Combat.hitPlayer;
        EV.Combat.hitPlayer = function (g, a, o) { const d = h.call(this, g, a, o); taken += d; return d; };
        T.sim(30, { dt: 1 / 30, pick: 'random', until: () => !e.alive });
        EV.Combat.hitPlayer = h;
        r.ttk.push(e.alive ? 99 : +(G.time - t0).toFixed(1));
        r.taken.push(Math.round(taken));
        r.died += T.stats.deaths - d0;
        // skip level-ups gained
      }
      row.mobs[def.id] = { hp: r.hp, dmg: r.dmg, ttk: r.ttk, takenPctHp: r.taken.map((t) => Math.round(100 * t / P.stats.maxHp)), died: r.died };
    }
    res.push(row);
  }
}
return res;
