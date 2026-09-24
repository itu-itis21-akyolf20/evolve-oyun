// it-plus-mobile: mobil sayfada (body.mobile) çanta düzeni + Kapat düğmesi + dokunmatik basma
// Sunucu gerekir: node tests/cdp-run.mjs --port 9426 --url http://127.0.0.1:9438/mobile.html --scenario tests/scenarios/it-plus-mobile.js --shot x.png --width 796 --height 455
const wait = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 50)); } return true; };
await wait(() => window.EV && EV.Game && EV.Inv && document.getElementById('mTouch'), 15000);
T.start('normal');
const g = EV.Game, I = EV.Items;
g.inv.bag.fill(null);
for (let i = 0; i < 14; i++) g.inv.bag[i] = I.makeItem(I.SLOTS[i % 6].id, i % 5, 1);
I.SLOTS.forEach((s, i) => { g.inv.equip[s.id] = I.makeItem(s.id, 2 + (i % 3), 1); g.inv.equip[s.id].plus = [9, 7, 0, 3, 6, 1][i]; });
g.inv.essence = 99999;
EV.Build.recompute(g);
// mobil çanta düğmesi (gerçek dokunuş)
const root = document.getElementById('mTouch');
const bagBtn = root.querySelector('[data-a="bag"]');
const tap = (el) => { const t = new Touch({ identifier: Date.now() % 1e6, target: el, clientX: 0, clientY: 0 }); el.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [t], touches: [t], bubbles: true, cancelable: true })); el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [t], touches: [], bubbles: true, cancelable: true })); };
if (bagBtn) tap(bagBtn); else { EV.Inv.open(g); g.pause(); }
await new Promise((r) => setTimeout(r, 200));
const out = { open: EV.Inv.isOpen(), mobile: document.body.classList.contains('mobile') };
document.querySelector('#invBag .icell[data-i="1"]').click();
const b = document.querySelector('#invDetail button[data-a="enhance"]');
const it = g.inv.bag[1];
const p0 = it.plus;
b.click();
out.enhanced = it.plus !== p0 || g.inv.essence < 99999;
const close = document.querySelector('#invPanel .mInvClose');
const cr = close && close.getBoundingClientRect();
out.close = cr ? { vis: close.offsetParent !== null, rect: [Math.round(cr.left), Math.round(cr.top), Math.round(cr.right), Math.round(cr.bottom)] } : null;
const pr = document.querySelector('#invPanel .panel').getBoundingClientRect();
out.panel = [Math.round(pr.left), Math.round(pr.top), Math.round(pr.right), Math.round(pr.bottom)];
out.vw = innerWidth; out.vh = innerHeight;
out.cols = [...document.querySelectorAll('#invPanel .invcol')].map((c) => [c.clientHeight, c.scrollHeight]);
return out;
