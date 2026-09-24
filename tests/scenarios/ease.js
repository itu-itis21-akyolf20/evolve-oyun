// Kart ekranı tıklama kilidi, II/III seyrekliği, kayıt verisi (bulut çağrısı dahil)
T.start('normal');
const G = EV.Game;
const r = {};

// 1) kart ekranı: açılır açılmaz tıklama seçmemeli, 0.8 sn sonra seçmeli
const calls = [];
EV.Cards.openLevel(G, { title: 'TEST', cards: EV.Build.roll(G, 3), onPick: (c) => calls.push(c) });
document.querySelector('#cardRow .card').click();
r.earlyClickIgnored = calls.length === 0 && EV.Cards.isOpen();
r.panelTop = Math.round(document.querySelector('#cardPanel .cards-wrap').getBoundingClientRect().top);
const t0 = performance.now();
while (performance.now() - t0 < 850) { /* bekle */ }
document.querySelector('#cardRow .card').click();
r.lateClickPicks = calls.length === 1 && !EV.Cards.isOpen();

// 2) II/III oranı seviyeye göre (10.000 zar)
const dist = (L) => {
  G.build.level = L;
  const n = { 1: 0, 2: 0, 3: 0 };
  const pool = EV.MOBS.ENEMIES[0];
  const before = G.enemies.length;
  for (let i = 0; i < 400; i++) EV.Enemies.spawnPack(G);
  G.enemies.slice(before).forEach((e) => n[e.variant]++);
  for (let i = G.enemies.length - 1; i >= before; i--) EV.Enemies.despawn(G, i);
  const tot = n[1] + n[2] + n[3];
  return { II: +(n[2] / tot * 100).toFixed(1), III: +(n[3] / tot * 100).toFixed(1) };
};
r.variantPct = { L2: dist(2), L5: dist(5), L10: dist(10), L20: dist(20) };
G.build.level = 1;

// 3) kayıt: yerel yazılıyor, isim içeriyor, bulut çağrısı hata atmıyor
G.save(true);
const d = G.loadRaw();
r.saveOk = !!d && d.name === 'TestBot' && typeof d.t === 'number';
r.saveKB = +(JSON.stringify(d).length / 1024).toFixed(1);
r.code = document.getElementById('saveCode').textContent;
r.diff = { hp: G.diff.hp, dmg: G.diff.dmg };
T.sim(30, { dt: 1 / 30 });
return r;
