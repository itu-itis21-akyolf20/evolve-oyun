// ---- sk2-mech: etkileşimli yetenek mekanikleri (skills2.js) — durum geçişleri, rütbe 1 ve 5 ----
// grab→fırlat, yut→tükür, bağ kopması/bitişi, işaret→patlat (elle + kendiliğinden), savuşturma başarı/ıska,
// pusu (gizlilik, saldırı, hasarla bozulma), kazı (dokunulmazlık, çıkış), duruş (aç/kapa, enerji), hücum (hız),
// şarj (kısa/uzun), sürü emri; yankı güvenliği; hedef ölümü; EV.Skills.clear() temizliği.
if (!EV.Skills2) {                       // index.html'e <script> eklenene kadar testler kendisi yükler
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/skills2.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
const G = EV.Game;
const DT = 1 / 30;
const I = EV.Input;
T.start('normal');
const origStats = EV.Build.stats;
EV.Build.stats = function (g, b) { const s = origStats(g, b); s.crit = 0; return s; };   // ölçüm kritik şansından bağımsız

function shortErr(e) { return String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '); }
const r2 = (v) => Math.round(v * 100) / 100;
let keepIframe = true;
function tick(n, hook) {
  for (let i = 0; i < n; i++) {
    G.spawnTimer = 1e9; G.apexTimer = 1e9;
    if (keepIframe) G.player.iframe = Math.max(G.player.iframe, 5);
    G.time += DT;
    EV.tick(DT);
    I.endFrame();
    if (hook) hook(i);
  }
}
const secs = (s, hook) => tick(Math.ceil(s / DT), hook);

function gotoStage(s) {
  if (G.stageIndex !== s || !G._sk2) {
    G.stageIndex = s;
    G.startStage(false);
    for (let i = 0; i < 5 && T.handleModals({ pick: 'first' }); i++) { /* başlangıç kartı */ }
    G.paused = false;
    G._sk2 = true;
    G._home = null;
  }
}
function resetArena() {
  const P = G.player;
  EV.Skills.clear();
  EV.Enemies.clearAll(G);
  EV.Decal.clear();
  EV.FX.clear();
  ['KeyQ', 'KeyE', 'KeyF', 'KeyR', 'KeyW'].forEach((k) => { I.keys[k] = false; });
  I.mouse.left = I.mouse.right = false;
  Object.assign(P, { dash: null, leap: null, leapY: 0, hunt: null, aiming: null, lockTarget: null, hover: null,
    buffs: [], shield: 0, shieldT: 0, st: null, iframe: 5, alive: true, charge: 0, basicCd: 0, comboT: 0, faceT: 0 });
  P.vel.set(0, 0, 0); P.impulse.set(0, 0, 0);
  if (!G._home) { const s = EV.World.randomSpawn({ x: 0, z: 0 }, 0, 6, 8); G._home = { x: s.x, z: s.z }; }
  P.group.position.set(G._home.x, EV.World.groundY(G._home.x, G._home.z), G._home.z);
  P.yaw = 0; P.aimYaw = 0; P.group.rotation.y = 0;
  G.build.skills = []; G.build.ult = null; G.build.passives = [];
  G.legacy.echoes = [];
  EV.Build.recompute(G);
  P.stats = EV.Build.stats(G, null);
  P.hp = P.stats.maxHp; P.energy = P.stats.maxEnergy; P.rage = 0;
  keepIframe = true;
}
const HP = 1e7;
function dummy(dx, dz, o) {
  o = o || {};
  const pp = G.player.group.position;
  const def = EV.MOBS.ENEMIES[G.stageIndex][1];
  const e = EV.Enemies.make(G, def, { pos: { x: pp.x + dx, z: pp.z + dz }, hp: o.hp || HP, dmg: o.dmg || 0 });
  e.speed = 0; e.busyT = 1e9; e.armor = 0; e.atkCd = 1e9; e.abilityCd = 1e9; e.behavior = 'passive';
  if (o.small) { e.radius = Math.min(e.radius, G.player.radius); }
  EV.Enemies.rebuildGrid(G);
  return e;
}
const lost = (e) => e.maxHp - (e.alive ? e.hp : 0);
const x = (e) => r2(lost(e) / G.player.stats.dmg);
function aimAt(e) {
  const P = G.player, lp = e.group.position;
  P.aimPoint.set(lp.x, lp.y + e.group.userData.hipY, lp.z);
}
function cast(id, rank, target, o) {
  o = o || {};
  const def = EV.DATA.skill(id);
  if (target) aimAt(target);
  return EV.Skills.cast(G, def, rank, Object.assign({ point: G.player.aimPoint.clone(), target, source: 'player' }, o));
}
function equip(id, rank) {
  const def = EV.DATA.skill(id);
  const entry = { id, rank, cd: 0 };
  if (def.slot === 'ult') { G.build.ult = entry; G.player.rage = 100; } else G.build.skills = [entry];
  EV.UI.buildSkillbar(G);
  return entry;
}
const S2c = () => EV.Skills2.counts;
const busyCounts = () => { const c = S2c(); return Object.keys(c).filter((k) => c[k] > 0).map((k) => k + ':' + c[k]); };
function playerSane() {
  const P = G.player;
  const bad = [];
  if (P.leapY && !P.leap) bad.push('leapY=' + r2(P.leapY));
  let minOp = 1;
  P.group.traverse((o) => { if (o.isMesh && o.material && !o.material.wireframe && o.material.opacity < minOp && !o.isSprite) minOp = o.material.opacity; });
  if (minOp < 0.25 && !EV.Skills2.state.stealth) bad.push('invisible');
  if (EV.Skills2.hidden(G)) bad.push('hidden');
  if (P.buffs.some((b) => /^(grab:|stance:|stealth$|burrow$|rush$|charge$)/.test(b.id) && b.t > 0.25)) bad.push('buff');
  if (G.enemies.some((e) => e.held)) bad.push('heldEnemy');
  return bad;
}
function afterClear() {
  EV.Skills.clear();
  tick(1);
  return { counts: busyCounts(), sane: playerSane() };
}

const out = { cases: [], exc: [] };
function run(name, fn) {
  const r = { name };
  try { Object.assign(r, fn()); } catch (err) { r.exc = shortErr(err); out.exc.push(name + ': ' + r.exc); }
  out.cases.push(r);
}

/* ================= GRAB (sürüngen: Yapışkan Dil) ================= */
gotoStage(1);
[1, 5].forEach((rk) => run('grab r' + rk + ' direct', () => {
  resetArena();
  const e = dummy(0, 7), o = dummy(4, 12);
  const ok = cast('r_tongue', rk, e);
  const held0 = S2c().holds;
  tick(3);
  const near = r2(EV.Creature.surfDist(e.group, G.player.group.position.x, G.player.group.position.z));
  secs(2.5);
  const p = EV.DATA.params(EV.DATA.skill('r_tongue'), rk);
  return { ok, held0, heldNearPlayer: near, dmgX: x(e), expect: r2(p.grabDmg + p.dmg), otherHit: x(o), moved: r2(e.group.position.distanceTo(new THREE.Vector3(G.player.group.position.x, e.group.position.y, G.player.group.position.z))),
    after: busyCounts(), clear: afterClear() };
}));
run('grab hold+aim+release (input)', () => {
  resetArena();
  const e = dummy(0, 6), side = dummy(-8, 2);
  const s = equip('r_tongue', 1);
  const P = G.player;
  P.lockTarget = e;
  I._press('KeyQ'); tick(1);
  const heldAfterPress = S2c().holds;
  secs(1.0);                       // basılı: taşır
  const stillHeld = S2c().holds, heldFlag = e.held;
  P.lockTarget = side;             // nişanı yandakine çevir
  I._release('KeyQ'); tick(1);
  const flying = S2c().flights;
  secs(1.5);
  return { heldAfterPress, stillHeld, heldFlag, flying, targetDmg: x(e), sideHit: x(side), cd: r2(s.cd), energyUsed: r2(P.stats.maxEnergy - P.energy), clear: afterClear() };
});
run('grab heavy (boss) = no hold', () => {
  resetArena();
  const e = dummy(0, 6); e.isMini = true;
  const ok = cast('r_tongue', 1, e);
  const r = { ok, holds: S2c().holds, dmg: x(e), stun: !!(e.st && e.st.stun) };
  e.isMini = false;
  r.clear = afterClear();
  return r;
});
run('grab target dies mid-hold', () => {
  resetArena();
  const e = dummy(0, 6);
  cast('r_tongue', 1, e, { hold: 'KeyQ' });
  I.keys.KeyQ = true;
  tick(5);
  EV.Combat.hitEnemy(G, e, e.hp + 10, { source: 'reaction', pure: true });
  tick(3);
  I.keys.KeyQ = false;
  return { holds: S2c().holds, flights: S2c().flights, busy: EV.Skills2.busy(G), clear: afterClear() };
});
run('grab clear mid-hold', () => {
  resetArena();
  const e = dummy(0, 6);
  cast('r_tongue', 1, e, { hold: 'KeyQ' });
  I.keys.KeyQ = true;
  tick(8);
  const c = afterClear();
  I.keys.KeyQ = false;
  return { eHeld: e.held, eY: r2(e.group.position.y - EV.World.groundY(e.group.position.x, e.group.position.z)), clear: c };
});

/* ================= ÖLÜM YUVARLANIŞI (ulti) ================= */
[1, 5].forEach((rk) => run('roll ult r' + rk, () => {
  resetArena();
  const e = dummy(0, 5);
  const p0 = G.player.group.position.clone();
  const ok = cast('r_u_blood', rk, e);
  tick(10);
  const locked = EV.Skills2.motion(G, 0);
  const iframeOk = G.player.iframe > 0;
  const p = EV.DATA.params(EV.DATA.skill('r_u_blood'), rk);
  secs(p.carry + 2);
  return { ok, locked, iframeOk, dmgX: x(e), expectApprox: r2(p.grabDmg + Math.floor(p.carry / p.rollTick) * p.rollDmg + p.dmg),
    playerMoved: r2(G.player.group.position.distanceTo(p0)), clear: afterClear() };
}));
run('roll ult on boss', () => {
  resetArena();
  const e = dummy(0, 6); e.isMini = true;
  const ep = e.group.position.clone();
  const ok = cast('r_u_blood', 1, e);
  tick(10);
  const pinned = e.stun > 0;
  secs(3);
  const r = { ok, pinned, bossMoved: r2(e.group.position.distanceTo(ep)), dmgX: x(e), clear: afterClear() };
  e.isMini = false;
  return r;
});

/* ================= ENGULF (hücre: Fagositoz) ================= */
gotoStage(0);
[1, 5].forEach((rk) => run('engulf r' + rk + ' swallow→spit (input)', () => {
  resetArena();
  const e = dummy(0, 5, { small: true }), o = dummy(3, 10);
  const s = equip('c_lash', rk);
  const P = G.player;
  P.lockTarget = e;
  const hp0 = (P.hp = P.stats.maxHp * 0.5);
  I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(1);
  const pending = EV.Skills2.pending(G, EV.DATA.skill('c_lash')), cdLock = r2(s.cd);
  secs(1.6);
  const inside = r2(e.group.position.distanceTo(P.group.position)), scale = r2(e.group.scale.x);
  const digested = x(e), healed = r2(P.hp - hp0);
  P.lockTarget = o;
  I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(1);
  const spitting = S2c().flights;
  const cdAfter = r2(s.cd);
  secs(1.5);
  return { pending, cdLock, inside, scale, digested, healed: healed > 0, spitting, cdAfter, preyTotal: x(e), otherHit: x(o), eScale: e.group.scale.x, clear: afterClear() };
}));
run('engulf auto-spit + digest kill', () => {
  resetArena();
  const e = dummy(0, 5, { small: true });
  const p = EV.DATA.params(EV.DATA.skill('c_lash'), 1);
  cast('c_lash', 1, e);
  secs(p.digest + 0.8);
  const autoSpat = S2c().holds === 0;
  resetArena();
  const k = dummy(0, 5, { small: true, hp: G.player.stats.dmg * 0.5 });
  const hp0 = (G.player.hp = G.player.stats.maxHp * 0.5);
  cast('c_lash', 1, k);
  secs(2);
  return { autoSpat, killed: !k.alive, healed: G.player.hp > hp0, holds: S2c().holds, clear: afterClear() };
});
run('engulf too big → slap', () => {
  resetArena();
  const e = dummy(0, 5); e.radius = G.player.radius * 5;
  const ok = cast('c_lash', 1, e);
  return { ok, holds: S2c().holds, dmg: x(e), clear: afterClear() };
});

/* ================= TETHER (hücre: Yapışkan İplik) ================= */
[1, 5].forEach((rk) => run('tether r' + rk + ' full', () => {
  resetArena();
  const e = dummy(0, 8);
  const p = EV.DATA.params(EV.DATA.skill('c_web'), rk);
  const hp0 = (G.player.hp = G.player.stats.maxHp * 0.5);
  const ok = cast('c_web', rk, e);
  const t0 = S2c().tethers;
  secs(p.dur + 0.5);
  return { ok, t0, dmgX: x(e), expect: r2(Math.floor(p.dur / p.tick) * p.dmg + p.end), healed: G.player.hp > hp0, slowed: !!(e.st && e.st.slow), left: S2c().tethers, clear: afterClear() };
}));
run('tether breaks by distance', () => {
  resetArena();
  const e = dummy(0, 8);
  cast('c_web', 1, e);
  secs(0.6);
  const d0 = x(e);
  const P = G.player;
  P.group.position.z -= 25;           // uzaklaş
  secs(0.2);
  const broken = S2c().tethers === 0;
  secs(4);
  return { broken, dmgBefore: d0, dmgAfter: x(e), noEndBurst: x(e) - d0 < 0.5, clear: afterClear() };
});
run('tether jump on death', () => {
  resetArena();
  const e = dummy(0, 8), f = dummy(3, 9);
  cast('c_web', 4, e);
  secs(0.6);
  EV.Combat.hitEnemy(G, e, e.hp + 10, { source: 'reaction', pure: true });
  secs(1.5);
  return { stillTethered: S2c().tethers, secondDmg: x(f), clear: afterClear() };
});

/* ================= MARK (sürüngen: Komodo Isırığı / memeli: Avcı İşareti) ================= */
gotoStage(1);
[1, 5].forEach((rk) => run('mark bite r' + rk + ' → hits → detonate', () => {
  resetArena();
  const e = dummy(0, 3.2), f = dummy(1.2, 3.6);
  const s = equip('r_fang', rk);
  const P = G.player;
  P.lockTarget = e;
  I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(1);
  const set = EV.Skills2.state.markSets[0];
  const marked = set ? set.marks.size : 0;
  const bite = x(e);
  for (let i = 0; i < 3; i++) { EV.Combat.hitEnemy(G, e, 1, { source: 'player' }); tick(5); }
  const n = set && set.marks.get(e.id) ? set.marks.get(e.id).n : 0;
  const before = lost(e);
  I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(1);
  const boom = r2((lost(e) - before) / P.stats.dmg);
  const p = EV.DATA.params(EV.DATA.skill('r_fang'), rk);
  return { marked, bite, stacks: n, boom, expectBoom: r2(p.boom + p.per * n), cd: r2(s.cd), expectCd: p.cd, marksLeft: S2c().marks, clear: afterClear() };
}));
run('mark auto-detonate at window end (half power)', () => {
  resetArena();
  const e = dummy(0, 3.2);
  const p = EV.DATA.params(EV.DATA.skill('r_fang'), 1);
  cast('r_fang', 1, e);
  const b = lost(e);
  const set = EV.Skills2.state.markSets[0];
  secs(p.win - 0.1);
  const n = set.marks.get(e.id).n;
  const b2 = lost(e);
  secs(0.4);
  return { stacksByTime: n, auto: r2((lost(e) - b2) / G.player.stats.dmg), expectHalf: r2((p.boom + p.per * n) * p.autoFrac), bite: r2(b / G.player.stats.dmg), left: S2c().marks, clear: afterClear() };
});
run('mark: marked dies → mark removed', () => {
  resetArena();
  const e = dummy(0, 3.2);
  cast('r_fang', 1, e);
  EV.Combat.hitEnemy(G, e, e.hp + 10, { source: 'reaction', pure: true });
  tick(2);
  return { left: S2c().marks, clear: afterClear() };
});
gotoStage(2);
[1, 5].forEach((rk) => run('mark area r' + rk + ' (ground aim → detonate)', () => {
  resetArena();
  const list = [dummy(0, 12), dummy(1.5, 13), dummy(-1.5, 13)];
  const s = equip('m_mark', rk);
  const P = G.player;
  P.lockTarget = list[0];
  I._press('KeyQ'); tick(1);
  const aiming = !!P.aiming;
  I._release('KeyQ'); tick(1);
  const set = EV.Skills2.state.markSets[0];
  const marked = set ? set.marks.size : 0;
  secs(0.5);
  I._press('KeyQ'); tick(1);
  const aimingOnRecast = !!P.aiming;
  I._release('KeyQ'); tick(1);
  return { aiming, marked, aimingOnRecast, total: r2(list.reduce((a, e) => a + x(e), 0)), cd: r2(s.cd), left: S2c().marks, clear: afterClear() };
}));

/* ================= PARRY (hücre: Zar Gerilimi / memeli: Dikenli Kürk) ================= */
[[0, 'c_membrane'], [2, 'm_quills']].forEach(([st, id]) => {
  gotoStage(st);
  [1, 5].forEach((rk) => run('parry ' + id + ' r' + rk + ' success', () => {
    resetArena();
    const a = dummy(0, 3), b = dummy(3, 1);
    const s = equip(id, rk);
    const P = G.player;
    I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(1);
    const cd0 = s.cd;
    P.iframe = 0;
    const hp0 = P.hp;
    const got = EV.Combat.hitPlayer(G, 999, { attacker: a, melee: true });
    tick(2);
    return { dmgTaken: r2(hp0 - P.hp), returned: got, counterX: x(a), stunned: !!(a.st && a.st.stun), splashOther: x(b), cdBefore: r2(cd0), cdAfter: r2(s.cd), shield: Math.round(P.shield), clear: afterClear() };
  }));
  run('parry ' + id + ' fail (late)', () => {
    resetArena();
    const a = dummy(0, 3);
    equip(id, 1);
    const P = G.player;
    I._press('KeyQ'); tick(1); I._release('KeyQ');
    secs(1.0);
    keepIframe = false;
    P.iframe = 0;
    const hp0 = P.hp;
    EV.Combat.hitPlayer(G, 50, { attacker: a, melee: true });
    const r = { dmgTaken: r2(hp0 - P.hp), counterX: x(a), clear: afterClear() };
    keepIframe = true;
    return r;
  });
  run('parry ' + id + ' vs boss telegraph', () => {
    resetArena();
    const bossE = dummy(0, 4); bossE.isMini = true;
    cast(id, 1, null);
    const P = G.player;
    P.iframe = 0;
    const hp0 = P.hp;
    let fired = false;
    EV.Decal.tele({ shape: 'circle', x: P.group.position.x, z: P.group.position.z, r: 3, windup: 0.2, owner: bossE,
      onFire: () => { fired = true; EV.Combat.hitPlayer(G, 500, { attacker: bossE, melee: false }); } });
    secs(0.4);
    const r = { fired, dmgTaken: r2(hp0 - P.hp), bossHit: x(bossE), clear: afterClear() };
    bossE.isMini = false;
    return r;
  });
});

/* ================= STEALTH (sürüngen: Bukalemun Pususu) ================= */
gotoStage(1);
[1, 5].forEach((rk) => run('stealth r' + rk + ' → pounce', () => {
  resetArena();
  const e = dummy(0, 7);
  const hunter = dummy(12, 0); hunter.behavior = 'aggressive'; hunter.aggroT = 10;
  equip('r_ambush', rk);
  const P = G.player;
  I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(2);
  const hidden = P.hidden;
  let minOp = 1;
  P.group.traverse((o) => { if (o.isMesh && o.material && o.material.opacity < minOp) minOp = o.material.opacity; });
  const aggroDropped = hunter.aggroT <= 0;
  P.lockTarget = e;
  const p0 = P.group.position.clone();
  I.mouse.left = true; tick(1); I.mouse.left = false;
  secs(0.6);
  const p = EV.DATA.params(EV.DATA.skill('r_ambush'), rk);
  let op = 1;
  P.group.traverse((o) => { if (o.isMesh && o.material && o.material.opacity < op) op = o.material.opacity; });
  return { hidden, camoOpacity: r2(minOp), aggroDropped, pounceDist: r2(P.group.position.distanceTo(p0)), ambushX: x(e),
    expectX: r2(p.mul * P.stats.critDmg), stunned: !!(e.st && e.st.stun), stealthLeft: !!EV.Skills2.state.stealth, opacityBack: r2(op), clear: afterClear() };
}));
run('stealth broken by hurt / timeout', () => {
  resetArena();
  const a = dummy(0, 3);
  cast('r_ambush', 1, null);
  tick(2);
  keepIframe = false;
  G.player.iframe = 0;
  EV.Combat.hitPlayer(G, 10, { attacker: a, melee: true });
  keepIframe = true;
  const brokeHurt = !EV.Skills2.state.stealth;
  cast('r_ambush', 1, null);
  secs(EV.DATA.params(EV.DATA.skill('r_ambush'), 1).dur + 0.3);
  const expired = !EV.Skills2.state.stealth;
  tick(2);
  return { brokeHurt, expired, hiddenAfter: G.player.hidden, sane: playerSane(), clear: afterClear() };
});
run('stealth → skill cast breaks + bonus', () => {
  resetArena();
  cast('r_ambush', 1, null);
  const m = EV.Skills2.ambushSkill(G, EV.DATA.skill('r_spear'));
  return { mul: m, stealth: !!EV.Skills2.state.stealth, clear: afterClear() };
});

/* ================= BURROW (sürüngen: Kum Dalışı) ================= */
[1, 5].forEach((rk) => run('burrow r' + rk + ' dive→move→emerge', () => {
  resetArena();
  const s = equip('r_dive', rk);
  const P = G.player;
  I._press('KeyQ'); tick(1); I._release('KeyQ');
  secs(0.4);
  const depth = r2(P.leapY), hidden = P.hidden, pending = EV.Skills2.pending(G, EV.DATA.skill('r_dive'));
  keepIframe = false; P.iframe = 0;
  const hp0 = P.hp;
  const got = EV.Combat.hitPlayer(G, 999, { attacker: null, melee: true });
  const hazard = EV.Combat.hitPlayer(G, 50, { dot: true, by: 'zehir bulutu' });
  keepIframe = true;
  const invuln = P.hp === hp0 && got === 0 && hazard === 0;
  const p0 = P.group.position.clone();
  I.keys.KeyW = true; secs(1.0); I.keys.KeyW = false;
  const moved = r2(P.group.position.distanceTo(p0));
  const e1 = dummy(0, 1.5), e2 = dummy(2, -1);
  I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(1);
  const p = EV.DATA.params(EV.DATA.skill('r_dive'), rk);
  const emergeX = x(e1);
  secs(0.6);
  return { depth, hidden, pending, invuln, moved, emergeX, expectRange: [r2(p.dmg), r2(p.dmg * (1 + p.growMax))], both: x(e2) > 0,
    cd: r2(s.cd), leapYAfter: r2(P.leapY), hiddenAfter: P.hidden, clear: afterClear() };
}));
run('burrow timeout + basic emerges + clear', () => {
  resetArena();
  cast('r_dive', 1, null);
  secs(3.6);
  const timedOut = !EV.Skills2.state.burrow;
  secs(0.5);
  cast('r_dive', 1, null);
  secs(0.5);
  const P = G.player;
  P.basicCd = 0;
  I.mouse.left = true; tick(1); I.mouse.left = false;
  const basicEmerged = !EV.Skills2.state.burrow;
  secs(0.5);
  cast('r_dive', 1, null);
  secs(0.3);
  const c = afterClear();
  return { timedOut, basicEmerged, leapYAfterClear: r2(P.leapY), clear: c };
});

/* ================= STANCE (sürüngen: Güneşlenme, memeli ulti: Vahşi Form) ================= */
[1, 5].forEach((rk) => run('stance r_heat r' + rk + ' toggle/drain/basic', () => {
  resetArena();
  const e = dummy(0, 2.4), f = dummy(1.6, 3.2);
  const s = equip('r_heat', rk);
  const P = G.player;
  P.lockTarget = e;
  I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(1);
  const on = !!EV.Skills2.state.stance, cdLock = r2(s.cd);
  const e0 = P.energy;
  secs(2);
  const netEnergy = r2(P.energy - e0);
  const atkSpd = r2(P.stats.atkSpd);
  I.mouse.left = true; secs(1.2); I.mouse.left = false;
  const burned = !!(e.st && e.st.burn), splash = x(f);
  I._press('KeyQ'); tick(1); I._release('KeyQ'); tick(1);
  const off = !EV.Skills2.state.stance;
  return { on, cdLock, netEnergy, atkSpd, burned, splash, off, cdAfterOff: r2(s.cd), atkSpdAfter: (tick(8), r2(P.stats.atkSpd)), clear: afterClear() };
}));
run('stance energy runs out', () => {
  resetArena();
  cast('r_heat', 1, null);
  const P = G.player;
  let offAt = null;
  G.addBuff({ id: 'test:noregen', t: 99, mods: { energyRegen: -1 } });   // dolum yok: duruş enerjiyi bitirmeli
  P.energy = 10;
  secs(5, (i) => { if (offAt == null && !EV.Skills2.state.stance) offAt = i; });
  P.buffs = [];
  return { turnedOff: !EV.Skills2.state.stance, offAtTick: offAt, clear: afterClear() };
});
gotoStage(2);
[1, 5].forEach((rk) => run('form ult m_u_rage r' + rk, () => {
  resetArena();
  const ring = [dummy(0, 3), dummy(3, 0), dummy(-3, 0), dummy(0, -3)];
  equip('m_u_rage', rk);
  const P = G.player;
  P.lockTarget = ring[0];
  I._press('KeyR'); tick(1); I._release('KeyR'); tick(1);
  const on = !!EV.Skills2.state.stance, rage = P.rage;
  I.mouse.left = true; secs(2.5); I.mouse.left = false;
  const behindHit = ring.slice(1).filter((e) => lost(e) > 0).length;
  const p = EV.DATA.params(EV.DATA.skill('m_u_rage'), rk);
  secs(p.dur);
  return { on, rage, behindHit, total: r2(ring.reduce((a, e) => a + x(e), 0)), ended: !EV.Skills2.state.stance, clear: afterClear() };
}));

/* ================= RUSH (hücre: Kamçı Motoru / memeli: Bizon Hücumu) ================= */
[[0, 'c_zap'], [2, 'm_stampede']].forEach(([st, id]) => {
  gotoStage(st);
  [1, 5].forEach((rk) => run('rush ' + id + ' r' + rk + ' tap vs hold', () => {
    const res = {};
    [['tap', 1], ['hold', 30]].forEach(([k, n]) => {
      resetArena();
      const path = dummy(0, 7), end = dummy(0, 30);
      equip(id, rk);
      const P = G.player;
      P.lockTarget = end;
      const p0 = P.group.position.clone();
      I._press('KeyQ'); tick(n); I._release('KeyQ');
      secs(1.5);
      res[k] = { moved: r2(P.group.position.distanceTo(p0)), trample: x(path), impact: x(end) };
    });
    res.clear = afterClear();
    return res;
  }));
  run('rush ' + id + ' ram heavy', () => {
    resetArena();
    const big = dummy(0, 8); big.isMini = true;
    cast(id, 1, big);
    secs(1.5);
    const r = { rushOver: !EV.Skills2.state.rush, ramX: x(big), clear: afterClear() };
    big.isMini = false;
    return r;
  });
});

/* ================= CHARGE (hücre: Kirpik Dönüşü / memeli: Kemik Kırıcı) ================= */
[[0, 'c_cilia'], [2, 'm_crush']].forEach(([st, id]) => {
  gotoStage(st);
  [1, 5].forEach((rk) => run('charge ' + id + ' r' + rk + ' tap vs full', () => {
    const res = {};
    [['tap', 1], ['full', 40]].forEach(([k, n]) => {
      resetArena();
      const e = dummy(0, 3.2);
      equip(id, rk);
      const P = G.player;
      P.lockTarget = e;
      I._press('KeyQ'); tick(1);
      const busy = EV.Skills2.busy(G);
      tick(n - 1); I._release('KeyQ');
      secs(0.8);
      res[k] = { busy, x: x(e), stunned: !!(e.st && e.st.stun) };
    });
    const p = EV.DATA.params(EV.DATA.skill(id), rk);
    res.expectFull = p.dmg;
    res.clear = afterClear();
    return res;
  }));
});

/* ================= COMMAND (memeli: Uluma) ================= */
gotoStage(2);
[1, 5].forEach((rk) => run('command r' + rk + ' ghosts + strike', () => {
  resetArena();
  const e = dummy(0, 9);
  const P = G.player;
  const ok = cast('m_howl', rk, e);
  const allies = G.enemies.filter((a) => a.ally && a.alive);
  const buffed = allies.every((a) => a.buffT > 0 && a.dmg > a.baseDmg);
  secs(1.2);
  const p = EV.DATA.params(EV.DATA.skill('m_howl'), rk);
  return { ok, allies: allies.length, expectPack: p.pack, buffed, vuln: !!(e.st && e.st.vuln), targetLost: Math.round(lost(e)), cmds: S2c().cmds, clear: afterClear() };
}));
run('command buffs existing summons, no ghosts', () => {
  resetArena();
  const e = dummy(0, 9);
  const s1 = EV.Enemies.spawnSummon(G, { dur: 20, hp: 100, dmg: 10 });
  const s2 = EV.Enemies.spawnSummon(G, { dur: 20, hp: 100, dmg: 10 });
  cast('m_howl', 1, e);
  const allies = G.enemies.filter((a) => a.ally && a.alive).length;
  return { allies, buffed: s1.dmg > s1.baseDmg && s2.dmg > s2.baseDmg, clear: afterClear() };
});

/* ================= YANKI (echo): hiçbir tür oyuncuyu taşımaz/gizlemez ================= */
const ECHO = ['c_lash', 'c_web', 'c_cilia', 'c_zap', 'c_membrane', 'r_tongue', 'r_dive', 'r_ambush', 'r_heat', 'r_fang', 'r_u_blood',
  'm_howl', 'm_crush', 'm_mark', 'm_quills', 'm_stampede', 'm_u_rage'];
ECHO.forEach((id) => run('echo ' + id, () => {
  const def = EV.DATA.skill(id);
  gotoStage(def.stage);
  resetArena();
  const e = dummy(0, 6), f = dummy(2, 7);
  const P = G.player;
  const p0 = P.group.position.clone();
  const ok = cast(id, 3, e, { source: 'echo', dmgMul: 0.6 });
  secs(0.2);
  const midState = { hidden: P.hidden, leapY: r2(P.leapY), stance: !!EV.Skills2.state.stance, rush: !!EV.Skills2.state.rush, holds: S2c().holds };
  secs(3);
  return { ok, moved: r2(P.group.position.distanceTo(p0)), midState, dmg: r2(x(e) + x(f)), after: busyCounts(), sane: playerSane(), clear: afterClear() };
}));

/* ================= ölüm sırasında: toprak altı / gizlilik / duruş kapanır ================= */
run('death ends states', () => {
  gotoStage(1);
  resetArena();
  cast('r_dive', 1, null);
  secs(0.3);
  G.player.alive = false;
  tick(1);
  const r = { burrow: !!EV.Skills2.state.burrow, leapY: r2(G.player.leapY) };
  G.player.alive = true;
  G.paused = false;
  r.clear = afterClear();
  return r;
});

EV.Build.stats = origStats;
return out;
