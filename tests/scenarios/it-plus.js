// it-plus: +9 basma (başarı/başarısız/düşme, zorla Math.random), bedel artışı, statlar,
// kayıt gidiş-dönüş (eski biçim dahil), yeni yuvalar (Pençe/Kuyruk), benzersizler, takımlar,
// Apex ve özel av ödülleri, envanter arayüzü (iki dokunuş onayı).
T.start('normal');
const g = EV.Game;
const I = EV.Items;
const IC = EV.CFG.ITEMS;
const P = g.player;
const $ = (id) => document.getElementById(id);
const fails = [];
const info = {};
const check = (name, cond, extra) => { if (!cond) fails.push({ name, extra }); };
const realRandom = Math.random;
const withRandom = (v, fn) => { Math.random = () => v; try { return fn(); } finally { Math.random = realRandom; } };
const toasts = [];
const origToast = EV.UI.toast;
EV.UI.toast = function (t) { toasts.push(String(t).replace(/<[^>]+>/g, ' ')); return origToast.apply(this, arguments); };
const ALL_SLOTS = () => { const e = {}; I.SLOTS.forEach((s) => { e[s.id] = null; }); return e; };
const reset = () => { g.inv.bag.fill(null); g.inv.chest.fill(null); g.inv.equip = ALL_SLOTS(); EV.Build.recompute(g); };
g.apexTimer = 1e9;

/* ---------- 1. basma: başarı zinciri 0 → 9, bedel ve değerler ---------- */
{
  reset();
  const it = I.makeItem('fang', 3, 2);
  it.affixes = [{ k: 'dmg', roll: 1 }, { k: 'crit', roll: 1 }, { k: 'atkSpd', roll: 1 }];
  g.inv.bag[0] = it;
  g.inv.essence = 1e7;
  const v0 = I.value(it, it.affixes[0]);
  const chain = [];
  withRandom(0, () => {
    for (let k = 0; k < 9; k++) {
      const c = I.plusCost(it), e0 = g.inv.essence;
      const r = I.enhance(g, 'bag', 0);
      chain.push({ to: it.plus, cost: c, paid: e0 - g.inv.essence, res: r.result, ch: r.chance });
      check('success step ' + k, r.ok && r.result === 'success' && it.plus === k + 1 && e0 - g.inv.essence === c, r);
    }
  });
  info.chain = chain;
  check('costs strictly increase', chain.every((x, i) => i === 0 || x.cost > chain[i - 1].cost), chain.map((x) => x.cost));
  check('name +9 prefix', it.name.startsWith('+9 '), it.name);
  const v9 = I.value(it, it.affixes[0]);
  info.value = { v0, v9, ratio: v9 / v0 };
  check('+9 = ×1.85 affix power', Math.abs(v9 / v0 - 1.85) < 1e-9, info.value);
  const e1 = g.inv.essence;
  const rmax = I.enhance(g, 'bag', 0);
  check('+9 refused (max), no charge', rmax.result === 'max' && it.plus === 9 && g.inv.essence === e1, rmax);
  check('plusCost at max = Infinity', I.plusCost(it) === Infinity);
  const d = I.describe(it).join(' | ');
  check('describe shows effective (+9) value', d.includes(EV.DATA.modText('dmg', v9)), d);
}

/* ---------- 2. basma: başarısızlık ve düşme ---------- */
{
  reset();
  const it = I.makeItem('hide', 2, 1);
  g.inv.bag[1] = it;
  g.inv.essence = 1e7;
  const res = {};
  withRandom(0.999, () => {
    // +0/+1 → %100: 0.999 < 1 → başarı
    it.plus = 0; res.p0 = I.enhance(g, 'bag', 1).result;
    it.plus = 1; res.p1 = I.enhance(g, 'bag', 1).result;
    it.plus = 3; let e0 = g.inv.essence; let c = I.plusCost(it); const r3 = I.enhance(g, 'bag', 1);
    res.p3 = { r: r3.result, plus: it.plus, paid: e0 - g.inv.essence, c };
    it.plus = 5; e0 = g.inv.essence; const r5 = I.enhance(g, 'bag', 1);
    res.p5 = { r: r5.result, plus: it.plus, paid: e0 - g.inv.essence };
    it.plus = 6; e0 = g.inv.essence; c = I.plusCost(it); const r6 = I.enhance(g, 'bag', 1);
    res.p6 = { r: r6.result, plus: it.plus, paid: e0 - g.inv.essence, c, name: it.name };
    it.plus = 8; const r8 = I.enhance(g, 'bag', 1);
    res.p8 = { r: r8.result, plus: it.plus };
  });
  info.fail = res;
  check('+0→+1 always succeeds', res.p0 === 'success');
  check('+1→+2 always succeeds', res.p1 === 'success');
  check('+3 fail keeps level, essence spent', res.p3.r === 'fail' && res.p3.plus === 3 && res.p3.paid === res.p3.c, res.p3);
  check('+5 fail does not drop', res.p5.r === 'fail' && res.p5.plus === 5, res.p5);
  check('+6 fail drops to +5, essence spent', res.p6.r === 'drop' && res.p6.plus === 5 && res.p6.paid === res.p6.c && res.p6.name.startsWith('+5 '), res.p6);
  check('+8 fail drops to +7', res.p8.r === 'drop' && res.p8.plus === 7, res.p8);
  // eşik: şans sınırında (random == chance → başarısız, altı → başarılı)
  it.plus = 4;
  const edgeFail = withRandom(IC.plusChance[4], () => I.enhance(g, 'bag', 1).result);
  it.plus = 4;
  const edgeOk = withRandom(IC.plusChance[4] - 1e-6, () => I.enhance(g, 'bag', 1).result);
  check('chance boundary', edgeFail === 'fail' && edgeOk === 'success', [edgeFail, edgeOk]);
  // yetersiz öz
  it.plus = 2; g.inv.essence = I.plusCost(it) - 1;
  const rp = I.enhance(g, 'bag', 1);
  check('poor refused, no change', rp.result === 'poor' && it.plus === 2 && g.inv.essence === I.plusCost(it) - 1, rp);
  // geçersiz konumlar çökmeden reddedilir
  g.inv.essence = 1e6;
  const bad = [['bag', 99], ['bag', -1], ['bag', '1'], ['chest', 3], ['equip', 'boots'], ['equip', '__proto__'], ['essence', 0], [null, null], ['bag', 1.5]]
    .map(([w, i]) => I.enhance(g, w, i).result);
  check('invalid where/idx → none', bad.every((x) => x === 'none'), bad);
  // Monte Carlo: +8→+9 başarı oranı ~%40
  it.plus = 8; g.inv.essence = 1e9; let ok = 0;
  for (let k = 0; k < 2000; k++) { it.plus = 8; if (I.enhance(g, 'bag', 1).ok) ok++; }
  info.rate8to9 = ok / 2000;
  check('+9 chance ~40%', Math.abs(ok / 2000 - 0.4) < 0.04, ok / 2000);
}

/* ---------- 3. bedel büyümesi (seviye / nadirlik / eşya seviyesi) ---------- */
{
  const table = {};
  let mono = true;
  for (let r = 0; r <= 4; r++) for (const il of [0, 2, 12]) {
    const it = I.makeItem('relic', r, il);
    const row = [];
    for (let p = 0; p < 9; p++) { it.plus = p; row.push(I.plusCost(it)); }
    table['r' + r + '/il' + il] = row;
    for (let p = 1; p < 9; p++) if (!(row[p] > row[p - 1])) mono = false;
  }
  info.costTable = { 'r0/il0': table['r0/il0'], 'r3/il2': table['r3/il2'], 'r4/il12': table['r4/il12'] };
  check('cost grows with level', mono);
  check('cost grows with rarity', [0, 1, 2, 3].every((r) => table['r' + (r + 1) + '/il2'][0] > table['r' + r + '/il2'][0]));
  check('cost grows with ilvl', table['r2/il2'][3] > table['r2/il0'][3] && table['r2/il12'][3] > table['r2/il2'][3]);
  // beklenen toplam bedel (Markov: +6 ve üstü düşer)
  const expected = (rar, il) => {
    const it = I.makeItem('fang', rar, il);
    const E = [];
    let tot = 0;
    for (let p = 0; p < 9; p++) {
      it.plus = p;
      const c = I.plusCost(it), q = IC.plusChance[p];
      E[p] = p >= IC.plusDropFrom ? (c + (1 - q) * E[p - 1]) / q : c / q;
      tot += E[p];
    }
    return { to5: Math.round(E.slice(0, 5).reduce((a, b) => a + b, 0)), to9: Math.round(tot) };
  };
  info.expectedCost = { common0: expected(0, 0), rare1: expected(1, 1), epic2: expected(3, 2), legend2: expected(4, 2) };
}

/* ---------- 4. kuşanılı eşyayı basma → statlar ---------- */
{
  reset();
  const it = I.makeItem('fang', 2, 1);
  it.affixes = [{ k: 'dmg', roll: 1 }, { k: 'critDmg', roll: 1 }, { k: 'crit', roll: 1 }];
  g.inv.bag[0] = it; I.equipFrom(g, 'bag', 0);
  g.inv.essence = 1e6;
  const s0 = { dmg: P.stats.dmg, critDmg: P.stats.critDmg, m: g.build.mods.dmg };
  withRandom(0, () => { I.enhance(g, 'equip', 'fang'); I.enhance(g, 'equip', 'fang'); I.enhance(g, 'equip', 'fang'); });
  const s1 = { dmg: P.stats.dmg, critDmg: P.stats.critDmg, m: g.build.mods.dmg };
  const expDelta = I.value(it, it.affixes[0], 3) - I.value(it, it.affixes[0], 0);
  info.equipEnh = { s0, s1, expDelta };
  check('enhance equipped raises dmg', s1.dmg > s0.dmg && s1.critDmg > s0.critDmg, info.equipEnh);
  check('mods delta exact', Math.abs((s1.m - s0.m) - expDelta) < 1e-9, info.equipEnh);
  // düşme de statları düşürür
  it.plus = 7; EV.Build.recompute(g);
  const d7 = P.stats.dmg;
  withRandom(0.999, () => I.enhance(g, 'equip', 'fang'));
  check('drop on equipped lowers stats', it.plus === 6 && P.stats.dmg < d7, [it.plus, d7, P.stats.dmg]);
  // nadirlik yükseltme + seviyesini korur
  const up = I.upgradeCost(it);
  const e0 = g.inv.essence;
  check('rarity upgrade keeps plus', I.upgrade(g, 'equip', 'fang') && it.rarity === 3 && it.plus === 6 && e0 - g.inv.essence === up && it.name.startsWith('+6 '), [it.rarity, it.plus, it.name]);
  // efsanevi de basılabilir
  const leg = I.makeItem('claw', 4, 0);
  g.inv.bag[2] = leg;
  withRandom(0, () => I.enhance(g, 'bag', 2));
  check('legendary enhance', leg.plus === 1 && leg.name === '+1 ' + leg.unique.name, leg.name);
  // parçalama: basma harcamasının bir kısmı geri döner
  const plain = I.makeItem('claw', 4, 0); plain.plus = 0;
  check('salvage refund for plus', I.salvageValue(leg) > I.salvageValue(plain), [I.salvageValue(leg), I.salvageValue(plain)]);
}

/* ---------- 5. yeni yuvalar: Pençe / Kuyruk ---------- */
{
  reset();
  check('6 slots', I.SLOTS.length === 6 && !!I.SLOT.claw && !!I.SLOT.tail);
  check('freshInv has claw/tail', 'claw' in I.freshInv().equip && 'tail' in I.freshInv().equip);
  check('dashCost affix negative', I.AFFIX.dashCost < 0);
  const statKeys = Object.keys(EV.Build.stats(g, null));
  const badKeys = Object.keys(I.AFFIX).filter((k) => !statKeys.includes(k));
  check('all affix keys are real stats', !badKeys.length, badKeys);
  const cl = I.makeItem('claw', 3, 1);
  cl.affixes = [{ k: 'crit', roll: 1 }, { k: 'ccDmg', roll: 1 }, { k: 'vsBleed', roll: 1 }];
  const c0 = { crit: P.stats.crit, cc: P.stats.ccDmg, vb: P.stats.vsBleed };
  g.inv.bag[0] = cl;
  check('equip claw', I.equipFrom(g, 'bag', 0) && g.inv.equip.claw === cl);
  const c1 = { crit: P.stats.crit, cc: P.stats.ccDmg, vb: P.stats.vsBleed };
  check('claw stats up', c1.crit > c0.crit && c1.cc > c0.cc && c1.vb > c0.vb, [c0, c1]);
  const tl = I.makeItem('tail', 2, 2);
  tl.affixes = [{ k: 'dashCost', roll: 1 }, { k: 'speed', roll: 1 }, { k: 'summonPower', roll: 1 }];
  const t0 = { dc: P.stats.dashCost, sp: P.stats.speed, su: P.stats.summonPower };
  g.inv.bag[1] = tl; I.equipFrom(g, 'bag', 1);
  const t1 = { dc: P.stats.dashCost, sp: P.stats.speed, su: P.stats.summonPower };
  info.tail = { t0, t1, text: I.describe(tl) };
  check('tail makes dash cheaper', t1.dc < t0.dc && t1.sp > t0.sp && t1.su > t0.su, info.tail);
  check('dashCost text negative', I.describe(tl)[0].includes('-'), I.describe(tl));
  check('unequip claw', I.unequip(g, 'claw') && !g.inv.equip.claw && g.inv.bag.includes(cl) && Math.abs(P.stats.crit - c0.crit) < 1e-9);
  check('unequip tail', I.unequip(g, 'tail') && Math.abs(P.stats.dashCost - t0.dc) < 1e-9);
  // taban ad çeşitliliği
  const names = {};
  I.SLOTS.forEach((s) => [0, 1, 2].forEach((il) => { const set = new Set(); for (let k = 0; k < 80; k++) { const it = I.makeItem(s.id, 0, il); set.add(it.name.replace(/^\S+\s/, '')); } names[s.id + il] = set.size; }));
  info.baseNameVariety = names;
  check('>=3 base names per slot per stage', Object.values(names).every((n) => n >= 3), names);
  // craft yeni yuvalar
  g.inv.bag.fill(null); g.inv.essence = 5000;
  const cr = I.craft(g, 'tail');
  check('craft tail', cr && cr.slot === 'tail');
  check('craft bad slot null', I.craft(g, '__proto__') === null && I.craft(g, 'boots') === null);
}

/* ---------- 6. benzersizler: sayılar, kancalar, modlar ---------- */
{
  reset();
  const HOOKS = ['basicSt', 'hitChanceSt', 'critSt', 'onHurtSt', 'dashSt'];
  const statKeys = Object.keys(EV.Build.stats(g, null));
  const perSlot = {};
  const probs = [];
  I.UNIQUES.forEach((u) => {
    perSlot[u.slot] = (perSlot[u.slot] || 0) + 1;
    Object.keys(u.hooks || {}).forEach((h) => {
      if (!HOOKS.includes(h)) probs.push(u.name + ': hook ' + h);
      u.hooks[h].forEach((x) => { if (!EV.CFG.STATUS[x[0]]) probs.push(u.name + ': status ' + x[0]); });
    });
    Object.keys(u.mods || {}).forEach((k) => { if (!statKeys.includes(k)) probs.push(u.name + ': mod ' + k); });
    // kuşan → kanca ve modlar aktif
    const it = I.makeItem(u.slot, 4, 0);
    it.unique = u;
    g.inv.equip = ALL_SLOTS();
    g.inv.equip[u.slot] = it;
    EV.Build.recompute(g);
    Object.keys(u.hooks || {}).forEach((h) => u.hooks[h].forEach((x) => {
      if (!g.build.hooks[h].some((y) => y === x)) probs.push(u.name + ': hook not active ' + h);
    }));
    Object.keys(u.mods || {}).forEach((k) => {
      const aff = it.affixes.filter((a) => a.k === k).reduce((s, a) => s + I.value(it, a), 0);
      if (Math.abs((g.build.mods[k] || 0) - aff - u.mods[k]) > 1e-9) probs.push(u.name + ': mod not applied ' + k);
    });
  });
  info.uniques = { total: I.UNIQUES.length, perSlot };
  check('>=18 uniques', I.UNIQUES.length >= 18, I.UNIQUES.length);
  check('>=3 uniques per slot', I.SLOTS.every((s) => (perSlot[s.id] || 0) >= 3), perSlot);
  check('unique names distinct', new Set(I.UNIQUES.map((u) => u.name)).size === I.UNIQUES.length);
  check('uniques valid + active', !probs.length, probs);
  reset();
}

/* ---------- 7. yeni benzersizler gerçek savaş yolunda ---------- */
function dummy(dist) {
  EV.Enemies.clearAll(g);
  const p = P.group.position, yaw = P.group.rotation.y;
  const e = EV.Enemies.make(g, EV.MOBS.ENEMIES[0][1], { pos: { x: p.x + Math.sin(yaw) * dist, z: p.z + Math.cos(yaw) * dist }, hp: 1e9, dmg: 0 });
  e.behavior = 'passive';
  return e;
}
function wear(name) {
  const u = I.UNIQUES.find((x) => x.name === name);
  const it = I.makeItem(u.slot, 4, 0); it.unique = u;
  g.inv.equip = ALL_SLOTS(); g.inv.bag.fill(null); g.inv.bag[0] = it; I.equipFrom(g, 'bag', 0);
  return it;
}
function tick(n) { for (let i = 0; i < n; i++) { g.paused = false; g.time += 1 / 30; EV.tick(1 / 30); EV.Input.endFrame(); } }
{
  wear('Kanlı Orak');
  const e = dummy(3);
  let n = 0;
  for (let i = 0; i < 1000; i++) { e.st = null; EV.Combat.hitEnemy(g, e, 1, { source: 'player' }); if (EV.Status.has(e, 'bleed')) n++; }
  info.orakBleed = n / 1000;
  check('Kanlı Orak bleed ~35%', Math.abs(n / 1000 - 0.35) < 0.06, n / 1000);
  wear('Gök Gürültüsü Pençesi');
  const e2 = dummy(3);
  e2.st = null; EV.Combat.hitEnemy(g, e2, 1, { source: 'player', forceCrit: true });
  check('Gök Gürültüsü crit → stun', EV.Status.has(e2, 'stun'), e2.st);
  wear('Alev Kuyruğu');
  const e3 = dummy(2.5);
  e3.speed = 0; tick(3);                 // ızgara yeniden kurulsun
  P.energy = P.stats.maxEnergy; P.dashCd = 0;
  EV.Input._press('Space'); tick(1); EV.Input._release && EV.Input._release('Space');
  check('Alev Kuyruğu dash → burn', EV.Status.has(e3, 'burn'), e3.st);
  tick(20);
  wear('Diken Postu');
  const e4 = dummy(2);
  P.iframe = 0; P.hp = P.stats.maxHp;
  EV.Combat.hitPlayer(g, 5, { attacker: e4, melee: true });
  check('Diken Postu onHurt bleed', EV.Status.has(e4, 'bleed'), e4.st);
  EV.Enemies.clearAll(g);
  reset();
}

/* ---------- 8. takım bonusları ---------- */
{
  reset();
  const S = I.SETS[0];
  const mk = (slot) => { const it = I.makeItem(slot, 2, 0); it.set = S.id; return it; };
  const base = { ...g.build.mods };
  g.inv.equip.fang = mk('fang'); EV.Build.recompute(g);
  const one = I.activeSets(g).length;
  g.inv.equip.hide = mk('hide'); EV.Build.recompute(g);
  const two = I.activeSets(g);
  const k2 = Object.keys(S.b2.mods)[0];
  const aff = ['fang', 'hide'].reduce((s, sl) => s + g.inv.equip[sl].affixes.filter((a) => a.k === k2).reduce((x, a) => x + I.value(g.inv.equip[sl], a), 0), 0);
  check('1 piece: no bonus', one === 0);
  check('2 pieces: b2 mods', two.length === 1 && Math.abs((g.build.mods[k2] || 0) - (base[k2] || 0) - aff - S.b2.mods[k2]) < 1e-9, { k2, got: g.build.mods[k2], aff });
  const h4 = Object.keys(S.b4.hooks)[0];
  check('2 pieces: no b4 hook', !g.build.hooks[h4].includes(S.b4.hooks[h4][0]));
  g.inv.equip.organ = mk('organ'); g.inv.equip.claw = mk('claw'); EV.Build.recompute(g);
  check('4 pieces: b4 hook active', g.build.hooks[h4].includes(S.b4.hooks[h4][0]) && I.setCount(g, S.id) === 4);
  // set seçimi yalnız Değerli+
  let lowSet = 0, hiSet = 0;
  for (let k = 0; k < 400; k++) { if (I.makeItem('fang', 1, 0).set) lowSet++; if (I.makeItem('fang', 3, 0).set) hiSet++; }
  info.setRate = hiSet / 400;
  check('no set below Değerli', lowSet === 0);
  check('set rate ~30% on Destansı', Math.abs(hiSet / 400 - IC.setChance) < 0.08, hiSet / 400);
  reset();
}

/* ---------- 9. kayıt gidiş-dönüş + eski biçim + bozuk veriler ---------- */
const sig = (it) => (it ? JSON.stringify([it.slot, it.rarity, it.ilvl, it.plus, it.bv, it.set, it.affixes.map((a) => [a.k, +a.roll.toFixed(12)]), it.unique && it.unique.name, it.name]) : 'null');
{
  reset();
  const inv = g.inv;
  // + seviyesini gerçek basma yoluyla ver (ad da güncellenir)
  const pump = (it, p) => { inv.bag[23] = it; inv.essence = 1e9; withRandom(0, () => { for (let k = 0; k < p; k++) I.enhance(g, 'bag', 23); }); inv.bag[23] = null; return it; };
  for (let i = 0; i < 18; i++) { const it = pump(I.makeItem(I.SLOTS[i % 6].id, i % 5, i % 13), i % 10); if (i % 3 === 0 && it.rarity >= 2) it.set = I.SETS[i % 4].id; inv.bag[i] = it; }
  I.SLOTS.forEach((s, k) => { inv.equip[s.id] = pump(I.makeItem(s.id, 4, 3), 9 - k); });
  EV.Build.recompute(g);
  inv.essence = 4321;
  const before = { bag: inv.bag.map(sig), equip: I.SLOTS.map((s) => sig(inv.equip[s.id])) };
  const statsBefore = { ...P.stats };
  g.save();
  g.applySave(g.loadRaw());
  for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
  const after = { bag: g.inv.bag.map(sig), equip: I.SLOTS.map((s) => sig(g.inv.equip[s.id])) };
  const diffs = [];
  before.bag.forEach((s, i) => { if (s !== after.bag[i]) diffs.push(['bag' + i, s, after.bag[i]]); });
  before.equip.forEach((s, i) => { if (s !== after.equip[i]) diffs.push(['eq' + i, s, after.equip[i]]); });
  check('roundtrip identical (plus/bv/set/name)', !diffs.length, diffs.slice(0, 4));
  check('roundtrip essence', g.inv.essence === 4321);
  const sd = Object.keys(statsBefore).filter((k) => Math.abs(statsBefore[k] - P.stats[k]) > 1e-9);
  check('roundtrip stats', !sd.length, sd);
  check('equip +9 name', g.inv.equip.fang.name.startsWith('+9 '), g.inv.equip.fang.name);

  // eski biçim: plus / bv / set / claw / tail yok
  const old = {
    bag: [{ slot: 'fang', rarity: 2, ilvl: 1, affixes: [{ k: 'dmg', roll: 0.9 }, { k: 'crit', roll: 0.8 }, { k: 'atkSpd', roll: 0.75 }], unique: null },
      { slot: 'relic', rarity: 4, ilvl: 0, affixes: [], unique: 'Yıldırım Çekirdeği' }, null],
    chest: [{ slot: 'organ', rarity: 0, ilvl: 2, affixes: [{ k: 'cdr', roll: 1 }], unique: null }],
    equip: { fang: { slot: 'fang', rarity: 1, ilvl: 0, affixes: [{ k: 'dmg', roll: 1 }, { k: 'crit', roll: 1 }], unique: null }, hide: null, organ: null, relic: null },
    essence: 777,
  };
  let oldInv = null, oldErr = null;
  try { oldInv = I.deserialize(JSON.parse(JSON.stringify(old))); } catch (err) { oldErr = String(err); }
  check('old format loads', oldInv && !oldErr, oldErr);
  if (oldInv) {
    info.oldNames = [oldInv.bag[0].name, oldInv.bag[1].name, oldInv.chest[0].name, oldInv.equip.fang.name];
    check('old: plus 0, bv 0, no set', [oldInv.bag[0], oldInv.bag[1], oldInv.chest[0], oldInv.equip.fang].every((x) => x.plus === 0 && x.bv === 0 && x.set === null));
    check('old: legacy names kept', oldInv.bag[0].name === 'Keskin Kemik Diş' && oldInv.bag[1].name === 'Yıldırım Çekirdeği' && oldInv.chest[0].name === 'Hızlı Avcı Ciğeri' && oldInv.equip.fang.name === 'Keskin Protoplazma Dikeni', info.oldNames);
    check('old: claw/tail empty', oldInv.equip.claw === null && oldInv.equip.tail === null);
    check('old: essence', oldInv.essence === 777);
  }
  // eski biçimli tam kayıt applySave yolundan
  const KEY = 'evolve_save_v4';
  const full = JSON.parse(localStorage.getItem(KEY));
  full.inv = old;
  localStorage.setItem(KEY, JSON.stringify(full));
  let applyErr = null;
  try { g.applySave(g.loadRaw()); for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++); } catch (err) { applyErr = String(err && err.stack || err); }
  check('old full save applies', !applyErr && g.inv.equip.fang && g.inv.equip.fang.plus === 0 && g.inv.equip.claw === null, applyErr);
  let uiErr = null;
  try { EV.Inv.open(g); document.querySelectorAll('#invPanel .icell:not(.empty)').forEach((c) => c.click()); EV.Inv.close(); } catch (err) { uiErr = String(err); }
  check('old save UI renders', !uiErr, uiErr);

  // bozuk yeni alanlar
  const item = (o) => Object.assign({ slot: 'claw', rarity: 3, ilvl: 1, affixes: [{ k: 'crit', roll: 0.9 }], unique: null }, o);
  const badPlus = ['abc', 99, -3, '1e999', null, 4.6, {}, [7], true, NaN, 1e308];
  const badBv = ['x', 99, -1, null, 2.5];
  const badSet = ['__proto__', 'constructor', 'toString', 'nope', 5, null];
  let bad = null, badErr = null;
  try {
    bad = I.deserialize({
      bag: badPlus.map((p) => item({ plus: p })).concat(badBv.map((b) => item({ bv: b }))),
      chest: badSet.map((s) => item({ set: s })).concat([item({ rarity: 0, set: 'kurt' }), item({ rarity: 3, set: 'kurt' })]),
      equip: { claw: item({ plus: 12 }), tail: item({ slot: 'claw', plus: 3 }), boots: item({}) },
      essence: 5,
    });
  } catch (err) { badErr = String(err && err.stack || err); }
  check('bad data no crash', bad && !badErr, badErr);
  if (bad) {
    const pl = bad.bag.slice(0, badPlus.length).map((x) => x && x.plus);
    info.badPlus = pl;
    check('plus clamped 0..9 integers', pl.every((p) => Number.isInteger(p) && p >= 0 && p <= 9), pl);
    const bv = bad.bag.slice(badPlus.length, badPlus.length + badBv.length).map((x) => x && x.bv);
    check('bv clamped', bv.every((b) => Number.isInteger(b) && b >= 0 && b <= 3), bv);
    const st = bad.chest.slice(0, badSet.length + 2).map((x) => x && x.set);
    info.badSet = st;
    check('set validated', st.slice(0, badSet.length).every((s) => s === null) && st[badSet.length] === null && st[badSet.length + 1] === 'kurt', st);
    check('equip claw plus clamped', bad.equip.claw && bad.equip.claw.plus === 9);
    check('wrong-slot equip goes to bag', bad.equip.tail === null && bad.bag.filter(Boolean).some((x) => x.plus === 3));
    const names = bad.bag.concat(bad.chest).filter(Boolean).map((x) => x.name);
    check('names clean', names.every((n) => typeof n === 'string' && !/undefined|NaN|null/.test(n)), names.slice(0, 5));
  }
}

/* ---------- 10. Apex ve özel av ödülleri ---------- */
{
  reset();
  EV.Items.clear(g, true);
  const e = EV.Enemies.make(g, EV.MOBS.ENEMIES[0][0], { pos: { x: P.group.position.x + 3, z: P.group.position.z }, hp: 1 });
  e.behavior = 'passive';
  const run = (flags, n, gen) => {
    g.generation = gen || 0;
    const out = { n, ess: [], rar: [], perKill: [], legFirst: 0, nulls: 0 };
    for (let i = 0; i < n; i++) {
      Object.assign(e, { isApex: false, isAlpha: false, isMini: false, isNemesis: false, isTreasure: false, isChampion: false, noLoot: false }, flags);
      e.alive = true;
      const e0 = g.inv.essence;
      const r = I.onKill(g, e);
      if (!r) { out.nulls++; out.ess.push(g.inv.essence - e0); continue; }
      out.ess.push(g.inv.essence - e0);
      out.perKill.push(r.items.length);
      r.items.forEach((it) => out.rar.push(it.rarity));
      if (r.items[0] && r.items[0].rarity === 4) out.legFirst++;
      out.first = out.first || r.items.map((it) => it.rarity);
      if (i % 50 === 0) EV.Items.clear(g, true);
    }
    EV.Items.clear(g, true);
    g.generation = 0;
    return out;
  };
  const n0 = toasts.length;
  const apex = run({ isApex: true }, 400);
  const apexToasts = toasts.slice(n0).filter((t) => /APEX/.test(t));
  const apexG2 = run({ isApex: true }, 20, 2);
  const nem = run({ isNemesis: true }, 300);
  const tre = run({ isTreasure: true }, 200);
  const mini = run({ isMini: true }, 200);
  const alpha = run({ isAlpha: true }, 100);
  const champ = run({ isChampion: true }, 2000);
  const normal = run({}, 2000);
  const noLoot = run({ noLoot: true, isChampion: true }, 50);
  const firstRar = (o, k) => o.rar.filter((_, i) => i % k === 0);
  info.rewards = {
    apex: { ess: apex.ess[0], essG2: apexG2.ess[0], drops: apex.perKill[0], legFirst: apex.legFirst / apex.n, minFirst: Math.min(...firstRar(apex, 2)), minSecond: Math.min(...apex.rar.filter((_, i) => i % 2 === 1)), toasts: apexToasts.length, toastSample: apexToasts[0] },
    nemesis: { ess: nem.ess[0], leg: nem.legFirst / nem.n, min: Math.min(...nem.rar) },
    treasure: { ess: tre.ess[0], drops: tre.perKill[0], min: Math.min(...tre.rar) },
    mini: { ess: mini.ess[0], min: Math.min(...mini.rar) },
    alpha: { ess: alpha.ess[0], min: Math.min(...alpha.rar) },
    champion: { essAvg: champ.ess.reduce((a, b) => a + b, 0) / champ.n, dropsPer100: 100 * champ.rar.length / champ.n },
    normal: { essAvg: normal.ess.reduce((a, b) => a + b, 0) / normal.n, dropsPer100: 100 * normal.rar.length / normal.n },
    noLoot: { ess: noLoot.ess.reduce((a, b) => a + b, 0), nulls: noLoot.nulls },
  };
  const RW = info.rewards;
  check('apex essence 150', RW.apex.ess === 150, RW.apex);
  check('apex essence gen2 = 240', RW.apex.essG2 === 240, RW.apex);
  check('apex 2 drops', apex.perKill.every((k) => k === 2));
  check('apex first ≥ Destansı', RW.apex.minFirst >= 3, RW.apex);
  check('apex second ≥ Değerli', RW.apex.minSecond >= 2, RW.apex);
  check('apex legendary ~30%', RW.apex.legFirst > 0.24 && RW.apex.legFirst < 0.42, RW.apex.legFirst);
  check('apex toast announced', RW.apex.toasts >= 1 && /Gen Özü/.test(RW.apex.toastSample || ''), RW.apex.toastSample);
  check('nemesis 90 ess, ≥3, ~35% leg', RW.nemesis.ess === 90 && RW.nemesis.min >= 3 && RW.nemesis.leg > 0.28 && RW.nemesis.leg < 0.47, RW.nemesis);
  check('treasure 80 ess, 2 drops ≥ Nadir', RW.treasure.ess === 80 && tre.perKill.every((k) => k === 2) && RW.treasure.min >= 1, RW.treasure);
  check('mini 25 ess, ≥ Değerli', RW.mini.ess === 25 && RW.mini.min >= 2 && mini.perKill.every((k) => k === 1), RW.mini);
  check('alpha 60 ess, ≥ Destansı', RW.alpha.ess === 60 && RW.alpha.min >= 3, RW.alpha);
  check('champion essence ×4', Math.abs(RW.champion.essAvg - 4 * RW.normal.essAvg) < 1e-9, [RW.champion.essAvg, RW.normal.essAvg]);
  check('champion drops ~×6', RW.champion.dropsPer100 > 3 * RW.normal.dropsPer100, [RW.champion.dropsPer100, RW.normal.dropsPer100]);
  check('noLoot gives nothing', RW.noLoot.ess === 0 && RW.noLoot.nulls === 50, RW.noLoot);
  e.alive = false; g.cleanupDead();

  // gerçek öldürme yolu: spawnApex + killEnemy
  reset();
  EV.Items.clear(g, true);
  const a = EV.Enemies.spawnApex(g);
  a.group.position.set(P.group.position.x + 3, a.group.position.y, P.group.position.z);
  const e0 = g.inv.essence, gc0 = I.groundCount;
  g.killEnemy(a);
  info.realApex = { ess: g.inv.essence - e0, ground: I.groundCount - gc0 };
  check('real apex kill reward', info.realApex.ess >= 150 && info.realApex.ground >= 2, info.realApex);
  EV.Items.clear(g, true);
}

/* ---------- 11. arayüz: 6 yuva, basma düğmesi, iki dokunuş onayı ---------- */
{
  reset();
  const btn = (a) => document.querySelector('#invDetail button[data-a="' + a + '"]');
  const it = I.makeItem('claw', 3, 1);
  it.plus = 6; it.set = 'kurt';
  g.inv.bag[2] = it;
  const safe = I.makeItem('tail', 1, 0);
  g.inv.bag[3] = safe;
  const hi = I.makeItem('hide', 2, 0); hi.plus = 8; g.inv.bag[4] = hi;
  g.inv.essence = 1e6;
  EV.Inv.open(g);
  check('UI 6 equip cells', document.querySelectorAll('#invEquip .icell').length === 6);
  check('UI craft 6 buttons', document.querySelectorAll('#invCraft .craftbtn').length === 6);
  check('UI +8 cell glow', document.querySelector('#invBag .icell[data-i="4"]').classList.contains('hi'));
  check('UI +N badge', /\+6/.test(document.querySelector('#invBag .icell[data-i="2"] .pl').textContent));
  // riskli: ilk tıklama onay ister
  document.querySelector('#invBag .icell[data-i="2"]').click();
  const b1 = btn('enhance');
  info.uiEnhanceText = b1 && b1.textContent;
  info.uiRisk = document.querySelector('#invDetail .prisk') && document.querySelector('#invDetail .prisk').textContent;
  check('UI enhance label', b1 && /\+6 → \+7/.test(b1.textContent) && /%60/.test(b1.textContent) && b1.textContent.includes(U_fmt(I.plusCost(it))), info.uiEnhanceText);
  check('UI risk line', /düşer/.test(info.uiRisk || ''), info.uiRisk);
  check('UI set block', !!document.querySelector('#invDetail .iset'));
  const e0 = g.inv.essence;
  b1.click();
  check('UI risky first click arms only', it.plus === 6 && g.inv.essence === e0 && /Onayla/.test(btn('enhance').textContent) && !!btn('disarm'));
  btn('disarm').click();
  check('UI disarm', it.plus === 6 && !/Onayla/.test(btn('enhance').textContent));
  btn('enhance').click();
  const cost = I.plusCost(it);
  withRandom(0.999, () => btn('enhance').click());
  info.uiResult = document.querySelector('#invDetail .pres') && document.querySelector('#invDetail .pres').textContent;
  check('UI confirmed fail drops', it.plus === 5 && e0 - g.inv.essence === cost && /düştü/.test(info.uiResult || ''), [it.plus, e0 - g.inv.essence, cost, info.uiResult]);
  // güvenli: tek tıklama
  document.querySelector('#invBag .icell[data-i="3"]').click();
  const e1 = g.inv.essence;
  withRandom(0, () => btn('enhance').click());
  check('UI safe single click success', safe.plus === 1 && g.inv.essence < e1 && /BAŞARILI/.test(document.querySelector('#invDetail .pres').textContent));
  check('UI rarity upgrade still separate', !!btn('upgrade') && /Nadirlik/.test(btn('upgrade').textContent));
  // +9: düğme yok, bilgi var
  safe.plus = 9; EV.Inv.render();
  check('UI +9 max', !btn('enhance') && /en üst/.test(document.getElementById('invDetail').textContent));
  // yoksul: düğme devre dışı
  safe.plus = 2; g.inv.essence = 1; EV.Inv.render();
  check('UI poor disabled', btn('enhance').disabled);
  // kuşanılı pençeyi arayüzden bas
  g.inv.essence = 1e6;
  document.querySelector('#invBag .icell[data-i="3"]').click();
  btn('equip').click();
  const d0 = P.stats.speed + P.stats.dashCost;
  withRandom(0, () => btn('enhance').click());
  check('UI enhance equipped', safe.plus === 3 && g.inv.equip.tail === safe);
  info.uiDetail = document.getElementById('invDetail').textContent.slice(0, 200);
  EV.Inv.close();
  info.d0 = d0;
}
function U_fmt(n) { return EV.U.fmt(n); }
EV.UI.toast = origToast;
Math.random = realRandom;
return { fails, info };
