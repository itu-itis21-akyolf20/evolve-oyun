// Akış: 3 ara boss (%25/%50/%75), olaylar, apex trofesi, evrim beden seçimi + belirme,
// geçmiş benlik (nesil 1+), kayıt/yükleme (yeni alanlar + eski kayıt uyumu)
T.start('normal');
const G = EV.Game, P = G.player;
const r = {};
const clear = () => G.enemies.slice().forEach((e) => { if (e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });

// ---- ara bosslar ----
const minis = [];
[0.26, 0.51, 0.76].forEach((f) => {
  G.gainEvo(Math.ceil(G.evoMax() * f - G.evo), 0);
  const m = G.miniBoss;
  minis.push(m ? m.name : null);
  if (m) G.killEnemy(m);
  T.sim(0.8, { dt: 1 / 30, bot: false });
});
r.minis = minis;
r.miniCount = G.miniCount;
G.gainEvo(Math.ceil(G.evoMax() * 0.05), 0);
r.noFourthMini = !G.miniBoss;

// ---- olaylar ----
clear();
const n0 = G.enemies.filter((e) => e.alive).length;
EV.Enemies.spawnHorde(G);
r.hordeSpawned = G.enemies.filter((e) => e.alive && e.aggroT > 30).length;
G.eventT = 0;
let seen = new Set();
for (let i = 0; i < 12; i++) {
  G.eventT = 0; G.bloodMoon = 0; document.body.classList.remove('bloodmoon');
  const before = G.enemies.filter((e) => e.isTreasure).length;
  G.updateEvents(0.016);
  if (G.bloodMoon > 0) seen.add('moon');
  if (G.enemies.filter((e) => e.isTreasure).length > before) seen.add('treasure');
  if (G.enemies.filter((e) => e.alive && e.aggroT > 30).length > r.hordeSpawned) seen.add('horde');
}
r.eventsSeen = [...seen];

// ---- apex trofesi ----
clear();
const ap = EV.Enemies.spawnApex(G);
const dmg0 = P.stats.dmg;
G.killEnemy(ap);
r.trophy = { trophies: G.legacy.trophies, dmgUp: +(P.stats.dmg / dmg0).toFixed(3) };

// ---- evrim: beden seçimi ----
clear();
G.bossActive = false; G.boss = null; G.evo = 0;       // apex EVO'su Alfa'yı erkenden çağırmış olabilir
G.gainEvo(G.evoMax(), 0);
T.sim(0.2, { dt: 1 / 30, bot: false });
r.bossUp = !!G.boss;
if (G.boss) G.killEnemy(G.boss);
r.evolveOpen = !document.getElementById('evolvePanel').hidden;
r.formCards = Array.from(document.querySelectorAll('#evForms .form'), (n) => n.querySelector('.fn').textContent);
const raptor = document.querySelector('#evForms .form[data-f="raptor"]');
raptor && raptor.click();
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
T.sim(0.5, { dt: 1 / 30, bot: false });
r.afterEvolve = { stage: G.stageIndex, form: G.legacy.forms[1], legs: P.bodySpec.parts.legs, intro: +G.evoIntro.toFixed(2), scale: +P.group.scale.x.toFixed(2),
  heroes: G.legacy.heroes.length };
T.sim(2, { dt: 1 / 30, bot: false });
r.introDone = P.group.scale.x === 1;

// ---- geçmiş benlik: nesil 1'de önceki nesil kahramanı gelir ----
clear();
G.generation = 1;
if (!G.legacy.heroes.length) return Object.assign(r, { err: 'no heroes' });
G.legacy.heroes[0].gen = 0;
G.nemesisT = 0; G.eventT = 999;
G.updateEvents(0.016);
const nm = G.nemesis;
r.nemesis = nm ? { name: nm.name, abilities: nm.boss.kit.abilities.map((a) => a.name), hp: Math.round(nm.maxHp) } : null;
if (nm) { T.sim(6, { dt: 1 / 30, until: () => { P.hp = P.stats.maxHp; return false; } }); r.nemesisAlive = nm.alive; G.killEnemy(nm); }
G.generation = 0;

// ---- kayıt / yükleme ----
G.save();
const d = G.loadRaw();
G.applySave(d);
r.saveLoad = { forms: G.legacy.forms, trophies: G.legacy.trophies, heroes: G.legacy.heroes.length, miniCount: G.miniCount };
const old = JSON.parse(JSON.stringify(d));
delete old.miniCount; delete old.miniOrder; old.miniDone = true;
delete old.legacy.trophies; delete old.legacy.forms; delete old.legacy.heroes;
G.applySave(old);
r.oldSave = { miniCount: G.miniCount, trophies: G.legacy.trophies, forms: G.legacy.forms };
const bad = JSON.parse(JSON.stringify(d));
bad.legacy.heroes = [{ spec: { kind: 'x', scale: 'a', parts: { legs: 99, form: '<b>' }, extras: 5 }, name: '<script>' }, 7, null];
G.applySave(bad);
r.badHeroSanitized = G.legacy.heroes.map((h) => h.name + ' legs=' + h.spec.parts.legs);
T.sim(2, { dt: 1 / 30 });
return r;
