// it-plus-shot: envanter ekran görüntüsü (6 yuva, +N rozetleri, takımlar, riskli basma seçili)
// node tests/cdp-run.mjs --port 9424 --scenario tests/scenarios/it-plus-shot.js --shot tests/it-plus-1280.png --width 1280 --height 720
T.start('normal');
const g = EV.Game;
const I = EV.Items;
g.stageIndex = 2;
const mk = (slot, r, il, plus, set) => { const it = I.makeItem(slot, r, il); it.plus = 0; for (let k = 0; k < plus; k++) { g.inv.bag[23] = it; g.inv.essence = 1e9; const rnd = Math.random; Math.random = () => 0; I.enhance(g, 'bag', 23); Math.random = rnd; } g.inv.bag[23] = null; if (set) it.set = set; return it; };
g.inv.bag.fill(null); g.inv.chest.fill(null);
for (let i = 0; i < 22; i++) if (i % 5 !== 4) g.inv.bag[i] = mk(I.SLOTS[i % 6].id, i % 5, i % 13, (i * 7) % 10, i % 3 === 0 && i % 5 >= 2 ? I.SETS[i % 4].id : null);
for (let i = 0; i < 48; i += 3) g.inv.chest[i] = mk(I.SLOTS[i % 6].id, (i / 3) % 5, 12, (i / 3) % 10);
const eqPlus = [9, 7, 3, 0, 6, 2];
I.SLOTS.forEach((s, i) => { g.inv.equip[s.id] = mk(s.id, [4, 3, 2, 1, 3, 4][i], 2 + i, eqPlus[i], i === 1 || i === 4 ? 'kurt' : null); });
g.inv.essence = 12345;
EV.Build.recompute(g);
EV.Inv.open(g);
g.pause();
// riskli (+6) kuşanılı pençeyi seç ve onay aşamasına getir
document.querySelector('#invEquip .icell[data-i="claw"]').click();
const enh = document.querySelector('#invDetail button[data-a="enhance"]');
if (window.__arm && enh) enh.click();
const panel = document.querySelector('#invPanel .panel').getBoundingClientRect();
const det = document.getElementById('invDetail');
const overflowX = [...document.querySelectorAll('#invPanel *')].filter((n) => n.getBoundingClientRect().right > innerWidth + 1).map((n) => n.id || n.className).slice(0, 5);
const btns = [...document.querySelectorAll('#invDetail button')].map((b) => ({ t: b.textContent, clip: b.scrollWidth > b.clientWidth + 1, h: Math.round(b.getBoundingClientRect().height) }));
return {
  vw: innerWidth, vh: innerHeight,
  panel: [Math.round(panel.left), Math.round(panel.top), Math.round(panel.right), Math.round(panel.bottom)],
  detail: { scrollH: det.scrollHeight, clientH: det.clientHeight },
  cols: [...document.querySelectorAll('#invPanel .invcol')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), c.scrollHeight]; }),
  overflowX, btns,
  equipCells: document.querySelectorAll('#invEquip .icell').length,
};
