// it-clear: aşama temizliğinde yerdeki eşyalar — çanta+sandık doluysa? yeni oyuna sızıyor mu?
T.start('normal');
const g = EV.Game, I = EV.Items, P = g.player;
const toasts = []; const o = EV.UI.toast; EV.UI.toast = function (t) { toasts.push(String(t).replace(/<[^>]+>/g, '')); return o.apply(this, arguments); };
for (let i = 0; i < 24; i++) g.inv.bag[i] = I.makeItem('fang', 0, 0);
for (let i = 0; i < 48; i++) g.inv.chest[i] = I.makeItem('fang', 0, 0);
const far = { x: P.group.position.x + 30, z: P.group.position.z + 30, clone() { return this; } };
const epic = I.makeItem('hide', 3, 0);
I.dropAt(g, far, epic);
const n0 = toasts.length;
g.startStage(false); for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
const lostWhenFull = { ground: I.groundCount, inBag: g.inv.bag.includes(epic), inChest: g.inv.chest.includes(epic), toasts: toasts.slice(n0) };
// yeni oyuna sızma
const leg = I.makeItem('relic', 4, 0);
I.dropAt(g, far, leg);
g.newGame('normal'); for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
const leak = { bag: g.inv.bag.filter(Boolean).map((x) => x.name) };
return { lostWhenFull, leak };
