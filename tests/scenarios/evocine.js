// Evrim sinematiği: sarılma → geçiş → çıkış; bitince aşama değişmiş, başlangıç kartı açık, beden ölçeği 1
EV.Game.startForm = 'flagellate';
T.start('normal');
const G = EV.Game, P = G.player;
G.gainEvo(G.evoMax(), 0);
T.sim(0.1, { dt: 1 / 30, bot: false, until: () => !!G.boss });
G.killEnemy(G.boss);
document.querySelector('#evForms .form[data-f="raptor"]').click();
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
const r = { cineStarted: EV.EvoCine.active, stageDuringWrap: G.stageIndex };
const shots = [];
// gerçek zamanlı ilerlesin (ekran görüntüsü için): sarılmanın ortası
await new Promise((res) => setTimeout(res, 900));
r.midWrap = { active: EV.EvoCine.active, playerScale: +P.group.scale.x.toFixed(2) };
await new Promise((res) => setTimeout(res, 4200));
r.after = { active: EV.EvoCine.active, stage: G.stageIndex, form: G.legacy.forms[1], startCard: EV.Cards.isOpen(),
  scale: G.player.group.scale.x, emissive: G.player.group.userData.mats.solid.emissive.getHex() };
return r;
