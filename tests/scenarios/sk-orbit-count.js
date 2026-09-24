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
// ---- sk-orbit-count: does orbit projectile count change damage? ----
gotoStage(0);
const base = EV.DATA.skill('c_orbs');
const out = [];
[1, 2, 4, 8].forEach((count) => {
  const def = Object.assign({}, base, { id: 'c_orbs', ranks: [], base: Object.assign({}, base.base, { count, st: [] }) });
  const row = { count, dmg: [] };
  for (let trial = 0; trial < 3; trial++) {
    resetArena();
    const tg = spawnTargets(0, 1);
    const e = tg[0];
    e.isAlpha = true; // reduces knockback so the target stays in the ring
    const pp = G.player.group.position;
    e.group.position.set(pp.x, e.group.position.y, pp.z + 3.2);
    EV.Enemies.rebuildGrid(G);
    G.player.stats.crit = 0;
    EV.Skills.cast(G, def, 1, { source: 'player' });
    let hits = 0; const h0 = e.hp;
    tick(120);
    row.dmg.push(Math.round(h0 - e.hp));
  }
  out.push(row);
});
return out;
