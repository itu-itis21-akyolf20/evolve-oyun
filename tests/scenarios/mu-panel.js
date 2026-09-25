// mu-panel: BEDEN / MUTASYONLAR ekranı — gerçek tıklamalarla bölge seçimi, tak/çıkar, evrimleştir, emilim, üret
// Ekran görüntüsü için --shot x.png (1280×720 ve 780×360 dene)
T.start('normal');
const G = EV.Game, I = EV.Items, $ = (id) => document.getElementById(id);
const fails = [], info = {};
const check = (n, c, x) => { if (!c) fails.push({ n, x }); };
const errs = [];
window.addEventListener('error', (e) => errs.push(String(e.message)));
G.stageIndex = 2; G.startStage(false);
for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
G.inv.bag.fill(null);
const donors = ['porcupine', 'mammoth', 'eagle', 'skunk', 'saber', 'deer', 'croc', 'jelly', 'virus', 'ptero', 'hornlizard', 'fox'];
donors.forEach((id, i) => { G.inv.bag[i] = I.makeItem(null, i % 5, 2, I.donorParts(id)[0]); });
G.inv.bag[14] = I.makeItem('jaw', 4, 3);
G.inv.essence = 50000;
EV.Build.recompute(G);
EV.Inv.open(G); G.pause();
const bagCell = (i) => document.querySelector('#invBag .icell[data-i="' + i + '"]');
const clk = (el, n) => { if (el) el.click(); else fails.push({ n: 'missing ' + n }); };
const btn = (a) => document.querySelector('#invDetail button[data-a="' + a + '"]');
info.names = G.inv.bag.filter(Boolean).map((x) => x.name + ' [' + x.slot + '/' + x.kind + ']');
// depodaki Kirpi Dikeni → tak
clk(bagCell(0), 'bag0');
check('detail name', $('invDetail').textContent.includes(G.inv.bag[0].name));
const q = G.inv.bag[0];
clk(btn('equip'), 'equip');
check('equipped back', G.inv.equip.back === q, G.inv.equip.back && G.inv.equip.back.name);
check('body has mutation', I.bodyMutations(G).some((m) => m.kind === 'quills'));
// bölgeye dokun → süzgeç + ayrıntı
clk(document.querySelector('#invEquip .rgn[data-r="jaw"]'), '#invEquip .rgn[data-r="jaw"]');
check('region filter jaw', [...document.querySelectorAll('#invBag .icell')].every((c) => G.inv.bag[+c.dataset.i].slot === 'jaw'));
clk(document.querySelector('#invBag .icell'), '#invBag .icell');
clk(btn('equip'), 'equip');
check('equip jaw', !!G.inv.equip.jaw);
// evrimleştir (takılıyken) 3 kez
clk(document.querySelector('#invEquip .rgn[data-r="back"]'), '#invEquip .rgn[data-r="back"]');
const p0 = q.plus;
for (let k = 0; k < 3; k++) clk(btn('enhance'), 'enhance');
check('enhanced', q.plus > p0, [p0, q.plus]);
// tüm sekmeler tıklanabilir
document.querySelectorAll('#invTabs .itab').forEach((b) => b.click());
clk(document.querySelector('#invTabs .itab[data-f=""]'), '#invTabs .itab[data-f=""]');
// üret
const n0 = I.depotCount(G.inv);
clk(document.querySelector('#invCraft .craftbtn[data-s="tail"]'), '#invCraft .craftbtn[data-s="tail"]');
check('crafted', I.depotCount(G.inv) === n0 + 1);
// emilim
const e0 = G.inv.essence;
clk(document.querySelector('#invBag .icell'), 'anybag'); clk(btn('salvage'), 'salvage');
check('salvage', G.inv.essence > e0);
// ekran görüntüsü için: tüm bölgeleri doldur, sırt seçili
['head', 'hide', 'claws', 'tail'].forEach((r, i) => { G.inv.equip[r] = I.makeItem(r, 1 + i, 2); G.inv.equip[r].plus = [2, 5, 7, 9][i]; });
EV.Build.recompute(G); I.refreshBody(G);
EV.Inv.render();
clk(document.querySelector('#invEquip .rgn[data-r="back"]'), '#invEquip .rgn[data-r="back"]');
const pr = document.querySelector('#invPanel .panel').getBoundingClientRect();
info.panel = [Math.round(pr.left), Math.round(pr.top), Math.round(pr.right), Math.round(pr.bottom)];
info.vw = innerWidth; info.vh = innerHeight;
info.cols = [...document.querySelectorAll('#invPanel .invcol')].map((c) => [c.clientWidth, c.clientHeight, c.scrollHeight]);
const rg = [...document.querySelectorAll('#invEquip .rgn')].map((n) => n.getBoundingClientRect());
const bm = $('invEquip').getBoundingClientRect();
info.rgnOutside = rg.filter((r) => r.left < bm.left - 4 || r.right > bm.right + 4 || r.top < bm.top - 4 || r.bottom > bm.bottom + 4).length;
info.overflowX = document.querySelector('#invPanel .panel').scrollWidth > document.querySelector('#invPanel .panel').clientWidth + 1;
info.buttonsClipped = [...document.querySelectorAll('#invDetail button')].filter((b) => b.scrollWidth > b.clientWidth + 2).map((b) => b.textContent);
return { fails, info, errs };
