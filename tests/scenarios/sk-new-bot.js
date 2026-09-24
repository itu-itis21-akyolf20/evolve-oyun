// ---- sk-new-bot: yeni yetenekler gerçek oyunda (bot girdisiyle Q/E/F/R) — hata, sızıntı, takılma ----
// Her aşamada yeni aktiflerden 3'lü setler + yeni ultimate takılır, bot 20 sn oynar.
const G = EV.Game;
T.start('normal');

const SETS = {
  0: { ult: 'c_u_eel', sets: [['c_colony', 'c_spores', 'c_capsid'], ['c_osmo', 'c_flow', 'c_spores']] },
  1: { ult: 'r_u_sunrain', sets: [['r_sunray', 'r_disc', 'r_nest'], ['r_dive', 'r_quake', 'r_disc']] },
  2: { ult: 'm_u_claws', sets: [['m_moonbeam', 'm_raid', 'm_totem'], ['m_shadow', 'm_stampede', 'm_raid']] },
};

function gotoStage(s) {
  G.stageIndex = s;
  G.startStage(false);
  for (let i = 0; i < 5 && T.handleModals({ pick: 'first' }); i++) { /* başlangıç kartı */ }
  G.paused = false;
}

const out = [];
[0, 1, 2].forEach((s) => {
  gotoStage(s);
  SETS[s].sets.forEach((ids, k) => {
    const b = G.build;
    b.skills = ids.map((id) => ({ id, rank: k === 0 ? 1 : 5, cd: 0 }));
    b.ult = { id: SETS[s].ult, rank: k === 0 ? 1 : 5, cd: 0 };
    EV.Build.recompute(G);
    EV.UI.buildSkillbar(G);
    const uses0 = Object.assign({}, b.uses);
    G.player.rage = 100;
    let peak = { projs: 0, beams: 0, impacts: 0, totems: 0, waves: 0, zones: 0 };
    let maxKids = 0;
    const st = T.sim(20, { dt: 1 / 30, pick: 'first', until: (g) => {
      const c = EV.Skills.counts;
      Object.keys(peak).forEach((key) => { if (c[key] > peak[key]) peak[key] = c[key]; });
      if (g.scene.children.length > maxKids) maxKids = g.scene.children.length;
      if (g.player.rage < 100 && Math.random() < 0.02) g.player.rage = 100;   // ultiyi de sık dene
      return false;
    } });
    const used = {};
    ids.concat([SETS[s].ult]).forEach((id) => { used[id] = (b.uses[id] || 0) - (uses0[id] || 0); });
    out.push({ stage: s, set: k, used, peak, maxKids, hp: st.hp, kills: st.kills, skills: st.skills, ult: st.ult,
      stuck: !!(G.player.dash || G.player.leap || G.player.hunt) });
  });
});
EV.Skills.clear();
out.push({ afterClear: EV.Skills.counts, deaths: T.stats.deaths, casts: T.stats.casts, reactions: T.stats.reactions });
return out;
