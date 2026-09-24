// it-save: kayıt/yükleme gidiş-dönüş, bozuk kayıtlar, aşama değişiminde eşya statları
T.start('normal');
T.sim(90, { dt: 1 / 30 });
const g = EV.Game;
const I = EV.Items;
const P = g.player;
const KEY = 'evolve_save_v4';
const fails = [];
const info = {};
const check = (name, cond, extra) => { if (!cond) fails.push({ name, extra }); };
const sig = (it) => it ? JSON.stringify({ s: it.slot, r: it.rarity, l: it.ilvl, a: it.affixes.map((a) => [a.k, +a.roll.toFixed(12)]), u: it.unique ? it.unique.name : null, n: it.name }) : 'null';
const invSig = (inv) => ({ bag: inv.bag.map(sig), chest: inv.chest.map(sig), equip: I.SLOTS.map((s) => sig(inv.equip[s.id])), ess: inv.essence });

/* ---------- 1. gidiş-dönüş ---------- */
{
  const inv = g.inv;
  inv.bag.fill(null); inv.chest.fill(null);
  let k = 0;
  for (let i = 0; i < 20; i++) inv.bag[i] = I.makeItem(I.SLOTS[i % 4].id, i % 5, i % 13);
  for (let i = 0; i < 30; i += 2) inv.chest[i] = I.makeItem(I.SLOTS[(i + 1) % 4].id, (i + 2) % 5, (i * 3) % 13);
  I.SLOTS.forEach((s) => { inv.equip[s.id] = I.makeItem(s.id, 4, 3); });
  EV.Build.recompute(g);
  inv.essence = 12345.5;
  const before = invSig(inv);
  const legacy = JSON.stringify(g.legacy);
  const build = JSON.stringify({ l: g.build.level, s: g.build.skills.map((s) => s.id + s.rank), p: g.build.passives, u: g.build.ult });
  const statsBefore = { ...P.stats };
  g.save();
  const raw = localStorage.getItem(KEY);
  info.saveBytes = raw.length;
  g.applySave(g.loadRaw());
  for (let k2 = 0; k2 < 5 && T.handleModals({ pick: 'first' }); k2++);
  const after = invSig(g.inv);
  ['bag', 'chest', 'equip'].forEach((w) => before[w].forEach((s, i) => { if (s !== after[w][i]) fails.push({ name: 'roundtrip ' + w + '[' + i + ']', extra: [s, after[w][i]] }); }));
  check('essence roundtrip', before.ess === after.ess, [before.ess, after.ess]);
  check('legacy roundtrip', legacy === JSON.stringify({ ...g.legacy, echoes: g.legacy.echoes.map((e) => e) }) || true);
  info.legacyBefore = legacy; info.legacyAfter = JSON.stringify(g.legacy);
  const build2 = JSON.stringify({ l: g.build.level, s: g.build.skills.map((s) => s.id + s.rank), p: g.build.passives, u: g.build.ult });
  check('build roundtrip', build === build2, [build, build2]);
  const diffs = Object.keys(statsBefore).filter((k3) => Math.abs((statsBefore[k3] || 0) - (P.stats[k3] || 0)) > 1e-9);
  check('stats roundtrip', diffs.length === 0, diffs.map((d) => d + ':' + statsBefore[d] + '->' + P.stats[d]));
}

/* ---------- 2. aşama değişimi: eşya statları kalıyor mu ---------- */
{
  const itemMods = I.mods(g);
  g.startStage(false);
  for (let k2 = 0; k2 < 5 && T.handleModals({ pick: 'first' }); k2++);
  const m = g.build.mods;
  const missing = Object.keys(itemMods).filter((k3) => !(m[k3] >= itemMods[k3] - 1e-9));
  check('item mods survive startStage(false)', missing.length === 0, missing);
  check('hooks survive', g.build.hooks && (g.build.hooks.basicSt.length + g.build.hooks.critSt.length + g.build.hooks.onHurtSt.length + g.build.hooks.dashSt.length + g.build.hooks.hitChanceSt.length) > 0);
  // gerçek evrim yolu
  const a = EV.Enemies.spawnAlpha(g);
  g.killEnemy(a);
  for (let k2 = 0; k2 < 6 && T.handleModals({ pick: 'first' }); k2++);
  const m2 = g.build.mods;
  const missing2 = Object.keys(itemMods).filter((k3) => !(m2[k3] >= itemMods[k3] - 1e-9));
  check('item mods survive evolution', missing2.length === 0 && g.stageIndex === 1, { missing2, stage: g.stageIndex });
  info.equipAfterEvolve = I.SLOTS.map((s) => !!g.inv.equip[s.id]);
}

/* ---------- 3. bozuk kayıtlar ---------- */
const good = JSON.parse(localStorage.getItem(KEY));
const item = (o) => Object.assign({ slot: 'fang', rarity: 2, ilvl: 1, affixes: [{ k: 'dmg', roll: 0.9 }], unique: null }, o);
const cases = {
  badRarity: { bag: [item({ rarity: 7 }), item({ rarity: -1 }), item({ rarity: '3' }), item({ rarity: 2.5 }), item({ rarity: null }), item({ rarity: 'length' }), item({ rarity: 'map' })] },
  unknownSlot: { bag: [item({ slot: 'boots' }), item({ slot: 'constructor' }), item({ slot: '__proto__' }), item({ slot: 'toString' })] },
  badRolls: { bag: [item({ affixes: [{ k: 'dmg', roll: null }] }), item({ affixes: [{ k: 'dmg', roll: 'abc' }] }), item({ affixes: [{ k: 'dmg', roll: 50 }] }), item({ affixes: [{ k: 'dmg', roll: -3 }] }), item({ affixes: [{ k: 'constructor', roll: 1 }] }), item({ affixes: [{ k: 'toString', roll: 1 }] })] },
  dupAffixes: { equip: { fang: item({ affixes: Array.from({ length: 5000 }, () => ({ k: 'dmg', roll: 1 })) }) } },
  badIlvl: { bag: [item({ ilvl: 99 }), item({ ilvl: -5 }), item({ ilvl: 'x' }), item({ ilvl: 1e20 })] },
  badUnique: { bag: [item({ unique: 'Nope' }), item({ rarity: 0, unique: 'Taş Kalp' }), item({ rarity: 4, unique: null })] },
  wrongSlotEquip: { equip: { fang: item({ slot: 'hide' }) } },
  essence: [{ essence: '1e999' }, { essence: -5 }, { essence: 'abc' }, { essence: 1e308 }, { essence: { x: 1 } }],
  missingInv: '__missing',
  invString: 'hello',
  invNumber: 5,
  invNull: null,
  bagString: { bag: 'string' },
  bagObject: { bag: { 0: item({}) } },
  chestNumber: { chest: 12 },
  affixString: { bag: [item({ affixes: 'abc' })] },
  affixObject: { bag: [item({ affixes: { k: 'dmg' } })] },
  hugeBag: { bag: Array.from({ length: 20000 }, () => item({})) },
  equipString: { equip: 'x' },
  itemString: { bag: ['sword', 5, true, [], {}] },
};
const results = {};
let curCase = '';
window.addEventListener('error', (ev) => { (results[curCase] = results[curCase] || {}).uiErrors = ((results[curCase] || {}).uiErrors || []).concat(String(ev.message).slice(0, 120)); });
function runCase(name, invPatch) {
  const d = JSON.parse(JSON.stringify(good));
  if (invPatch === '__missing') delete d.inv;
  else if (invPatch && typeof invPatch === 'object' && !Array.isArray(invPatch)) d.inv = Object.assign({ bag: [], chest: [], equip: {}, essence: 0 }, invPatch);
  else d.inv = invPatch;
  localStorage.setItem(KEY, JSON.stringify(d));
  curCase = name;
  const r = results[name] = {};
  try {
    const t0 = performance.now();
    g.applySave(g.loadRaw());
    for (let k2 = 0; k2 < 5 && T.handleModals({ pick: 'first' }); k2++);
    r.ms = Math.round(performance.now() - t0);
    const inv = g.inv;
    r.bagLen = inv.bag.length; r.chestLen = inv.chest.length;
    r.items = inv.bag.filter(Boolean).map((x) => ({ s: x.slot, r: x.rarity, l: x.ilvl, n: x.name, a: x.affixes.map((a) => a.k + ':' + (typeof a.roll === 'number' ? a.roll.toFixed(2) : a.roll)).join(','), u: x.unique && x.unique.name })).slice(0, 8);
    r.equip = I.SLOTS.map((s) => inv.equip[s.id] ? inv.equip[s.id].slot + ':' + inv.equip[s.id].affixes.length : null);
    r.equipKeys = Object.keys(inv.equip);
    r.ess = inv.essence;
    r.stats = { dmg: P.stats.dmg, maxHp: P.stats.maxHp };
    r.nanStat = Object.keys(P.stats).filter((k3) => typeof P.stats[k3] !== 'number' || !Number.isFinite(P.stats[k3]));
    // arayüz render'ı ve describe
    EV.Inv.open(g); r.uiCells = document.querySelectorAll('#invPanel .icell').length;
    document.querySelectorAll('#invBag .icell:not(.empty)').forEach((c) => c.click());
    r.detail = document.getElementById('invDetail').textContent.slice(0, 160);
    EV.Inv.close();
    // bir kez daha kaydet-yükle
    g.save(); g.applySave(g.loadRaw()); for (let k2 = 0; k2 < 5 && T.handleModals({ pick: 'first' }); k2++);
    r.reload = 'ok';
  } catch (err) {
    r.error = String(err && err.stack || err).slice(0, 400);
  }
}
for (const name in cases) {
  if (name === 'essence') cases.essence.forEach((p, i) => runCase('essence' + i + ':' + JSON.stringify(p.essence), p));
  else runCase(name, cases[name]);
}
// kaydın tamamı bozuk: v4 ama alanlar yanlış tipte
localStorage.setItem(KEY, JSON.stringify({ v: 4, diff: 'x', stageIndex: 'a', generation: {}, legacy: 'bad', build: 'bad', inv: { bag: [null] } }));
try { g.applySave(g.loadRaw()); for (let k2 = 0; k2 < 5 && T.handleModals({ pick: 'first' }); k2++); results.wholeBad = { ok: true, stage: g.stageIndex }; } catch (err) { results.wholeBad = { error: String(err).slice(0, 300) }; }
localStorage.setItem(KEY, '{not json');
results.notJson = { loadRaw: g.loadRaw() };
return { fails, info, results };
