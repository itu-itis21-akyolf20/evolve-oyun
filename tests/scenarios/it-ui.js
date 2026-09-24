// it-ui: envanter arayüzü (gerçek tıklamalar) + Tab / Esc / K / kart modalı etkileşimi
T.start('normal');
T.sim(20, { dt: 1 / 30 });
const g = EV.Game;
const I = EV.Items;
const P = g.player;
const $ = (id) => document.getElementById(id);
const fails = [];
const info = {};
const check = (name, cond, extra) => { if (!cond) fails.push({ name, extra }); };
const toasts = [];
const origToast = EV.UI.toast;
EV.UI.toast = function (t) { toasts.push(String(t).replace(/<[^>]+>/g, '')); return origToast.apply(this, arguments); };
const key = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
const invOpen = () => !$('invPanel').hidden;
const bagCell = (i) => document.querySelector('#invBag .icell[data-i="' + i + '"]');
const btn = (a) => document.querySelector('#invDetail button[data-a="' + a + '"]');
const errs = [];
window.addEventListener('error', (e) => errs.push(String(e.message)));

/* ---------- UI işlemleri ---------- */
{
  g.inv.bag.fill(null); g.inv.chest.fill(null);
  g.inv.equip = { fang: null, hide: null, organ: null, relic: null };
  EV.Build.recompute(g);
  const it = I.makeItem('fang', 2, 0); it.affixes = [{ k: 'dmg', roll: 1 }, { k: 'crit', roll: 1 }, { k: 'atkSpd', roll: 1 }];
  g.inv.bag[4] = it;
  g.inv.essence = 5000;
  EV.Inv.open(g);
  const d0 = P.stats.dmg;
  bagCell(4).click();
  check('detail shows name', $('invDetail').textContent.includes(it.name));
  check('equip button', !!btn('equip'));
  btn('equip').click();
  check('UI equip', g.inv.equip.fang === it && !g.inv.bag[4]);
  check('UI equip stats', P.stats.dmg > d0, [d0, P.stats.dmg]);
  check('after equip selection moves to equip slot', !!btn('unequip'));
  // upgrade via UI from equip
  const up = I.upgradeCost(it); const e0 = g.inv.essence; const d1 = P.stats.dmg;
  btn('upgrade').click();
  check('UI upgrade', it.rarity === 3 && e0 - g.inv.essence === up && P.stats.dmg > d1, [it.rarity, e0 - g.inv.essence, up]);
  btn('unequip').click();
  check('UI unequip', !g.inv.equip.fang && g.inv.bag.includes(it) && Math.abs(P.stats.dmg - d0) < 1e-9);
  const bi = g.inv.bag.indexOf(it);
  bagCell(bi).click();
  btn('toChest').click();
  check('UI toChest', g.inv.chest.includes(it) && !g.inv.bag.includes(it));
  const ci = g.inv.chest.indexOf(it);
  document.querySelector('#invChest .icell[data-i="' + ci + '"]').click();
  check('chest item has toBag', !!btn('toBag'));
  btn('toBag').click();
  check('UI toBag', g.inv.bag.includes(it));
  bagCell(g.inv.bag.indexOf(it)).click();
  const sv = I.salvageValue(it); const e1 = g.inv.essence;
  info.salvageBtnText = btn('salvage').textContent;
  btn('salvage').click();
  check('UI salvage', !g.inv.bag.includes(it) && g.inv.essence - e1 === sv);
  // craft buttons
  const nb = g.inv.bag.filter(Boolean).length;
  document.querySelector('#invCraft .craftbtn[data-s="relic"]').click();
  check('UI craft', g.inv.bag.filter(Boolean).length === nb + 1);
  info.afterCraftDetail = $('invDetail').textContent.slice(0, 80);
  // poor → buttons disabled
  g.inv.essence = 10; EV.Inv.render();
  check('craft disabled when poor', [...document.querySelectorAll('#invCraft .craftbtn')].every((b) => b.disabled));
  const up2 = document.querySelector('#invDetail button[data-a="upgrade"]');
  check('upgrade disabled when poor', !up2 || up2.disabled);
  // full bag craft
  g.inv.essence = 5000;
  for (let i = 0; i < 24; i++) if (!g.inv.bag[i]) g.inv.bag[i] = I.makeItem('hide', 0, 0);
  EV.Inv.render();
  const t0 = toasts.length;
  document.querySelector('#invCraft .craftbtn[data-s="fang"]').click();
  info.fullCraftToast = toasts.slice(t0);
  check('full bag craft refused with message', g.inv.essence === 5000 && toasts.slice(t0).some((t) => /Çanta dolu/.test(t)));
  info.craftBtnEnabledWhenBagFull = !document.querySelector('#invCraft .craftbtn').disabled;
  // unequip with full bag via UI
  g.inv.equip.organ = I.makeItem('organ', 1, 0); EV.Build.recompute(g); EV.Inv.render();
  document.querySelector('#invEquip .icell[data-i="organ"]').click();
  const t1 = toasts.length;
  btn('unequip').click();
  check('UI unequip full bag refused', !!g.inv.equip.organ && toasts.slice(t1).some((t) => /Çanta dolu/.test(t)));
  // salvage equipped via UI
  document.querySelector('#invEquip .icell[data-i="organ"]').click();
  btn('salvage').click();
  check('UI salvage equipped', !g.inv.equip.organ);
  // chest full via UI
  for (let i = 0; i < 48; i++) g.inv.chest[i] = I.makeItem('relic', 0, 0);
  EV.Inv.render(); bagCell(0).click();
  const t2 = toasts.length;
  btn('toChest').click();
  check('UI chest full refused', !!g.inv.bag[0] && toasts.slice(t2).some((t) => /Sandık dolu/.test(t)));
  // legendary: no upgrade button
  g.inv.bag[1] = I.makeItem('fang', 4, 0); EV.Inv.render(); bagCell(1).click();
  check('legendary no upgrade button', !btn('upgrade') && $('invDetail').textContent.includes('★'));
  // compare panel shows equipped
  g.inv.equip.fang = I.makeItem('fang', 1, 0); EV.Build.recompute(g); EV.Inv.render(); bagCell(1).click();
  check('compare shown', !!document.querySelector('#invDetail .cmp'));
  // equip legendary with existing → swap puts old in same bag idx
  const old = g.inv.equip.fang; btn('equip').click();
  check('UI swap', g.inv.bag[1] === old);
  EV.Inv.close();
  g.inv.bag.fill(null); g.inv.chest.fill(null);
}

/* ---------- Tab ---------- */
const tab = {};
{
  for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
  g.paused = false;
  key('Tab');
  tab.openAfterTab = invOpen(); tab.pausedAfterTab = g.paused;
  key('Tab');
  tab.openAfterTab2 = invOpen(); tab.pausedAfterTab2 = g.paused;
  check('Tab opens + pauses', tab.openAfterTab && tab.pausedAfterTab);
  check('Tab again closes + resumes', !tab.openAfterTab2 && !tab.pausedAfterTab2, tab);
  // Esc
  key('Tab'); key('Escape');
  tab.escClosed = !invOpen(); tab.pausedAfterEsc = g.paused;
  check('Esc closes', tab.escClosed);
  g.paused = false;
  // K while inventory open
  key('Tab'); key('KeyK');
  tab.kOverInv = { inv: invOpen(), build: !$('buildPanel').hidden, which: EV.Cards.which };
  check('K does not open build over inventory', !(tab.kOverInv.inv && tab.kOverInv.build), tab.kOverInv);
  key('Tab');
  tab.afterTabWithBuild = { inv: invOpen(), build: !$('buildPanel').hidden, paused: g.paused };
  if (!$('buildPanel').hidden) key('KeyK');
  tab.afterK2 = { inv: invOpen(), build: !$('buildPanel').hidden, paused: g.paused };
  if (invOpen()) EV.Inv.close();
  g.paused = false;
  // Tab while build panel open
  key('KeyK');
  key('Tab');
  tab.tabOverBuild = { inv: invOpen(), build: !$('buildPanel').hidden };
  check('Tab blocked while build panel open', !tab.tabOverBuild.inv, tab.tabOverBuild);
  if (invOpen()) EV.Inv.close();
  if (!$('buildPanel').hidden) key('KeyK');
  // level-up card modal
  g.paused = false;
  g.build.picks = 1;
  g.time += 1 / 30; EV.tick(1 / 30); EV.Input.endFrame();
  tab.cardOpen = !$('cardPanel').hidden;
  key('Tab');
  tab.tabOverCard = { inv: invOpen(), paused: g.paused, card: !$('cardPanel').hidden };
  check('Tab does not open over card', tab.cardOpen && !tab.tabOverCard.inv, tab);
  key('Tab');
  check('Tab does not unpause while card open', g.paused && !$('cardPanel').hidden);
  key('Escape');
  check('Esc does not unpause with card', g.paused);
  T.handleModals({ pick: 'first' });
  tab.afterCardPick = { paused: g.paused };
  // inventory open then card becomes due: resume after Tab close
  g.paused = false;
  key('Tab');
  g.build.picks = 1;
  g.openNextPick();       // doğrudan: envanter açıkken kart açılabiliyor mu?
  tab.cardOverInv = { inv: invOpen(), card: !$('cardPanel').hidden };
  key('Tab');
  tab.afterTabCardOverInv = { inv: invOpen(), card: !$('cardPanel').hidden, paused: g.paused };
  check('closing inv with card open keeps pause', g.paused || $('cardPanel').hidden, tab.afterTabCardOverInv);
  for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
  // key repeat: holding Tab
  g.paused = false;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', repeat: false }));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', repeat: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', repeat: true }));
  tab.afterRepeat = { inv: invOpen(), paused: g.paused };
  if (invOpen()) EV.Inv.close();
  // dead player
  g.paused = false; P.alive = false;
  key('Tab'); tab.deadOpen = invOpen();
  check('Tab ignored when dead', !tab.deadOpen);
  P.alive = true;
  // does the game tick run while inventory open (in real loop)?
  g.paused = false; key('Tab');
  const t0 = g.time;
  await new Promise((r) => setTimeout(r, 500));
  tab.timeAdvancedWhileOpen = g.time - t0;
  check('game frozen while inventory open', tab.timeAdvancedWhileOpen === 0, tab.timeAdvancedWhileOpen);
  key('Tab');
  // Tab while mouse over text field? — default prevented
  const ev = new KeyboardEvent('keydown', { code: 'Tab', cancelable: true });
  window.dispatchEvent(ev);
  tab.defaultPrevented = ev.defaultPrevented;
  if (invOpen()) key('Tab');
}
info.tab = tab;
return { fails, info, errs };
