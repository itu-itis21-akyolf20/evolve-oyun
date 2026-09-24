// it-hooks: benzersiz efsanevi etkileri gerçek savaş yolundan; dolu çanta; sandık açma; Alfa düşüşü
T.start('normal');
const g = EV.Game;
const I = EV.Items;
const P = g.player;
const In = EV.Input;
const fails = [];
const info = {};
const check = (name, cond, extra) => { if (!cond) fails.push({ name, extra }); };
const toasts = [];
const origToast = EV.UI.toast;
EV.UI.toast = function (t) { toasts.push(String(t).replace(/<[^>]+>/g, '')); return origToast.apply(this, arguments); };

function uniqueItem(slot, name) {
  for (let i = 0; i < 500; i++) { const it = I.makeItem(slot, 4, 0); if (it.unique && it.unique.name === name) return it; }
  return null;
}
function equipOnly(it) {
  g.inv.equip = { fang: null, hide: null, organ: null, relic: null };
  g.inv.bag.fill(null);
  if (it) { g.inv.bag[0] = it; I.equipFrom(g, 'bag', 0); } else EV.Build.recompute(g);
}
function dummy(dist) {
  EV.Enemies.clearAll(g);
  const p = P.group.position;
  const yaw = P.group.rotation.y;
  const e = EV.Enemies.make(g, EV.MOBS.ENEMIES[0][1], { pos: { x: p.x + Math.sin(yaw) * dist, z: p.z + Math.cos(yaw) * dist }, hp: 1e9, dmg: 0 });
  e.behavior = 'passive';
  return e;
}
function tick(n) { for (let i = 0; i < n; i++) { g.paused = false; g.time += 1 / 30; EV.tick(1 / 30); In.endFrame(); } }
g.apexTimer = 1e9;

/* --- Yutucunun Dişi: temel saldırı zehir --- */
{
  equipOnly(uniqueItem('fang', 'Yutucunun Dişi'));
  info.hooksFang = JSON.stringify(g.build.hooks.basicSt);
  const e = dummy(2);
  P.lockTarget = e;
  let poisoned = false, hits = 0;
  for (let k = 0; k < 90 && !poisoned; k++) {
    In.mouse.left = true; tick(1);
    if (e.hp < 1e9) hits++;
    poisoned = EV.Status.has(e, 'poison');
  }
  In.mouse.left = false;
  info.poison = { hits, poisoned, stacks: EV.Status.stacks(e, 'poison') };
  check('Yutucunun Dişi basic → poison', poisoned, info.poison);
  // skill (non-basic) direct hit should NOT poison
  e.st = null;
  EV.Combat.hitEnemy(g, e, 1, { source: 'player' });
  check('Yutucunun Dişi non-basic no poison', !EV.Status.has(e, 'poison'));
  equipOnly(null);
  e.st = null;
  EV.Combat.hitEnemy(g, e, 1, { source: 'player', basic: true });
  check('unequipped: no poison', !EV.Status.has(e, 'poison'));
}

/* --- Alfa Pençesi: %30 kanama --- */
{
  equipOnly(uniqueItem('fang', 'Alfa Pençesi'));
  const e = dummy(3);
  let n = 0;
  for (let i = 0; i < 1000; i++) { e.st = null; EV.Combat.hitEnemy(g, e, 1, { source: 'player' }); if (EV.Status.has(e, 'bleed')) n++; }
  info.bleedRate = n / 1000;
  check('Alfa Pençesi bleed ~30%', Math.abs(n / 1000 - 0.3) < 0.06, n);
}

/* --- Yıldırım Çekirdeği: kritik şok --- */
{
  equipOnly(uniqueItem('relic', 'Yıldırım Çekirdeği'));
  const e = dummy(3);
  e.st = null; EV.Combat.hitEnemy(g, e, 1, { source: 'player', forceCrit: true });
  const crit = EV.Status.stacks(e, 'shock');
  let nonCrit = 0;
  P.stats.crit = 0;
  for (let i = 0; i < 50; i++) { e.st = null; EV.Combat.hitEnemy(g, e, 1, { source: 'player' }); if (EV.Status.has(e, 'shock')) nonCrit++; }
  EV.Build.recompute(g);
  info.shock = { critStacks: crit, nonCritShocks: nonCrit };
  check('Yıldırım crit → shock', crit > 0, info.shock);
  check('Yıldırım non-crit no shock', nonCrit === 0, info.shock);
}

/* --- Taş Kalp: vurana yavaşlama + zırh --- */
{
  equipOnly(null);
  const a0 = P.stats.armor;
  equipOnly(uniqueItem('hide', 'Taş Kalp'));
  const it = g.inv.equip.hide;
  const affArmor = it.affixes.filter((a) => a.k === 'armor').reduce((s, a) => s + I.value(it, a), 0);
  info.stoneArmor = { a0, a1: P.stats.armor, affArmor };
  check('Taş Kalp armor +0.08', Math.abs(P.stats.armor - a0 - 0.08 - affArmor) < 1e-9, info.stoneArmor);
  const e = dummy(2);
  P.iframe = 0; P.hp = P.stats.maxHp;
  EV.Combat.hitPlayer(g, 5, { attacker: e, melee: true });
  check('Taş Kalp onHurt slow', EV.Status.has(e, 'slow'), e.st);
  const e2 = dummy(2);
  P.iframe = 0;
  EV.Combat.hitPlayer(g, 5, { attacker: e2, melee: false });
  info.stoneRanged = EV.Status.has(e2, 'slow');
}

/* --- Kan Pınarı: can çalma --- */
{
  equipOnly(null); const l0 = P.stats.lifesteal;
  equipOnly(uniqueItem('organ', 'Kan Pınarı'));
  info.blood = { l0, l1: P.stats.lifesteal };
  check('Kan Pınarı lifesteal +0.06', P.stats.lifesteal - l0 >= 0.06 - 1e-9, info.blood);
}

/* --- Rüzgar Kesesi: atılım yavaşlatır, %30 ucuz --- */
{
  equipOnly(null); const dc0 = P.stats.dashCost;
  equipOnly(uniqueItem('organ', 'Rüzgar Kesesi'));
  info.wind = { dc0, dc1: P.stats.dashCost };
  check('Rüzgar dashCost 0.7', Math.abs(P.stats.dashCost - 0.7 * dc0) < 1e-9, info.wind);
  const e = dummy(2.5);
  P.energy = P.stats.maxEnergy; P.dashCd = 0;
  const en0 = P.energy;
  In._press('Space'); tick(1); In._release && In._release('Space');
  info.wind.energyUsed = en0 - P.energy;
  info.wind.slowed = EV.Status.has(e, 'slow');
  check('Rüzgar dash → slow near', EV.Status.has(e, 'slow'), info.wind);
  tick(30);
}

/* --- Dolu çanta: yerden alma reddi --- */
{
  equipOnly(null);
  EV.Enemies.clearAll(g);
  for (let i = 0; i < 24; i++) g.inv.bag[i] = I.makeItem('fang', 0, 0);
  const n0 = toasts.length;
  const it = I.makeItem('hide', 2, 0);
  I.dropAt(g, P.group.position, it);
  const gc0 = I.groundCount;
  tick(10);
  const msgs = toasts.slice(n0).filter((t) => /Çanta dolu/.test(t));
  info.fullBag = { groundBefore: gc0, groundAfter: I.groundCount, msgs: msgs.length };
  check('full bag: item stays on ground', I.groundCount === gc0);
  check('full bag: exactly one warning', msgs.length === 1, msgs.length);
  g.inv.bag[3] = null;
  tick(2);
  check('free slot → picked up', g.inv.bag[3] === it, g.inv.bag[3] && g.inv.bag[3].name);
  g.inv.bag.fill(null);
}

/* --- Sandıklar --- */
{
  const res = [];
  for (let s = 0; s < 3; s++) {
    g.stageIndex = s; g.startStage(false);
    for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
    EV.Enemies.clearAll(g);
    g.inv.bag.fill(null);
    const covers = EV.World.covers.filter((c, i) => i % 2 === 0);
    let opened = 0, walkOpened = 0, items = 0;
    const e0 = g.inv.essence;
    // yürüyerek: 12m dışarıdan merkeze doğru 8 sn
    covers.forEach((c, ci) => {
      const a = ci * 1.3;
      const sx = c.x + Math.sin(a) * 12, sz = c.z + Math.cos(a) * 12;
      P.group.position.set(sx, EV.World.groundY(sx, sz), sz);
      const n0 = toasts.filter((t) => /Sandık/.test(t)).length;
      for (let k = 0; k < 240; k++) {
        P.yaw = Math.atan2(c.x - P.group.position.x, c.z - P.group.position.z);
        In.keys.KeyW = true; tick(1);
        if (toasts.filter((t) => /Sandık/.test(t)).length > n0) break;
      }
      In.keys.KeyW = false;
      if (toasts.filter((t) => /Sandık/.test(t)).length > n0) walkOpened++;
    });
    // kalanları ışınlayarak aç
    covers.forEach((c) => { P.group.position.set(c.x, EV.World.groundY(c.x, c.z), c.z); tick(3); });
    opened = toasts.filter((t) => /Sandık/.test(t)).length;
    items = g.inv.bag.filter(Boolean).length;
    res.push({ stage: s, chests: I.chestCount, walkOpened, essGain: g.inv.essence - e0, bagItems: items });
    toasts.length = 0;
  }
  info.chests = res;
}

/* --- Alfa düşüşü evrimden sonra kayboluyor mu --- */
{
  g.stageIndex = 0; g.generation = 0; g.startStage(false);
  for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
  g.inv.bag.fill(null);
  const a = EV.Enemies.spawnAlpha(g);
  a.group.position.set(P.group.position.x + 3, a.group.position.y, P.group.position.z);
  const n0 = toasts.length;
  g.killEnemy(a);
  const drop = toasts.slice(n0).find((t) => /eşya düştü/.test(t));
  const groundAfterKill = I.groundCount;
  const evolveOpen = !document.getElementById('evolvePanel').hidden;
  for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
  tick(30);
  info.alphaDrop = { dropToast: drop, groundAfterKill, evolveOpen, groundAfterEvolve: I.groundCount, bag: g.inv.bag.filter(Boolean).map((x) => x.name + ' r' + x.rarity), stage: g.stageIndex };
  check('Alfa drop survives evolution', g.inv.bag.some((x) => x && x.rarity >= 3) || I.groundCount > 0, info.alphaDrop);
}
return { fails, info };
