/* ============================================================
   data/mobs.js — yaratıklar, Alfalar, Apex avcılar

   behavior:
     passive     dolaşır, vurulunca/yaklaşılınca kaçar (kolay EVO)
     neutral     dolaşır, vurulunca sürüsüyle birlikte saldırır
     aggressive  menzile girince kovalar
   pack: [min, max] — aynı türden kaç tanesi birlikte doğar
   atk:  temel saldırı { range, windup, cd } — windup'ta geri çekilirsen ıskalar
   ability: türe özgü, yerde uyarı gösteren saldırı (boss.js çalıştırır)
   hp/dmg: seviye 1 değerleri; oyuncunun aşama seviyesiyle ölçeklenir.
   ============================================================ */
window.EV = window.EV || {};

EV.MOBS = (function () {
  'use strict';

  const B = (kind, scale, body, accent, belly, eye, parts) =>
    ({ kind, scale, body, accent, belly, eye, parts });

  const ENEMIES = [
    /* ---------------- HÜCRE ---------------- */
    [
      { id: 'alga', name: 'Yeşil Alg', tier: 1, hp: 22, dmg: 4, speed: 3.0, evo: 11, aggro: 7,
        behavior: 'passive', pack: [3, 6], atk: { range: 1.2, windup: 0.5, cd: 1.6 },
        body: B('cell', 0.5, 0x8fd46a, 0x5a9e3c, 0xd2f0b4, 0x2f5c1e, { flagella: 1, cilia: true, mouth: 0x5a9e3c }) },
      { id: 'amoeba', name: 'Amip', tier: 2, hp: 62, dmg: 8, speed: 3.6, evo: 18, aggro: 11,
        behavior: 'neutral', pack: [1, 3], atk: { range: 1.4, windup: 0.55, cd: 1.5 },
        body: B('cell', 0.9, 0xe0c98a, 0xa8894a, 0xf2e6c0, 0x6b4a2c, { flagella: 0, cilia: true, mouth: 0xa8894a }) },
      { id: 'flagel', name: 'Kamçılı Hücre', tier: 2, hp: 34, dmg: 7, speed: 7.4, evo: 16, aggro: 14,
        behavior: 'aggressive', pack: [2, 4], atk: { range: 1.2, windup: 0.4, cd: 1.3 },
        body: B('cell', 0.62, 0x7ab8e0, 0x3d7fb0, 0xc3e4f5, 0xffd83d, { flagella: 3, mouth: 0x3d7fb0 }) },
      { id: 'diatom', name: 'Diyatom', tier: 3, hp: 48, dmg: 10, speed: 4.4, evo: 22, aggro: 15,
        behavior: 'neutral', pack: [2, 3], atk: { range: 1.3, windup: 0.5, cd: 1.5 },
        ability: { kind: 'spikes', cd: 5, r: 3.4, windup: 0.9, mult: 1.3 },
        body: B('cell', 0.66, 0xd8f0ff, 0x6fa8c8, 0xf0fbff, 0xff5a3d, { flagella: 1, spikes: true, mouth: 0x6fa8c8 }) },
      { id: 'toxin', name: 'Zehirli Hücre', tier: 4, hp: 82, dmg: 9, speed: 5.6, evo: 28, aggro: 18,
        behavior: 'aggressive', pack: [1, 2], atk: { range: 1.4, windup: 0.5, cd: 1.5 },
        ability: { kind: 'spit', cd: 4.5, range: 16, speed: 18, mult: 0.9, st: [['poison', 2]] },
        body: B('cell', 0.78, 0xc287e0, 0x7b3fa8, 0xe8cdf5, 0x9cff6a, { flagella: 2, cilia: true, spikes: true, mouth: 0x9cff6a }) },
      { id: 'whip', name: 'Kırbaç Hücre', tier: 5, hp: 54, dmg: 12, speed: 7.6, evo: 30, aggro: 20,
        behavior: 'aggressive', pack: [2, 3], atk: { range: 1.3, windup: 0.4, cd: 1.2 },
        ability: { kind: 'charge', cd: 6, len: 11, w: 2.4, windup: 0.9, mult: 1.4 },
        body: B('cell', 0.56, 0xff9f5a, 0xc25a22, 0xffd9b0, 0x2f2f2f, { flagella: 4, mouth: 0xc25a22 }) },
      { id: 'sporer', name: 'Spor Atan', tier: 2, hp: 40, dmg: 7, speed: 4.6, evo: 20, aggro: 20,
        behavior: 'ranged', range: 12, pack: [2, 3], atk: { range: 1.2, windup: 0.5, cd: 1.6 },
        ability: { kind: 'spit', cd: 2.4, range: 18, speed: 16, mult: 1.0, st: [['poison', 1]] },
        body: B('cell', 0.6, 0x9ad0a0, 0x4f8a5a, 0xdaf5de, 0xffe14d, { flagella: 1, cilia: true, mouth: 0x4f8a5a }) },
      { id: 'glowcell', name: 'Işıklı Hücre', tier: 4, hp: 56, dmg: 9, speed: 5.4, evo: 30, aggro: 22,
        behavior: 'ranged', range: 14, pack: [1, 2], atk: { range: 1.2, windup: 0.45, cd: 1.5 },
        ability: { kind: 'volley', cd: 3.6, range: 20, speed: 22, count: 3, spread: 0.35, mult: 0.8, st: [['shock', 1]] },
        body: B('cell', 0.64, 0xa8e8ff, 0x3f9fd0, 0xe8faff, 0x6fe8ff, { flagella: 2, spikes: true, mouth: 0x3f9fd0 }) },
    ],

    /* ---------------- SÜRÜNGEN ---------------- */
    [
      { id: 'bug', name: 'Dev Böcek', tier: 1, hp: 70, dmg: 14, speed: 5.6, evo: 28, aggro: 12,
        behavior: 'aggressive', pack: [3, 5], atk: { range: 1.4, windup: 0.45, cd: 1.4 },
        body: B('land', 0.45, 0x6b4f2a, 0x44311a, 0x8a7040, 0xff6b3d, { legs: 6, tail: 'none', spikes: true }) },
      { id: 'lizard', name: 'Kertenkele', tier: 2, hp: 120, dmg: 18, speed: 7.2, evo: 36, aggro: 14,
        behavior: 'neutral', pack: [2, 3], atk: { range: 1.6, windup: 0.45, cd: 1.4 },
        body: B('land', 0.62, 0x4a7a6a, 0x2f5246, 0xa8bda0, 0xffd83d, { legs: 4, tail: 'long' }) },
      { id: 'shell', name: 'Zırhlı Kaplumbağa', tier: 2, hp: 300, dmg: 22, speed: 3.6, evo: 55, aggro: 10, armor: 0.3,
        behavior: 'passive', pack: [1, 2], atk: { range: 1.6, windup: 0.7, cd: 2 },
        body: B('land', 0.7, 0x4f5a3a, 0x2e3620, 0xa8a070, 0xffb84d, { legs: 4, tail: 'short', spikes: true }) },
      { id: 'serpent', name: 'Kum Yılanı', tier: 3, hp: 110, dmg: 24, speed: 8.8, evo: 45, aggro: 19,
        behavior: 'aggressive', pack: [1, 2], atk: { range: 1.6, windup: 0.4, cd: 1.3 },
        ability: { kind: 'pounce', cd: 5, len: 8, w: 2.2, windup: 0.75, mult: 1.3 },
        body: B('land', 0.58, 0xc2a04a, 0x8a6a22, 0xe8d9a0, 0x4de0a0, { legs: 4, tail: 'long', fangs: true }) },
      { id: 'raptor', name: 'Raptor Yavrusu', tier: 4, hp: 170, dmg: 26, speed: 8.6, evo: 60, aggro: 21,
        behavior: 'aggressive', pack: [2, 4], atk: { range: 1.8, windup: 0.4, cd: 1.3 },
        ability: { kind: 'pounce', cd: 6, len: 9, w: 2.4, windup: 0.8, mult: 1.4 },
        body: B('land', 0.8, 0x7d5a33, 0x4e371e, 0xc4a875, 0xff3d3d, { legs: 2, tail: 'long', spikes: true, fangs: true }) },
      { id: 'hornlizard', name: 'Boynuzlu Kertenkele', tier: 5, hp: 260, dmg: 32, speed: 6.6, evo: 75, aggro: 20,
        behavior: 'neutral', pack: [1, 2], atk: { range: 1.8, windup: 0.5, cd: 1.5 },
        ability: { kind: 'charge', cd: 7, len: 13, w: 2.8, windup: 0.95, mult: 1.6 },
        body: B('land', 0.88, 0x8a4a3a, 0x5a2a20, 0xd0a080, 0xffd83d, { legs: 4, tail: 'short', spikes: true, horns: true, fangs: true }) },
      { id: 'spitter', name: 'Tükürgen Kertenkele', tier: 2, hp: 95, dmg: 16, speed: 6.4, evo: 40, aggro: 22,
        behavior: 'ranged', range: 13, pack: [2, 3], atk: { range: 1.6, windup: 0.45, cd: 1.4 },
        ability: { kind: 'spit', cd: 2.4, range: 20, speed: 20, mult: 1.0, st: [['poison', 2]] },
        body: B('land', 0.6, 0x7a9a3a, 0x4a6a1e, 0xd0d890, 0xff5a3d, { legs: 4, tail: 'long', fangs: true }) },
      { id: 'quillback', name: 'Dikenli Sırtlı', tier: 4, hp: 150, dmg: 20, speed: 5.6, evo: 62, aggro: 24,
        behavior: 'ranged', range: 15, pack: [1, 2], atk: { range: 1.8, windup: 0.5, cd: 1.5 },
        ability: { kind: 'volley', cd: 3.4, range: 22, speed: 26, count: 4, spread: 0.45, mult: 0.75, st: [['bleed', 1]] },
        body: B('land', 0.75, 0x8a6a4a, 0x5a3a20, 0xd8c0a0, 0xffd83d, { legs: 4, tail: 'short', spikes: true }) },
    ],

    /* ---------------- MEMELİ ---------------- */
    [
      { id: 'rodent', name: 'Kemirgen', tier: 1, hp: 110, dmg: 24, speed: 8, evo: 60, aggro: 13,
        behavior: 'passive', pack: [3, 6], atk: { range: 1.4, windup: 0.45, cd: 1.4 },
        body: B('land', 0.5, 0x7a6a52, 0x50442f, 0xc8b894, 0xff8c4d, { legs: 4, tail: 'long', fur: true, ears: true }) },
      { id: 'fox', name: 'Bozkır Tilkisi', tier: 2, hp: 180, dmg: 40, speed: 10.0, evo: 80, aggro: 17,
        behavior: 'aggressive', pack: [2, 3], atk: { range: 1.6, windup: 0.4, cd: 1.2 },
        body: B('land', 0.55, 0xd4762e, 0x9a4a18, 0xf2e0c0, 0x2f2f2f, { legs: 4, tail: 'bushy', fur: true, ears: true, fangs: true }) },
      { id: 'boar', name: 'Yaban Domuzu', tier: 3, hp: 360, dmg: 48, speed: 7.6, evo: 110, aggro: 18,
        behavior: 'neutral', pack: [2, 4], atk: { range: 1.8, windup: 0.5, cd: 1.5 },
        ability: { kind: 'charge', cd: 6, len: 12, w: 2.8, windup: 0.9, mult: 1.5 },
        body: B('land', 0.85, 0x4a3c30, 0x2e241b, 0x8a7256, 0xff5a3d, { legs: 4, tail: 'short', fur: true, ears: true, horns: true, fangs: true }) },
      { id: 'deer', name: 'Boynuzlu Geyik', tier: 3, hp: 420, dmg: 44, speed: 9.4, evo: 120, aggro: 15,
        behavior: 'passive', pack: [2, 4], atk: { range: 1.9, windup: 0.55, cd: 1.6 },
        body: B('land', 0.95, 0x9a7a52, 0x6a5030, 0xe0cca8, 0x2f2f2f, { legs: 4, tail: 'short', fur: true, ears: true, horns: true }) },
      { id: 'cub', name: 'Mağara Ayısı', tier: 4, hp: 720, dmg: 60, speed: 6.6, evo: 150, aggro: 19,
        behavior: 'neutral', pack: [1, 2], atk: { range: 2.0, windup: 0.6, cd: 1.7 },
        ability: { kind: 'spikes', cd: 6, r: 4.2, windup: 1.0, mult: 1.5 },
        body: B('land', 1.15, 0x4a3226, 0x281a12, 0x8a6a4a, 0xff8c4d, { legs: 4, tail: 'short', fur: true, ears: true, fangs: true }) },
      { id: 'saber', name: 'Kılıç Dişli', tier: 5, hp: 520, dmg: 64, speed: 9.6, evo: 170, aggro: 24,
        behavior: 'aggressive', pack: [1, 3], atk: { range: 1.9, windup: 0.4, cd: 1.3 },
        ability: { kind: 'pounce', cd: 5.5, len: 10, w: 2.6, windup: 0.8, mult: 1.5 },
        body: B('land', 1.0, 0xb08248, 0x6d4c24, 0xe6d3aa, 0x4de0a0, { legs: 4, tail: 'bushy', fur: true, ears: true, fangs: true }) },
      { id: 'porcupine', name: 'Oklu Kirpi', tier: 2, hp: 200, dmg: 32, speed: 7, evo: 85, aggro: 22,
        behavior: 'ranged', range: 14, pack: [1, 3], atk: { range: 1.6, windup: 0.45, cd: 1.4 },
        ability: { kind: 'volley', cd: 3.2, range: 22, speed: 26, count: 4, spread: 0.6, mult: 0.6, st: [['bleed', 1]] },
        body: B('land', 0.6, 0x6a5a4a, 0x3a2a1a, 0xc8b8a0, 0xff8c4d, { legs: 4, tail: 'short', fur: true, spikes: true, ears: true }) },
      { id: 'howler', name: 'Uluyan Çakal', tier: 4, hp: 320, dmg: 44, speed: 8.4, evo: 130, aggro: 24,
        behavior: 'ranged', range: 11, pack: [2, 3], atk: { range: 1.8, windup: 0.4, cd: 1.3 },
        ability: { kind: 'spit', cd: 3.0, range: 18, speed: 24, mult: 1.1, st: [['slow', 1]], color: 0xd0a0ff },
        body: B('land', 0.72, 0xb09060, 0x705030, 0xe8d8b8, 0xc27bff, { legs: 4, tail: 'bushy', fur: true, ears: true, fangs: true }) },
    ],
  ];

  /* ---------------------------------------------------------
     ALFALAR — kit kimliği boss.js'deki yetenek setini seçer.
     hp/dmg sabittir (oyuncunun ~13. seviyesine göre ayarlı),
     sadece zorluk ve nesil ile ölçeklenir.
     --------------------------------------------------------- */
  const ALPHAS = [
    { id: 'devourer', kit: 'devourer', name: 'Alfa Yırtıcı Hücre', tier: 9, hp: 6000, dmg: 30, speed: 6.8, evo: 0, xp: 400,
      body: B('cell', 2.3, 0xe06a6a, 0x8f2f3f, 0xf7bdbd, 0xffe14d, { flagella: 4, cilia: true, spikes: true, mouth: 0xffe14d }) },
    { id: 'varanus', kit: 'varanus', name: 'Alfa Varanus', tier: 9, hp: 15000, dmg: 60, speed: 7.4, evo: 0, xp: 900,
      body: B('land', 2.1, 0x2f4438, 0x18261f, 0x7d8a5a, 0xff2d2d, { legs: 4, tail: 'long', spikes: true, horns: true, fangs: true }) },
    { id: 'saberking', kit: 'saberking', name: 'Alfa Kılıçdiş', tier: 9, hp: 40000, dmg: 110, speed: 9.2, evo: 0, xp: 2000,
      body: B('land', 2.4, 0xd9a24e, 0x7a5228, 0xf2e2bb, 0xff2d2d, { legs: 4, tail: 'bushy', spikes: true, fur: true, ears: true, horns: true, fangs: true }) },
  ];

  /* ---------------------------------------------------------
     APEX — kaçman gereken avcılar. Hızları oyuncunun taban
     hızının altında (kaçış hep mümkün), hamleleri uyarılı.
     --------------------------------------------------------- */
  /* hunt: bu kadar saniye kovaladıktan sonra vazgeçer (kapalı arenada
     sınırsız kovalama = kurtuluşu olmayan kovalama; eskiden öyleydi).
     first: aşama başından ilk gelişine kadar; respawn: gittikten sonra. */
  const APEX = [
    { id: 'leviacell', kit: 'apexCell', name: 'Yutucu', tier: 8, hp: 9000, dmg: 40, speed: 6.9, evo: 1400, leash: 55,
      hunt: 40, first: [110, 160], respawn: [180, 240],
      body: B('cell', 3.6, 0x40243c, 0x1d1020, 0x7d4a6e, 0xff2d2d, { flagella: 4, cilia: true, spikes: true, mouth: 0xff2d2d }) },
    { id: 'terrorbird', kit: 'apexBird', name: 'Dehşet Kuşu', tier: 8, hp: 24000, dmg: 80, speed: 7.6, evo: 3200, leash: 55,
      hunt: 40, first: [120, 170], respawn: [180, 240],
      body: B('land', 2.8, 0x2b2b33, 0x14141a, 0x6a5a45, 0xff9c2d, { legs: 2, tail: 'short', spikes: true, horns: true, fangs: true }) },
    { id: 'direbear', kit: 'apexBear', name: 'Korku Ayısı', tier: 8, hp: 55000, dmg: 150, speed: 8.8, evo: 7000, leash: 58,
      hunt: 40, first: [120, 170], respawn: [180, 240],
      body: B('land', 3.2, 0x3b2a20, 0x1a120c, 0x8a6b4a, 0xff2d2d, { legs: 4, tail: 'short', spikes: true, fur: true, ears: true, horns: true, fangs: true }) },
  ];

  /* ---------------------------------------------------------
     ARA BOSSLAR — EVO %45'te bir kez gelir. 2 yetenek, uyarılı saldırılar.
     Yenince garanti Değerli+ eşya, bol Gen Özü ve büyük XP.
     hp/dmg seviye 1 değerleri; normal yaratıklar gibi seviyeyle ölçeklenir.
     --------------------------------------------------------- */
  const MINIS = [
    { id: 'bigamoeba', kit: 'miniCell', name: 'Dev Amip', tier: 6, hp: 1500, dmg: 18, speed: 4.8, evo: 0, xp: 0,
      body: B('cell', 1.7, 0xd8b86a, 0x9a7a3a, 0xf2e6c0, 0xff5a3d, { flagella: 0, cilia: true, spikes: true, mouth: 0x9a7a3a }) },
    { id: 'hornlead', kit: 'miniReptile', name: 'Boynuzlu Lider', tier: 6, hp: 4200, dmg: 38, speed: 6.4, evo: 0, xp: 0,
      body: B('land', 1.5, 0x7a3a2a, 0x4a1a12, 0xd0a080, 0xffd83d, { legs: 4, tail: 'long', spikes: true, horns: true, fangs: true }) },
    { id: 'oldboar', kit: 'miniMammal', name: 'Yaşlı Yaban Domuzu', tier: 6, hp: 9500, dmg: 70, speed: 7.2, evo: 0, xp: 0,
      body: B('land', 1.6, 0x3a2e24, 0x1e1712, 0x7a6450, 0xff3d2d, { legs: 4, tail: 'short', fur: true, ears: true, horns: true, fangs: true }) },
  ];

  // güce göre sıralı: doğum mantığı listenin başından başlayıp sonunu açar
  ENEMIES.forEach((pool) => pool.sort((a, b) => a.tier - b.tier));

  return { ENEMIES, ALPHAS, APEX, MINIS };
})();
