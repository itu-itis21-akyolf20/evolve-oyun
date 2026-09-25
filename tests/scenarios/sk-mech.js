if (!EV.Skills2) { await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/skills2.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }   // index.html etiketi gelene kadar
// ---- sk common helpers (generated; see sk-* scenarios) ----
const G = EV.Game;
const DT = 1 / 30;
T.start('normal');
let REACTS = 0;
const _origReact = G.onReaction.bind(G);
G.onReaction = function (R) { REACTS++; return _origReact(R); };

function shortErr(e) { return String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '); }

function tick(n, hook) {
  for (let i = 0; i < n; i++) {
    G.spawnTimer = 1e9; G.apexTimer = 1e9;
    G.player.iframe = Math.max(G.player.iframe, 5);
    G.time += DT;
    EV.tick(DT);
    EV.Input.endFrame();
    if (hook) hook(i);
  }
}

function gotoStage(s) {
  if (G.stageIndex !== s || !G._skInit) {
    G.stageIndex = s;
    G.startStage(false);
    for (let i = 0; i < 5 && T.handleModals({ pick: 'first' }); i++) { /* */ }
    G.paused = false;
    G._skInit = true;
    G._skHome = null;
  }
}

function resetArena() {
  const P = G.player;
  EV.Skills.clear();
  EV.Enemies.clearAll(G);
  EV.Decal.clear();
  Object.assign(P, { dash: null, leap: null, leapY: 0, hunt: null, aiming: null, lockTarget: null, hover: null,
    buffs: [], shield: 0, shieldT: 0, st: null, iframe: 5, alive: true });
  P.vel.set(0, 0, 0); P.impulse.set(0, 0, 0);
  if (!G._skHome) {
    const s = EV.World.randomSpawn({ x: 0, z: 0 }, 0, 6, 4);
    G._skHome = { x: s.x, z: s.z };
  }
  P.group.position.set(G._skHome.x, EV.World.groundY(G._skHome.x, G._skHome.z), G._skHome.z);
  P.yaw = 0; P.aimYaw = 0; P.group.rotation.y = 0;
  G.build.skills = []; G.build.ult = null;
  G.legacy.echoes = [];
  EV.Build.recompute(G);
  P.stats = EV.Build.stats(G, null);
  P.hp = P.stats.maxHp; P.energy = P.stats.maxEnergy; P.rage = 0;
  REACTS = 0;
}

const HP = 1e6;
function spawnTargets(s, count) {
  const P = G.player, pp = P.group.position;
  const pool = EV.MOBS.ENEMIES[s];
  const def = pool[1];
  const spots = [[0, 0], [-1.8, 3], [1.8, 3], [-1.8, 5.5], [1.8, 5.5], [-1.8, 8], [1.8, 8], [0, 7]];
  const out = [];
  for (let i = 0; i < (count || 8); i++) {
    const [dx, dz] = spots[i];
    const e = EV.Enemies.make(G, def, { pos: { x: pp.x + dx, z: pp.z + dz + (i === 0 ? 0 : 0) }, hp: HP, dmg: 1 });
    if (i === 0) e.group.position.z = pp.z + 1.1 + e.radius + P.radius * 0.3;
    e.speed = 0; e.busyT = 1e9; e.armor = 0; e.atkCd = 1e9; e.abilityCd = 1e9;
    out.push(e);
  }
  EV.Enemies.rebuildGrid(G);
  return out;
}

function hpDmg(list) { return list.reduce((s, e) => s + (e.maxHp - Math.max(e.alive ? e.hp : 0, -1e9)), 0); }
function isBad(v) { return typeof v !== 'number' || !isFinite(v); }
function nanCheck(list) {
  const P = G.player, p = P.group.position;
  const bad = [];
  if (isBad(p.x) || isBad(p.y) || isBad(p.z)) bad.push('playerPos');
  if (isBad(P.hp)) bad.push('playerHp');
  if (isBad(P.energy)) bad.push('playerEnergy');
  if (isBad(P.rage)) bad.push('playerRage');
  G.enemies.forEach((e) => {
    if (isBad(e.hp)) bad.push('enemyHp#' + e.id);
    const q = e.group.position;
    if (isBad(q.x) || isBad(q.z) || isBad(q.y)) bad.push('enemyPos#' + e.id);
  });
  return bad;
}

function durOf(def, rank) {
  const p = EV.DATA.params(def, rank);
  let d = 0;
  if (p.dur) d = p.dur;
  if (p.summon && p.summon.dur) d = Math.max(d, p.summon.dur);
  if (def.kind === 'bolt') d = Math.max(d, p.range / p.speed);
  if (p.pulses) d = Math.max(d, p.pulses * (p.pulseGap || 0.4));
  return d;
}

/** Run one skill test. mode: 'direct' | 'input' */
function runSkill(def, rank, mode) {
  const s = def.stage;
  const r = { id: def.id, kind: def.kind, slot: def.slot, rank, mode, ok: null, dmg4: 0, st: [], reacts: 0,
    allies: 0, buff: false, shield: 0, stuck: null, leftover: null, alliesLeft: 0, nan: [], exc: null, moved: 0 };
  try {
    resetArena();
    const tg = spawnTargets(s);
    const P = G.player;
    const lock = tg[3];
    P.lockTarget = lock;
    const lp = lock.group.position;
    P.aimPoint.set(lp.x, lp.y + lock.group.userData.hipY, lp.z);
    const start = P.group.position.clone();
    const seen = new Set();
    const watch = () => tg.forEach((e) => { if (e.st) Object.keys(e.st).forEach((k) => seen.add(k)); });
    const p = EV.DATA.params(def, rank);

    if (mode === 'direct') {
      r.ok = EV.Skills.cast(G, def, rank, { point: P.aimPoint.clone(), target: lock, source: 'player' });
    } else {
      const ult = def.slot === 'ult';
      const entry = { id: def.id, rank, cd: 0 };
      if (ult) { G.build.ult = entry; P.rage = 100; } else G.build.skills = [entry];
      EV.UI.buildSkillbar(G);
      const code = ult ? 'KeyR' : 'KeyQ';
      const e0 = P.energy, rage0 = P.rage;
      EV.Input._press(code); tick(1);
      const aimingAfterPress = !!P.aiming;
      EV.Input._release(code); tick(1);
      r.aimingAfterPress = aimingAfterPress;
      r.energyDelta = +(P.energy - e0).toFixed(2);
      r.expectCost = ult ? 0 : p.cost;
      r.rageAfter = +P.rage.toFixed(1);
      r.rage0 = rage0;
      r.cdMax = entry.cdMax != null ? +entry.cdMax.toFixed(3) : null;
      r.expectCd = +(p.cd * (1 - P.stats.cdr)).toFixed(3);
      r.ok = entry.cdMax != null;
    }
    const dur = durOf(def, rank);
    const ticks4 = Math.round(4 / DT) - (mode === 'input' ? 2 : 0);
    tick(ticks4, () => { watch(); });
    r.dmg4 = Math.round(hpDmg(tg));
    r.st = Array.from(seen);
    r.reacts = REACTS;
    r.allies = G.enemies.filter((e) => e.ally && e.alive).length;
    r.buff = P.buffs.some((b) => b.id === def.id) || r.buff;
    r.shield = Math.round(P.shield);
    r.moved = +P.group.position.distanceTo(start).toFixed(2);
    r.stuck = { dash: !!P.dash, leap: !!P.leap, hunt: !!P.hunt };
    r.nan = nanCheck(tg);
    const extra = Math.max(0, Math.ceil((dur + 2 - 4) / DT));
    if (extra) tick(extra);
    r.leftover = EV.Skills.counts;
    r.alliesLeft = G.enemies.filter((e) => e.ally && e.alive).length;
    r.nan = r.nan.concat(nanCheck(tg));
    r.dmgEnd = Math.round(hpDmg(tg));
  } catch (err) {
    r.exc = shortErr(err);
  }
  return r;
}
// ---- sk-mech: ult rage gating, energy, cooldown, cdr, no-target casts, no-point casts ----
const res = { rageGate: [], energy: [], cooldown: [], cdr: [], noTarget: [], noPoint: [], huntKill: null };

function inputCast(def, rank, opts) {
  const P = G.player;
  const ult = def.slot === 'ult';
  const entry = { id: def.id, rank, cd: 0 };
  if (ult) G.build.ult = entry; else G.build.skills = [entry];
  EV.UI.buildSkillbar(G);
  if (opts.setup) opts.setup();
  const code = ult ? 'KeyR' : 'KeyQ';
  const before = { rage: P.rage, energy: P.energy };
  EV.Input._press(code); tick(1);
  for (let i = 0; i < (opts.hold || 0); i++) { EV.Input.keys[code] = true; tick(1); }
  EV.Input._release(code); tick(1);
  return { entry, before, after: { rage: +P.rage.toFixed(2), energy: +P.energy.toFixed(2) }, cast: entry.cdMax != null };
}

// A. ult rage gating
[0, 1, 2].forEach((s) => {
  gotoStage(s);
  EV.DATA.stageSkills(s, 'ult').forEach((def) => {
    const row = { id: def.id, kind: def.kind };
    try {
      const ground = (def.kind === 'zone' || def.kind === 'leap') && def.base.castRange;
      const hold = ground ? 10 : 0;
      resetArena(); spawnTargets(s);
      let r = inputCast(def, 1, { hold, setup: () => { G.player.rage = 99.9; G.player.lastCombatT = G.time; } });
      row.at99_9 = { cast: r.cast, rage: r.after.rage };
      resetArena(); spawnTargets(s);
      r = inputCast(def, 1, { hold, setup: () => { G.player.rage = 100; G.player.lastCombatT = G.time; } });
      row.at100_inCombat = { cast: r.cast, rageAfter: r.after.rage };
      resetArena(); spawnTargets(s);
      r = inputCast(def, 1, { hold: 0, setup: () => { G.player.rage = 100; G.player.lastCombatT = G.time - 7; } });
      row.at100_outOfCombat7s = { cast: r.cast, rageAfter: r.after.rage };
      resetArena(); spawnTargets(s);
      r = inputCast(def, 1, { hold, setup: () => { G.player.rage = 100; G.player.lastCombatT = G.time - 5.9; } });
      row.at100_lastHit5_9s_hold = { cast: r.cast, rageAfter: r.after.rage, hold };
    } catch (e) { row.exc = shortErr(e); }
    res.rageGate.push(row);
  });
});

// B. energy gating + deduction, C. cooldown blocks recast
gotoStage(0);
['c_drop', 'c_acid', 'c_zap', 'c_membrane'].forEach((id) => {
  const def = EV.DATA.skill(id);
  resetArena(); spawnTargets(0);
  const cost = EV.DATA.params(def, 1).cost;
  const r = inputCast(def, 1, { hold: def.kind === 'zone' ? 3 : 0, setup: () => { G.player.energy = cost - 1; } });
  res.energy.push({ id, cost, energyBefore: cost - 1, cast: r.cast, energyAfter: r.after.energy });
  resetArena(); spawnTargets(0);
  const r2 = inputCast(def, 1, { hold: def.kind === 'zone' ? 3 : 0 });
  const cd1 = r2.entry.cd;
  const e1 = G.player.energy;
  const code = 'KeyQ';
  EV.Input._press(code); tick(1); EV.Input._release(code); tick(1);
  res.cooldown.push({ id, firstCast: r2.cast, cdAfterFirst: +cd1.toFixed(2), energyDeltaSecondPress: +(G.player.energy - e1).toFixed(2), cdStillRunning: r2.entry.cd > 0 });
});

// D. cdr
[[0, 'p_ribo', 'c_drop'], [2, 'p_reflex', 'm_claw']].forEach(([s, pid, sid]) => {
  gotoStage(s);
  [1, 3, 5].forEach((prank) => {
    resetArena(); spawnTargets(s);
    G.build.passives = [{ id: pid, rank: prank }];
    EV.Build.recompute(G);
    const def = EV.DATA.skill(sid);
    const r = inputCast(def, 1, {});
    res.cdr.push({ passive: pid, prank, cdr: G.player.stats.cdr, baseCd: def.cd, cdMax: r.entry.cdMax, expect: +(def.cd * (1 - G.player.stats.cdr)).toFixed(3) });
    G.build.passives = [];
    EV.Build.recompute(G);
  });
});

// E. casts with no enemy at all (chain/hunt should return false; others true, no exception) + input path does not spend energy on failure
[0, 1, 2].forEach((s) => {
  gotoStage(s);
  const defs = EV.DATA.stageSkills(s, 'active').concat(EV.DATA.stageSkills(s, 'ult'), EV.DATA.allFusions().filter((f) => f.stage === s));
  defs.forEach((def) => {
    const row = { id: def.id, kind: def.kind };
    try {
      resetArena();
      EV.Enemies.rebuildGrid(G);
      row.ok = EV.Skills.cast(G, def, 1, { point: G.player.aimPoint.clone(), target: null, source: 'player' });
      tick(60);
      row.nan = nanCheck([]);
      row.stuck = !!(G.player.dash || G.player.leap || G.player.hunt);
      if (def.kind === 'chain' || def.kind === 'hunt') {
        resetArena(); EV.Enemies.rebuildGrid(G);
        const r = inputCast(def, 1, { setup: () => { if (def.slot === 'ult') { G.player.rage = 100; G.player.lastCombatT = G.time; } } });
        row.inputCast = r.cast; row.energyLost = +(r.before.energy - r.after.energy).toFixed(2); row.rageAfter = r.after.rage;
      }
    } catch (e) { row.exc = shortErr(e); }
    res.noTarget.push(row);
  });
});

// F. direct cast with no opts.point and no target, enemies present
[0, 1, 2].forEach((s) => {
  gotoStage(s);
  const defs = EV.DATA.stageSkills(s, 'active').concat(EV.DATA.stageSkills(s, 'ult'), EV.DATA.allFusions().filter((f) => f.stage === s));
  defs.forEach((def) => {
    const row = { id: def.id };
    try {
      resetArena(); const tg = spawnTargets(s);
      row.ok = EV.Skills.cast(G, def, 5, { source: 'player' });
      tick(90);
      row.dmg = Math.round(hpDmg(tg));
      row.nan = nanCheck(tg);
      row.stuck = !!(G.player.dash || G.player.leap || G.player.hunt);
    } catch (e) { row.exc = shortErr(e); }
    res.noPoint.push(row);
  });
});

// G. hunt where every target dies on first hit -> hunt must end
gotoStage(2);
resetArena();
{
  const tg = spawnTargets(2);
  tg.forEach((e) => { e.hp = e.maxHp = 5; });
  const ok = EV.Skills.cast(G, EV.DATA.skill('m_u_hunt'), 5, { point: G.player.aimPoint.clone(), source: 'player' });
  tick(60);
  res.huntKill = { ok, huntNull: G.player.hunt === null, alive: tg.filter((e) => e.alive).length };
}
// H. f_venomfire smoke-zone chain: zones/reactions over time
gotoStage(1);
resetArena();
{
  const tg = spawnTargets(1); const P = G.player; P.lockTarget = tg[3];
  REACTS = 0;
  EV.Skills.cast(G, EV.DATA.skill('f_venomfire'), 5, { point: tg[3].group.position.clone(), target: tg[3], source: 'player' });
  const tl = [];
  for (let k = 0; k < 8; k++) { tick(45); tl.push({ t: +((k + 1) * 1.5).toFixed(1), zones: EV.Skills.counts.zones, reacts: REACTS, dmg: Math.round(hpDmg(tg)) }); }
  res.venomfireTimeline = tl;
  resetArena(); const tg2 = spawnTargets(1); G.player.lockTarget = tg2[3]; REACTS = 0;
  EV.Skills.cast(G, EV.DATA.skill('r_breath'), 5, { point: tg2[3].group.position.clone(), target: tg2[3], source: 'player' });
  tg2.forEach((e) => EV.Status.apply(G, e, 'poison', 3, G.player.stats.dmg, true));
  tick(240);
  res.breathPlusPoison = { reacts: REACTS, dmg: Math.round(hpDmg(tg2)), zones: EV.Skills.counts.zones };
}
return res;
