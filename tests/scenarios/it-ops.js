// it-ops: basma dağılımı, kuşan/çıkar/taşı/parçala/yükselt (API), benzersiz kancalar, dolu çanta
T.start('normal');
const g = EV.Game;
const I = EV.Items;
const IC = EV.CFG.ITEMS;
const R = EV.CFG.RARITY;
const P = g.player;
const fails = [];
const info = {};
const check = (name, cond, extra) => { if (!cond) fails.push({ name, extra }); };
const bagClear = () => { g.inv.bag.fill(null); };

/* ---------- 1. basma dağılımı ---------- */
{
  bagClear();
  g.inv.essence = 1e9;
  const rar = [0, 0, 0, 0, 0], slotU = {}, affN = {};
  let nulls = 0;
  for (let i = 0; i < 2000; i++) {
    const slot = I.SLOTS[i % 4].id;
    const e0 = g.inv.essence;
    const it = I.craft(g, slot);
    if (!it) { nulls++; continue; }
    if (e0 - g.inv.essence !== IC.craftCost) fails.push({ name: 'craft cost', extra: e0 - g.inv.essence });
    rar[it.rarity]++;
    affN[it.rarity + ':' + it.affixes.length] = (affN[it.rarity + ':' + it.affixes.length] || 0) + 1;
    if (it.unique) slotU[it.slot + ':' + it.unique.name] = (slotU[it.slot + ':' + it.unique.name] || 0) + 1;
    if (it.rarity === 4 && !it.unique) fails.push({ name: 'legendary without unique', extra: it.slot });
    if (it.slot !== slot) fails.push({ name: 'craft slot mismatch' });
    bagClear();
  }
  info.craft = { n: 2000, nulls, rar, pct: rar.map((v) => (v / 20).toFixed(1)), expected: R.map((r) => r.craft), affN, slotU };
}

/* ---------- 2. craft refused: poor / full bag ---------- */
{
  bagClear();
  g.inv.essence = IC.craftCost - 1;
  check('craft poor returns null', I.craft(g, 'fang') === null);
  check('craft poor no charge', g.inv.essence === IC.craftCost - 1);
  g.inv.essence = 10000;
  for (let i = 0; i < IC.bagSize; i++) g.inv.bag[i] = I.makeItem('fang', 0, 0);
  const e0 = g.inv.essence;
  check('craft full bag null', I.craft(g, 'fang') === null);
  check('craft full bag no charge', g.inv.essence === e0);
  bagClear();
}

/* ---------- 3. equip → stats ---------- */
{
  bagClear();
  g.inv.equip = { fang: null, hide: null, organ: null, relic: null };
  EV.Build.recompute(g);
  const s0 = { ...P.stats };
  const it = I.makeItem('fang', 3, 2);
  it.affixes = [{ k: 'dmg', roll: 1 }, { k: 'crit', roll: 1 }, { k: 'atkSpd', roll: 1 }];
  g.inv.bag[0] = it;
  check('equipFrom ok', I.equipFrom(g, 'bag', 0));
  const s1 = { ...P.stats };
  const vDmg = I.value(it, it.affixes[0]);
  info.equipStats = { dmg0: s0.dmg, dmg1: s1.dmg, vDmg, crit0: s0.crit, crit1: s1.crit, atk0: s0.atkSpd, atk1: s1.atkSpd };
  check('equip dmg ratio', Math.abs(s1.dmg / s0.dmg - (1 + (g.build.mods.dmg || 0)) / (1 + (g.build.mods.dmg || 0) - vDmg)) < 1e-6, info.equipStats);
  check('equip dmg up', s1.dmg > s0.dmg);
  check('equip crit up', s1.crit > s0.crit);
  check('bag slot emptied', g.inv.bag[0] === null);
  // swap
  const it2 = I.makeItem('fang', 0, 0);
  g.inv.bag[5] = it2;
  I.equipFrom(g, 'bag', 5);
  check('swap: old goes to same bag idx', g.inv.bag[5] === it, g.inv.bag[5] && g.inv.bag[5].name);
  check('swap: new equipped', g.inv.equip.fang === it2);
  check('swap stats drop', P.stats.dmg < s1.dmg);
  // unequip
  check('unequip ok', I.unequip(g, 'fang'));
  check('unequip stat back', Math.abs(P.stats.dmg - s0.dmg) < 1e-9, [P.stats.dmg, s0.dmg]);
  // unequip with full bag
  I.equipFrom(g, 'bag', 5);
  for (let i = 0; i < IC.bagSize; i++) if (!g.inv.bag[i]) g.inv.bag[i] = I.makeItem('hide', 0, 0);
  check('unequip full bag refused', I.unequip(g, 'fang') === false && g.inv.equip.fang !== null);
  bagClear();
  // equip from chest
  g.inv.chest[3] = I.makeItem('relic', 1, 0);
  const prevRelic = g.inv.equip.relic;
  I.equipFrom(g, 'chest', 3);
  check('equip from chest', g.inv.equip.relic && g.inv.chest[3] === prevRelic);
  g.inv.equip.relic = null; g.inv.chest.fill(null);
  I.unequip(g, 'fang'); bagClear();
  EV.Build.recompute(g);
}

/* ---------- 4. move / chest full ---------- */
{
  bagClear(); g.inv.chest.fill(null);
  g.inv.bag[2] = I.makeItem('organ', 1, 0);
  check('move bag->chest', I.move(g, 'bag', 2, 'chest') && g.inv.chest[0] && !g.inv.bag[2]);
  check('move chest->bag', I.move(g, 'chest', 0, 'bag') && g.inv.bag[0]);
  for (let i = 0; i < IC.chestSize; i++) g.inv.chest[i] = I.makeItem('organ', 0, 0);
  check('move to full chest refused', I.move(g, 'bag', 0, 'chest') === false && g.inv.bag[0]);
  check('move empty slot refused', I.move(g, 'bag', 7, 'chest') === false);
  g.inv.chest.fill(null); bagClear();
}

/* ---------- 5. salvage values ---------- */
{
  const sv = {};
  for (let r = 0; r < 5; r++) for (const il of [0, 2, 12]) {
    const it = I.makeItem('fang', r, il);
    g.inv.bag[0] = it;
    const e0 = g.inv.essence;
    const v = I.salvage(g, 'bag', 0);
    const exp = Math.round(IC.salvage[r] * (1 + il * 0.25));
    sv[r + '/' + il] = v;
    check('salvage value r' + r + ' il' + il, v === exp && g.inv.essence - e0 === exp && g.inv.bag[0] === null, [v, exp]);
  }
  info.salvage = sv;
  // salvage equipped → stats
  const it = I.makeItem('hide', 2, 0); it.affixes = [{ k: 'maxHp', roll: 1 }];
  g.inv.bag[0] = it; I.equipFrom(g, 'bag', 0);
  const hp1 = P.stats.maxHp;
  I.salvage(g, 'equip', 'hide');
  check('salvage equipped recompute', P.stats.maxHp < hp1 && !g.inv.equip.hide);
  check('salvage empty returns 0', I.salvage(g, 'bag', 3) === 0);
}

/* ---------- 6. upgrade ---------- */
{
  bagClear();
  const up = {};
  for (let r = 0; r < 4; r++) for (const il of [0, 2]) up[r + '/' + il] = I.upgradeCost(I.makeItem('fang', r, il));
  info.upgradeCosts = up;
  const it = I.makeItem('relic', 0, 1);
  g.inv.bag[0] = it;
  g.inv.essence = 1e6;
  const chain = [];
  while (it.rarity < 4) {
    const c = I.upgradeCost(it);
    const e0 = g.inv.essence;
    const ok = I.upgrade(g, 'bag', 0);
    chain.push({ to: it.rarity, cost: c, paid: e0 - g.inv.essence, aff: it.affixes.length, uniq: it.unique && it.unique.name, name: it.name, ok });
    if (!ok) break;
  }
  info.upgradeChain = chain;
  check('upgrade to 4 adds unique', it.rarity === 4 && it.unique);
  check('upgrade to 4 affixes = 4', it.affixes.length === 4);
  check('no dup affix keys', new Set(it.affixes.map((a) => a.k)).size === it.affixes.length);
  check('upgrade at 4 refused', I.upgrade(g, 'bag', 0) === false);
  check('upgradeCost 4 = Infinity', I.upgradeCost(it) === Infinity);
  const low = I.makeItem('fang', 0, 0); g.inv.bag[1] = low; g.inv.essence = 10;
  check('upgrade poor refused', I.upgrade(g, 'bag', 1) === false && low.rarity === 0 && g.inv.essence === 10);
  // upgrade equipped → stats change
  g.inv.essence = 1e6;
  const eqi = I.makeItem('fang', 1, 0); eqi.affixes = [{ k: 'dmg', roll: 1 }, { k: 'critDmg', roll: 1 }];
  g.inv.bag[2] = eqi; I.equipFrom(g, 'bag', 2);
  const d0 = P.stats.dmg;
  I.upgrade(g, 'equip', 'fang');
  check('upgrade equipped raises stats', P.stats.dmg > d0, [d0, P.stats.dmg]);
  I.unequip(g, 'fang'); bagClear();
}

/* ---------- 7. uniques pool ---------- */
{
  const seen = {};
  I.SLOTS.forEach((s) => { for (let i = 0; i < 200; i++) { const it = I.makeItem(s.id, 4, 0); const n = it.unique ? it.unique.name : 'NONE'; seen[s.id + ':' + n] = (seen[s.id + ':' + n] || 0) + 1; } });
  info.uniquesBySlot = seen;
  // describe for every affix and unique produces text without NaN/undefined
  const bad = [];
  I.SLOTS.forEach((s) => { for (let i = 0; i < 100; i++) { const it = I.makeItem(s.id, 4, 12); I.describe(it).forEach((l) => { if (/NaN|undefined/.test(l)) bad.push(l); }); } });
  check('describe clean', !bad.length, bad.slice(0, 5));
}
const report = { fails, info };
window.__it = report;
return report;
