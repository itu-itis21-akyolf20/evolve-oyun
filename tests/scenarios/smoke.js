// Duman testi: oyun açılıyor mu, 60 sn otomatik oyunda hata var mı
const s0 = T.start('normal');
const s1 = T.sim(60, { dt: 1 / 30 });
return { s0, s1, stats: T.stats };
