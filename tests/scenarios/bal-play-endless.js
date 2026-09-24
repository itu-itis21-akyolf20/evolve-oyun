const DIFF='normal', PICK='random', MAXGEN=7, MAXM=90; const PRE=()=>{ const G=EV.Game; const gs=EV.DATA.allGenes(); [0,1,2].forEach(st=>{ const c=gs.filter(g=>g.stage===st); G.legacy.genes.push(c[Math.floor(Math.random()*c.length)].id); }); G.stageIndex=2; G.generation=1; G.evo=0; G.startStage(false); };
// bal- playthrough: natural play until gen 2 or MAXMIN game minutes, with instrumentation
const MAXMIN = typeof MAXM !== "undefined" ? MAXM : 70; const MAXG = typeof MAXGEN !== "undefined" ? MAXGEN : 2;
T.start(DIFF); if (typeof PRE === "function") PRE();
const G = EV.Game;
const R = EV.CFG.RARITY;
const key = () => 's' + G.stageIndex + 'g' + G.generation;
const stages = {};
const cur = () => {
  const k = key();
  if (!stages[k]) stages[k] = { k, startT: G.time, startKills: G.kills, startEss: G.inv.essence, alphaT: null, lvlAtAlpha: null,
    alphaEnd: null, lvlEnd: null, deaths: 0, deathBy: {}, deathsInBoss: 0, deathsByApex: 0, dmgTaken: 0, dmgBy: { mob: 0, alpha: 0, apex: 0, dot: 0, proj: 0 },
    killEss: 0, chestEss: 0, drops: { kill: [0,0,0,0,0], chest: [0,0,0,0,0], alpha: [0,0,0,0,0], apex: [0,0,0,0,0] },
    apexSpawns: 0, apexKilled: 0, apexHunts: [], density: [], mins: [], bossHpAtDeaths: [], alphaMaxPhase: 0 };
  return stages[k];
};
cur();
// --- instrumentation ---
let dropSrc = 'chest';
const wp = EV.U.weightedPick;
EV.U.weightedPick = function (arr, w) { const r = wp.call(this, arr, w); if (arr === R && r) { const s = cur(); s.drops[dropSrc][r.id]++; } return r; };
const ok = EV.Items.onKill;
EV.Items.onKill = function (game, e) { const s = cur(); const e0 = game.inv.essence; dropSrc = e.isAlpha ? 'alpha' : e.isApex ? 'apex' : 'kill'; ok.call(this, game, e); dropSrc = 'chest'; s.killEss += game.inv.essence - e0; if (e.isApex) s.apexKilled++; };
const hp = EV.Combat.hitPlayer;
EV.Combat.hitPlayer = function (game, amount, o) {
  const d = hp.call(this, game, amount, o);
  if (d > 0) { const s = cur(); s.dmgTaken += d; const a = o && o.attacker;
    const c = o && o.dot ? 'dot' : a ? (a.isAlpha ? 'alpha' : a.isApex ? 'apex' : 'mob') : 'proj'; s.dmgBy[c] += d; }
  return d;
};
const od = G.onDeath;
G.onDeath = function () {
  const s = cur();
  if (this.player.alive) { s.deaths++; (s.deathT = s.deathT || []).push(Math.round((this.time - s.startT) / 6) / 10); const by = this.lastHitBy || '?'; s.deathBy[by] = (s.deathBy[by] || 0) + 1;
    if (this.bossActive) { s.deathsInBoss++; s.bossHpAtDeaths.push(this.boss ? Math.round(100 * this.boss.hp / this.boss.maxHp) : -1); }
    if (this.apex && this.apex.alive && this.lastHitBy === this.apex.name) s.deathsByApex++; }
  return od.apply(this, arguments);
};
let lastApex = null, apexStart = 0, nextSample = 0, nextMin = 60, lastKey = key();
let apexMinD = 999;
const until = (g) => {
  const k = key();
  if (k !== lastKey) { const p = stages[lastKey]; if (p) { p.endKills = g.kills; p.endEss = g.inv.essence; } if (p && p.alphaEnd == null && p.alphaT != null) p.alphaEnd = g.time; lastKey = k; cur(); }
  const s = cur();
  if (g.bossActive && s.alphaT == null) { s.alphaT = g.time; s.lvlAtAlpha = g.build.level; }
  if (g.bossActive) { s.lvlEnd = g.build.level; if (g.boss && g.boss.boss) s.alphaMaxPhase = Math.max(s.alphaMaxPhase, g.boss.boss.phase); }
  const a = g.apex && g.apex.alive ? g.apex : null;
  if (a !== lastApex) {
    if (lastApex) s.apexHunts.push({ dur: Math.round(g.time - apexStart), minD: Math.round(apexMinD), killed: !lastApex.alive && lastApex.hp <= 0 });
    if (a) { s.apexSpawns++; apexStart = g.time; apexMinD = 999; }
    lastApex = a;
  }
  if (a) apexMinD = Math.min(apexMinD, a.group.position.distanceTo(g.player.group.position));
  if (g.time >= nextSample) {
    nextSample = g.time + 10;
    const p = g.player.group.position; let n = 0;
    for (const e of g.enemies) if (e.alive && !e.ally && !e.peaceful && !e.isAlpha && !e.isApex && e.group.position.distanceTo(p) < 60) n++;
    s.density.push(n);
  }
  if (g.time >= nextMin) { nextMin += 60; s.mins.push([Math.round((g.time - s.startT) / 60), g.build.level, Math.round(g.evo), g.kills - s.startKills]); }
  return g.generation >= MAXG || g.time > MAXMIN * 60;
};
const w0 = Date.now();
T.sim(MAXMIN * 60 + 5, { dt: 1 / 30, pick: PICK, until });
const out = Object.values(stages).map((s) => {
  const dens = s.density.slice().sort((a, b) => a - b);
  return {
    k: s.k, minToAlpha: s.alphaT != null ? +((s.alphaT - s.startT) / 60).toFixed(1) : null, lvlAtAlpha: s.lvlAtAlpha,
    fightSec: s.alphaT != null && s.alphaEnd != null ? Math.round(s.alphaEnd - s.alphaT) : (s.alphaT != null ? 'unfinished ' + Math.round(G.time - s.alphaT) : null),
    lvlEnd: s.lvlEnd, completed: s.alphaEnd != null, stageMin: +(((s.alphaEnd != null ? s.alphaEnd : G.time) - s.startT) / 60).toFixed(1),
    deaths: s.deaths, deathsInBoss: s.deathsInBoss, deathsByApex: s.deathsByApex, deathBy: s.deathBy, bossHpAtDeaths: s.bossHpAtDeaths, alphaMaxPhase: s.alphaMaxPhase,
    kills: (s.endKills != null ? s.endKills : G.kills) - s.startKills, essTotal: (s.endEss != null ? s.endEss : G.inv.essence) - s.startEss, essKill: s.killEss, drops: s.drops,
    dmgPerMin: Math.round(s.dmgTaken / Math.max(1, ((s.alphaEnd != null ? s.alphaEnd : G.time) - s.startT) / 60)), dmgBy: s.dmgBy,
    apexSpawns: s.apexSpawns, apexKilled: s.apexKilled, apexHunts: s.apexHunts,
    density: { min: dens[0], p10: dens[Math.floor(dens.length * 0.1)], med: dens[Math.floor(dens.length / 2)], max: dens[dens.length - 1], zeroSamples: dens.filter((x) => x === 0).length, lowSamples: dens.filter((x) => x < 5).length, n: dens.length },
    mins: s.mins, deathT: s.deathT || [], lvlNow: G.build.level,
  };
});
// kills per stage via mins deltas
return { diff: DIFF, pick: String(PICK), endT: Math.round(G.time / 60), realMs: Date.now() - w0, out, final: T.state(), stats: { deaths: T.stats.deaths, deathBy: T.stats.deathBy, stagesLog: T.stats.stages, genes: T.stats.genes, modalLoops: T.stats.modalLoops, casts: T.stats.casts }, bag: G.inv.bag.filter(Boolean).map((i) => i.rarity), essenceNow: G.inv.essence };
