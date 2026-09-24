// ---- sk-new: yeni yetenekler (beam/barrage/boomerang/totem/blink/wave) — hasar, temizlik, yankı, sağlamlık ----
// Her yeni yetenek: rütbe 1 ve 5, tek hedef + 8'li sürü, yankı (echo) atışı, hedef ölürken atış,
// farklı dt ile kare hızı bağımsızlığı. Referans: c_drop, c_acid, c_lash (+ her aşamadan birer eski yetenek).
// Hasarlar oyuncu hasarının katı (x) olarak; "/cd" = atış başına hasar ÷ bekleme.
const G = EV.Game;
let DT = 1 / 30;
T.start('normal');

const NEW_IDS = [
  'c_colony', 'c_spores', 'c_capsid', 'c_osmo', 'c_flow', 'c_u_eel',
  'r_sunray', 'r_disc', 'r_nest', 'r_dive', 'r_quake', 'r_u_sunrain',
  'm_moonbeam', 'm_raid', 'm_totem', 'm_shadow', 'm_stampede', 'm_u_claws',
];
const REF_IDS = ['c_drop', 'c_acid', 'c_lash', 'c_u_nova', 'r_spear', 'r_breath', 'r_u_meteor', 'm_claw', 'm_wave', 'm_u_hunt'];

// kritik rastgeleliği ölçümü bozmasın (zorunlu kritikler — hep kritik / her N. tık — yine çalışır)
const origStats = EV.Build.stats;
EV.Build.stats = function (g, b) { const s = origStats(g, b); s.crit = 0; return s; };

function shortErr(e) { return String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '); }
const r2 = (v) => Math.round(v * 100) / 100;

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
const secs = (s, hook) => tick(Math.ceil(s / DT), hook);

function gotoStage(s) {
  if (G.stageIndex !== s || !G._skInit) {
    G.stageIndex = s;
    G.startStage(false);
    for (let i = 0; i < 5 && T.handleModals({ pick: 'first' }); i++) { /* başlangıç kartı */ }
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
  EV.FX.clear();
  Object.assign(P, { dash: null, leap: null, leapY: 0, hunt: null, aiming: null, lockTarget: null, hover: null,
    buffs: [], shield: 0, shieldT: 0, st: null, iframe: 5, alive: true });
  P.vel.set(0, 0, 0); P.impulse.set(0, 0, 0);
  if (!G._skHome) {
    const s = EV.World.randomSpawn({ x: 0, z: 0 }, 0, 6, 6);
    G._skHome = { x: s.x, z: s.z };
  }
  P.group.position.set(G._skHome.x, EV.World.groundY(G._skHome.x, G._skHome.z), G._skHome.z);
  P.yaw = 0; P.aimYaw = 0; P.group.rotation.y = 0; P.faceT = 0;
  G.build.skills = []; G.build.ult = null; G.build.passives = [];
  G.legacy.echoes = [];
  EV.Build.recompute(G);
  P.stats = EV.Build.stats(G, null);
  P.hp = P.stats.maxHp; P.energy = P.stats.maxEnergy; P.rage = 0;
}

const HP = 1e7;
function dummy(s, dx, dz) {
  const pp = G.player.group.position;
  const def = EV.MOBS.ENEMIES[s][1];
  const e = EV.Enemies.make(G, def, { pos: { x: pp.x + dx, z: pp.z + dz }, hp: HP, dmg: 0 });
  e.speed = 0; e.busyT = 1e9; e.armor = 0; e.atkCd = 1e9; e.abilityCd = 1e9; e.behavior = 'passive';
  e.group.rotation.y = Math.PI / 2;     // yana dönük: kapsülün uzunluğu herkese aynı
  return e;
}
function layout(s, kind) {
  let out;
  if (kind === 'single') out = [dummy(s, 0, 5)];
  else {
    const spots = [[0, 5], [-2.2, 7], [2.2, 7], [-2.2, 9.5], [2.2, 9.5], [0, 12], [-3.5, 4], [3.5, 4]];
    out = spots.map(([x, z]) => dummy(s, x, z));
  }
  EV.Enemies.rebuildGrid(G);
  return out;
}
const lost = (e) => e.maxHp - (e.alive ? e.hp : 0);

/** Etkinin toplam ömrü (+ DoT'lerin sönmesi için pay). */
function effectDur(def, p) {
  switch (def.kind) {
    case 'beam': return p.dur;
    case 'barrage': return p.delay + p.count * p.gap;
    case 'boomerang': return (p.range / p.speed) * 3 + 1;
    case 'totem': return p.dur;
    case 'blink': return 1 + (p.zone ? p.zone.dur : 0);
    case 'wave': return p.range / p.speed + (p.waves || 1) * (p.gap || 0.4);
    case 'zone': return p.dur;
    case 'orbit': return p.dur;
    default: return 1.5;
  }
}

function sceneKids() { return G.scene.children.length; }

/** Tek ölçüm: kur, at, bekle, ölç, temizle. */
function measure(def, rank, lay, o) {
  o = o || {};
  const r = { id: def.id, rank, lay, ok: null, exc: null };
  try {
    resetArena();
    const s = def.stage;
    const tg = layout(s, lay);
    const P = G.player;
    const S = P.stats;
    const main = tg[0];
    P.lockTarget = main;
    const lp = main.group.position;
    P.aimPoint.set(lp.x, lp.y + main.group.userData.hipY, lp.z);
    const p = EV.DATA.params(def, rank);
    const start = P.group.position.clone();
    const kids0 = sceneKids();
    const before = new Set(G.scene.children);
    const src = o.echo ? 'echo' : 'player';
    r.ok = EV.Skills.cast(G, def, rank, { point: P.aimPoint.clone(), target: main, source: src, dmgMul: o.echo ? 0.6 : 1 });
    let peak = 0;
    let killed = false;
    const dur = effectDur(def, p) + 5.5;
    secs(dur, (i) => {
      const k = sceneKids() - kids0;
      if (k > peak) peak = k;
      if (o.kill && !killed && i * DT >= 0.4) {      // hedef atışın ortasında ölür
        killed = true;
        EV.Combat.hitEnemy(G, main, main.hp + 10, { source: 'reaction', pure: true });
      }
    });
    const dmg = tg.reduce((a, e) => a + lost(e), 0);
    const top = Math.max.apply(null, tg.map(lost));
    r.total = r2(dmg / S.dmg);                  // atış başına toplam (x oyuncu hasarı)
    r.single = r2(top / S.dmg);                 // en çok hasar alan hedef
    r.cd = p.cd;
    r.perCdSingle = r2(top / S.dmg / p.cd);
    r.perCdTotal = r2(dmg / S.dmg / p.cd);
    r.moved = r2(P.group.position.distanceTo(start));
    r.peakMeshes = peak;
    r.natural = EV.Skills.counts;                // süre dolunca kendiliğinden temizlenmeli
    r.stuck = !!(P.dash || P.leap || P.hunt);
    const bad = [];
    if (!isFinite(P.group.position.x) || !isFinite(P.group.position.z)) bad.push('playerPos');
    tg.forEach((e) => { if (!isFinite(e.hp) || !isFinite(e.group.position.x)) bad.push('enemy#' + e.id); });
    r.nan = bad;
    // zorla temizlik: sahne ve sayaçlar başlangıca dönmeli
    EV.Skills.cast(G, def, rank, { point: P.aimPoint.clone(), target: tg[1] || null, source: src, dmgMul: 1 });
    tick(3);
    EV.Skills.clear();
    EV.FX.clear();
    const c = EV.Skills.counts;
    r.clearLeft = Object.keys(c).filter((k) => c[k] > 0).map((k) => k + ':' + c[k]);
    // temizlikten sonra sahnede kalan YENİ nesneler (yiyecek/sandık gibi dünya nesneleri Group'tur; efektler Mesh)
    const extra = G.scene.children.filter((o) => !before.has(o) && o.isMesh && !(o.geometry && o.geometry.type === 'OctahedronGeometry'));   // oktahedron = dünyadaki toplanabilirler
    r.sceneDelta = extra.length;
    r.sceneNew = extra.slice(0, 4).map((o) => (o.geometry && o.geometry.type) + '#' + (o.material && o.material.color ? o.material.color.getHexString() : ''));
    const bf = P.buffs.filter((b) => String(b.id).indexOf('beam:') === 0 && b.t > 0);
    r.buffLeft = bf.length;
  } catch (err) {
    r.exc = shortErr(err);
  }
  return r;
}

const out = { table: [], echo: [], kill: [], dt: [], leaks: [], exc: [], geo: {} };
const all = REF_IDS.concat(NEW_IDS).map((id) => EV.DATA.skill(id));
all.sort((a, b) => a.stage - b.stage);

all.forEach((def) => {
  gotoStage(def.stage);
  const isNew = NEW_IDS.indexOf(def.id) >= 0;
  [1, 5].forEach((rk) => {
    const a = measure(def, rk, 'single');
    const b = measure(def, rk, 'pack');
    out.table.push({ id: def.id, kind: def.kind, slot: def.slot, isNew, rank: rk, cd: a.cd,
      single: a.single, perCdSingle: a.perCdSingle, packTotal: b.total, perCdPack: b.perCdTotal,
      peakMeshes: Math.max(a.peakMeshes || 0, b.peakMeshes || 0), moved: a.moved });
    [a, b].forEach((m) => {
      if (m.exc) out.exc.push(def.id + ':' + rk + ':' + m.exc);
      const nat = m.natural ? Object.keys(m.natural).filter((k) => m.natural[k] > 0) : [];
      if (nat.length || (m.clearLeft && m.clearLeft.length) || m.sceneDelta > 0 || m.stuck || (m.nan && m.nan.length) || m.buffLeft || m.ok === false) {
        out.leaks.push({ id: def.id, rank: rk, lay: m.lay, ok: m.ok, natural: m.natural, clearLeft: m.clearLeft, sceneDelta: m.sceneDelta, sceneNew: m.sceneNew, stuck: m.stuck, nan: m.nan, buffLeft: m.buffLeft });
      }
    });
  });
  if (!isNew) return;
  // yankı: oyuncuyu taşımamalı, hata atmamalı
  [1, 3].forEach((rk) => {
    const e = measure(def, rk, 'pack', { echo: true });
    out.echo.push({ id: def.id, rank: rk, ok: e.ok, perCdPack: e.perCdTotal, moved: e.moved, clearLeft: e.clearLeft, sceneDelta: e.sceneDelta, exc: e.exc });
  });
  // hedef atışın ortasında ölür (oyuncu + yankı)
  const k1 = measure(def, 5, 'single', { kill: true });
  const k2 = measure(def, 3, 'single', { kill: true, echo: true });
  out.kill.push({ id: def.id, player: k1.exc || 'ok', echo: k2.exc || 'ok', left: (k1.clearLeft || []).concat(k2.clearLeft || []) });
});

// kare hızı bağımsızlığı: aynı atış 1/20, 1/30, 1/60 sn adımlarla, aynı rastgele tohumla
const realRandom = Math.random;
function seed(a) {           // mulberry32
  Math.random = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
NEW_IDS.forEach((id) => {
  const def = EV.DATA.skill(id);
  gotoStage(def.stage);
  const res = {};
  [1 / 20, 1 / 30, 1 / 60].forEach((d) => {
    DT = d;
    seed(12345);
    const m = measure(def, 1, 'pack');
    Math.random = realRandom;
    res[Math.round(1 / d)] = m.total;
  });
  DT = 1 / 30;
  const v = Object.values(res);
  out.dt.push({ id, fps20: res[20], fps30: res[30], fps60: res[60], spread: r2((Math.max(...v) - Math.min(...v)) / Math.max(1e-6, Math.max(...v))) });
});

// otomatik atış (G) açıkken ışın nişangahı değil hedefi izlemeli; kapalıyken nişangahı izler
out.autoBeam = ['r_sunray', 'm_moonbeam'].map((id) => {
  const def = EV.DATA.skill(id);
  gotoStage(def.stage);
  const row = { id };
  [true, false].forEach((auto) => {
    resetArena();
    const tg = layout(def.stage, 'single');
    const P = G.player;
    P.autoCast = auto;
    P.lockTarget = null;
    EV.Skills.cast(G, def, 1, { point: tg[0].group.position.clone(), target: tg[0], source: 'player' });
    P.yaw = Math.PI * 0.6;               // kamera (nişangah) hedeften uzağa bakar
    secs(2.5, () => { P.yaw = Math.PI * 0.6; });
    row[auto ? 'autoDmg' : 'manualDmg'] = r2(lost(tg[0]) / P.stats.dmg);
  });
  G.player.autoCast = false;
  return row;
});

out.geo = { geometries: G.renderer.info.memory.geometries, textures: G.renderer.info.memory.textures };
EV.Build.stats = origStats;
return out;
