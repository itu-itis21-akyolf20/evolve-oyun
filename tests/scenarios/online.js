// Sunucu üzerinden: isim, hasar takibi, puan gönderimi, liderlik tablosu
T.start('normal');
T.sim(90, { dt: 1 / 30 });
const G = EV.Game;
EV.Online.submit(G, true);
await new Promise((r) => setTimeout(r, 3800));   // yeniden deneme penceresi
G.paused = true;
await EV.Online.show(G);
await new Promise((r) => setTimeout(r, 600));
const rows = [...document.querySelectorAll('#lbRows tr')].map((tr) => tr.textContent);
return { name: EV.Online.name(), score: EV.Online.score(G), stats: G.stats, kills: G.kills, rows, me: document.getElementById('lbMe').textContent };
