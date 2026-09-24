// it-shot: envanter ekran görüntüsü için karışık nadirlikte doldur
T.start('normal');
const g = EV.Game;
const I = EV.Items;
g.stageIndex = 2;
for (let i = 0; i < 24; i++) if (i % 5 !== 4) g.inv.bag[i] = I.makeItem(I.SLOTS[i % 4].id, i % 5, i % 13);
for (let i = 0; i < 48; i += 3) g.inv.chest[i] = I.makeItem(I.SLOTS[i % 4].id, (i / 3) % 5, 12);
I.SLOTS.forEach((s, i) => { if (i < 3) g.inv.equip[s.id] = I.makeItem(s.id, 4 - i, 11); });
g.inv.essence = 123456;
EV.Build.recompute(g);
EV.Inv.open(g);
// uzun adlı değerli bir eşyayı seç (karşılaştırma kutusu görünsün)
const idx = g.inv.bag.findIndex((x) => x && x.rarity === 3 && x.slot === 'fang') >= 0 ? g.inv.bag.findIndex((x) => x && x.rarity === 3) : 3;
document.querySelector('#invBag .icell[data-i="' + idx + '"]').click();
const p = document.querySelector('#invPanel .panel').getBoundingClientRect();
const d = document.getElementById('invDetail').getBoundingClientRect();
const bag = document.getElementById('invBag').getBoundingClientRect();
const chest = document.getElementById('invChest').getBoundingClientRect();
const over = [];
document.querySelectorAll('#invPanel .icell').forEach((c) => { const r = c.getBoundingClientRect(); if (r.width < 24) over.push('tiny cell ' + r.width.toFixed(0)); });
const btns = [...document.querySelectorAll('#invDetail button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, w: Math.round(r.width), sw: b.scrollWidth, cw: b.clientWidth }; });
const craft = [...document.querySelectorAll('#invCraft button')].map((b) => ({ t: b.textContent, sw: b.scrollWidth, cw: b.clientWidth }));
const panelEl = document.querySelector('#invPanel .panel');
return {
  vw: innerWidth, vh: innerHeight, panel: { top: p.top, bottom: p.bottom, h: p.height, scrollH: panelEl.scrollHeight, clientH: panelEl.clientHeight },
  overlay: { scrollH: document.getElementById('invPanel').scrollHeight, clientH: document.getElementById('invPanel').clientHeight },
  detail: { l: d.left, r: d.right, t: d.top, b: d.bottom }, bag: { l: bag.left, r: bag.right, t: bag.top, b: bag.bottom }, chest: { t: chest.top, b: chest.bottom },
  cellW: document.querySelector('#invBag .icell').getBoundingClientRect().width, over: over.slice(0, 3), btns, craft,
  hidden: [...document.querySelectorAll('#hud, #skillbar')].map((e) => e.id + ':' + getComputedStyle(e).display),
};
