// ---- sk2-bot: etkileşimli yetenekler gerçek oyunda (bot Q/E/F/R + sol tık) — hata, takılma, görünmez/dokunulmaz kalma ----
// Her aşamada yeni mekaniklerden 3'lü setler + ulti, rütbe 1 ve 5; bot 25 sn oynar. Ayrıca otomatik mod (G) açık bir tur.
if (!EV.Skills2) { await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/skills2.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
const G = EV.Game;
T.start('normal');

const SETS = {
  0: { ult: 'c_u_mitosis', sets: [['c_lash', 'c_web', 'c_cilia'], ['c_zap', 'c_membrane', 'c_lash']] },
  1: { ult: 'r_u_blood', sets: [['r_tongue', 'r_dive', 'r_ambush'], ['r_heat', 'r_fang', 'r_tongue']] },
  2: { ult: 'm_u_rage', sets: [['m_howl', 'm_crush', 'm_mark'], ['m_quills', 'm_stampede', 'm_howl']] },
};
function gotoStage(s) {
  G.stageIndex = s;
  G.startStage(false);
  for (let i = 0; i < 5 && T.handleModals({ pick: 'first' }); i++) { /* başlangıç kartı */ }
  G.paused = false;
}
function sanity() {
  const P = G.player, st = EV.Skills2.state;
  const bad = [];
  if (P.leapY < -0.01 && !st.burrow) bad.push('underground');
  if (P.leapY > 0.01 && !P.leap) bad.push('floating');
  let op = 1;
  P.group.traverse((o) => { if (o.isMesh && o.material && !o.isSprite && o.material.opacity < op) op = o.material.opacity; });
  if (op < 0.25 && !st.stealth) bad.push('invisible');
  if (P.hidden && !st.stealth && !st.burrow && !P.cover) bad.push('hidden');
  if (G.enemies.some((e) => e.held && e.alive) && !st.holds.length && !st.flights.length) bad.push('heldOrphan');
  if (!isFinite(P.group.position.x) || !isFinite(P.hp)) bad.push('nan');
  return bad;
}
const out = [];
const probs = {};
[0, 1, 2].forEach((s) => {
  gotoStage(s);
  SETS[s].sets.concat([SETS[s].sets[0]]).forEach((ids, k) => {
    const b = G.build;
    const auto = k === 2;
    b.skills = ids.map((id) => ({ id, rank: k === 0 ? 1 : 5, cd: 0 }));
    b.ult = { id: SETS[s].ult, rank: k === 0 ? 1 : 5, cd: 0 };
    EV.Build.recompute(G);
    EV.UI.buildSkillbar(G);
    G.player.autoCast = auto;
    const uses0 = Object.assign({}, b.uses);
    G.player.rage = 100;
    const peak = {};
    let maxKids = 0;
    const st = T.sim(25, { dt: 1 / 30, pick: 'first', until: (g) => {
      const c = EV.Skills.counts;
      Object.keys(c).forEach((key) => { if (c[key] > (peak[key] || 0)) peak[key] = c[key]; });
      if (g.scene.children.length > maxKids) maxKids = g.scene.children.length;
      if (g.player.rage < 100 && Math.random() < 0.02) g.player.rage = 100;
      sanity().forEach((p) => { probs[p] = (probs[p] || 0) + 1; });
      return false;
    } });
    const used = {};
    ids.concat([SETS[s].ult]).forEach((id) => { used[id] = (b.uses[id] || 0) - (uses0[id] || 0); });
    out.push({ stage: s, set: k, auto, used, peak, maxKids, hp: st.hp, kills: st.kills, stage2: st.stage });
    G.player.autoCast = false;
  });
});
EV.Skills.clear();
T.sim(0.2, { dt: 1 / 30, bot: false });
const left = EV.Skills.counts;
out.push({ afterClear: Object.keys(left).filter((k) => left[k] > 0), sanityAfterClear: sanity(), probs, deaths: T.stats.deaths, casts: T.stats.casts });
return out;
