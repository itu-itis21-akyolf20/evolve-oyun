// Soy ağacı: Kamçılı → (Kertenkele|Raptor|🔒Pterozor) → Raptor → (Kurt|Kedi|🔒Kuş) → Kedi → nesil: (Kedi|Kurt)
// atalardan iz (çizgiler + pençe), ata statları yarı etki, dönüşüm hayaleti, kayıt
const G = EV.Game;
G.startForm = 'flagellate';
T.start('normal');
const P = G.player;
const r = { root: G.legacy.forms[0], cellFlagella: P.bodySpec.parts.flagella };

function evolve(pick) {
  G.bossActive = false; G.boss = null; G.evo = 0;
  G.enemies.slice().forEach((e) => { if (e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
  G.gainEvo(G.evoMax(), 0);
  T.sim(0.1, { dt: 1 / 30, bot: false, until: () => !!G.boss });
  G.killEnemy(G.boss);
  const cards = Array.from(document.querySelectorAll('#evForms .form'), (n) => n.dataset.f + (n.classList.contains('locked') ? '🔒' : ''));
  const lin = (document.querySelector('#evForms .lineage') || {}).textContent || '';
  const el = document.querySelector('#evForms .form[data-f="' + pick + '"]');
  if (el) el.click();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
  const cine = EV.EvoCine.active;
  T.sim(5, { dt: 1 / 30, bot: false });             // koza sinematiği (araç hızlı ilerletir) + başlangıç kartı
  return { cards, lin: lin.trim(), cine, cineDone: !EV.EvoCine.active };
}

r.toReptile = evolve('raptor');
r.reptile = { form: G.legacy.forms[1], legs: P.bodySpec.parts.legs, extras: P.bodySpec.extras.slice() };

r.toMammal = evolve('cat');
r.mammal = { form: G.legacy.forms[2], extras: P.bodySpec.extras.slice(), spikes: !!P.bodySpec.parts.spikes };
EV.Build.recompute(G);
r.mods = { speed: +(G.build.mods.speed || 0).toFixed(3), atkSpd: +(G.build.mods.atkSpd || 0).toFixed(3), critDmg: +(G.build.mods.critDmg || 0).toFixed(3) };

r.toGen2 = evolve('wolf');
r.gen = { generation: G.generation, form: G.legacy.forms[2] };

// eski kayıt (soy yok) — seçenekler hepsi açık olmalı
G.save();
const d = G.loadRaw();
d.legacy.forms = { 2: 'bear' };
G.applySave(d);
r.oldSaveOptions = EV.FORMS.options(2, 2, G.legacy.forms).map((f) => f.id);
r.noRootOptions = EV.FORMS.options(1, 0, {}).map((f) => f.id);
T.sim(1, { dt: 1 / 30 });
return r;
