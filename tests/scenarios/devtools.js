// Test modu (?test): başlangıç kutusu ile aşama/nesil/seviye/soy seçip başla; panelin her düğmesi hatasız
const wait = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 50)); } return true; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(() => window.EV && EV.Game && document.getElementById('tBox'), 15000);
const r = { test: EV.TEST, box: !!document.getElementById('tBox') };
const G = EV.Game;
localStorage.removeItem('evolve_save_test');
const real0 = localStorage.getItem('evolve_save_v4');
const set = (id, v) => { document.getElementById(id).value = String(v); };
set('tStage', 2); set('tGen', 1); set('tLvl', 10); set('tF0', 'flagellate'); set('tF1', 'raptor'); set('tF2', 'cat');
document.getElementById('tGo').click();
await sleep(200);
r.started = { stage: G.stageIndex, gen: G.generation, level: G.build.level, forms: G.legacy.forms, genes: G.legacy.genes.length,
  skills: G.build.skills.length + G.build.passives.length, startCard: EV.Cards.isOpen() };
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));   // başlangıç kartı
await sleep(100);

// panel
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
await sleep(100);
const panel = document.getElementById('tPanel');
r.panelOpen = !panel.hidden && G.paused;
const clickA = (a, extra) => { const b = panel.querySelector('button[data-a="' + a + '"]' + (extra || '')); if (b) b.click(); return !!b; };
const done = [];
for (const a of ['god', 'fill', 'ess', 'lvl5', 'treasure', 'horde', 'moon', 'champ', 'apex', 'nemesis', 'evo50']) { if (clickA(a)) done.push(a); }
clickA('mini', '[data-i="1"]'); done.push('mini1');
clickA('item', '[data-r="4"]'); done.push('item4');
r.afterButtons = { done, essence: G.inv.essence, level: G.build.level, bag: G.inv.bag.filter(Boolean).length, moon: G.bloodMoon > 0,
  mini: G.miniBoss && G.miniBoss.name, nemesis: G.nemesis && G.nemesis.name, apex: !!G.apex };
// her tür
const mobs = Array.from(document.querySelectorAll('#tMob option'), (o) => o.value);
for (const id of mobs) { document.getElementById('tMob').value = id; document.getElementById('tVar').value = '5'; clickA('mob'); }
clickA('mobc');
r.spawnedTypes = mobs.length;
r.enemies = G.enemies.filter((e) => e.alive && !e.ally).length;
panel.querySelector('button[data-x="close"]').click();
await sleep(50);
r.closedResumed = panel.hidden && !G.paused;
const d0 = T.stats.deaths;
let lost = 0, prev = G.player.hp;
T.sim(6, { dt: 1 / 30, until: () => { const P = G.player; if (P.hp < prev) lost += prev - P.hp; prev = P.hp; return false; } });
r.god = { hpLost: Math.round(lost), deaths: T.stats.deaths - d0 };
// hemen evrim
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
clickA('evolve');
r.evolveOpen = !document.getElementById('evolvePanel').hidden;
r.evolveOptions = Array.from(document.querySelectorAll('#evForms .form'), (n) => n.dataset.f);
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
await sleep(100);
r.afterEvolve = { gen: G.generation, form: G.legacy.forms[2] };
G.save();
r.saves = { testSave: !!localStorage.getItem('evolve_save_test'), realUntouched: localStorage.getItem('evolve_save_v4') === real0 };
return r;
