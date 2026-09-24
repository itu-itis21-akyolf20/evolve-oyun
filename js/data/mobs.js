/* ============================================================
   data/mobs.js — yaratıklar, Alfalar, Apex avcılar

   behavior:
     passive     dolaşır, vurulunca/yaklaşılınca kaçar (kolay EVO)
     neutral     dolaşır, vurulunca sürüsüyle birlikte saldırır
     aggressive  menzile girince kovalar
     ranged      mesafe korur, uzaktan atar
     flyer       havada (fly = yükseklik) etrafında döner, uyarılı dalış (dive)
     bomber      koşar, yanına gelince fitil yakar ve patlar (kendisi ölür)
     healer      geride durur, çevresindeki yaralıları iyileştirir (heal)
     summoner    geride durur, yavru/böcek döker (summon)
     hopper      hedefin olduğu yere uyarılı sıçrar (hop)
     ambush      kamufle bekler, yaklaşınca ani saldırır
     buffer      sürüsünü azdırır: hız + hasar (buff)
     treasure    hazine: kaçar, 25 sn'de kaybolur, yakalanırsa bol ödül
   splitInto: ölünce bölündüğü tür (koloni) · spawn:false = kendiliğinden doğmaz
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
      { id: 'virus', name: 'Virüs', tier: 2, hp: 16, dmg: 13, speed: 8.4, evo: 14, aggro: 20,
        behavior: 'bomber', pack: [3, 5], atk: { range: 1.0, windup: 0.4, cd: 1.2 },
        fuse: { r: 3.0, windup: 0.85, mult: 1.8, st: [['poison', 2]] },
        body: B('cell', 0.42, 0xd04a6a, 0x7a1a3a, 0xf2a0b8, 0xfff05a, { form: 'virus' }) },
      { id: 'jelly', name: 'Denizanası', tier: 3, hp: 58, dmg: 10, speed: 4.6, evo: 26, aggro: 20,
        behavior: 'flyer', fly: 2.6, orbit: 7, pack: [1, 3], atk: { range: 1.4, windup: 0.5, cd: 1.6 },
        ability: { kind: 'dive', cd: 4.2, len: 10, w: 2.2, windup: 0.85, mult: 1.3, st: [['shock', 1]] },
        body: B('cell', 0.8, 0xe08ad8, 0x9a3fa8, 0xf5d0f0, 0x6fe8ff, { form: 'jelly' }) },
      { id: 'colony', name: 'Koloni', tier: 3, hp: 84, dmg: 9, speed: 4.0, evo: 20, aggro: 13,
        behavior: 'neutral', pack: [1, 2], atk: { range: 1.4, windup: 0.55, cd: 1.5 },
        splitInto: { id: 'colonyling', count: 3 },
        body: B('cell', 0.9, 0xc8d84a, 0x7a8a22, 0xeef5b0, 0x2f5c1e, { form: 'colony' }) },
      { id: 'colonyling', name: 'Koloni Hücresi', tier: 1, hp: 18, dmg: 5, speed: 6.4, evo: 6, aggro: 16, spawn: false,
        behavior: 'aggressive', pack: [1, 1], atk: { range: 1.1, windup: 0.4, cd: 1.3 },
        body: B('cell', 0.38, 0xc8d84a, 0x7a8a22, 0xeef5b0, 0x2f5c1e, { flagella: 1, mouth: 0x7a8a22 }) },
      { id: 'symbiote', name: 'Simbiyot', tier: 3, hp: 48, dmg: 6, speed: 5.0, evo: 26, aggro: 20,
        behavior: 'healer', range: 11, pack: [1, 1], atk: { range: 1.2, windup: 0.5, cd: 1.6 },
        heal: { cd: 4, frac: 0.14, r: 10 },
        body: B('cell', 0.6, 0x7affc0, 0x2fa878, 0xd8fff0, 0xffffff, { flagella: 2, cilia: true, mouth: 0x2fa878 }) },
      { id: 'spiro', name: 'Sarmal Bakteri', tier: 4, hp: 44, dmg: 12, speed: 9.6, evo: 28, aggro: 22,
        behavior: 'aggressive', pack: [2, 3], atk: { range: 1.2, windup: 0.35, cd: 1.1 },
        ability: { kind: 'charge', cd: 3.6, len: 9, w: 1.8, windup: 0.55, mult: 1.2 },
        body: B('cell', 0.7, 0xff7a4a, 0xa83a1a, 0xffd0b0, 0xfff05a, { form: 'spiral' }) },
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
        body: B('land', 0.62, 0xc2a04a, 0x8a6a22, 0xe8d9a0, 0x4de0a0, { legs: 0, tail: 'serpent', fangs: true }) },
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
      { id: 'ptero', name: 'Pterozor', tier: 3, hp: 105, dmg: 24, speed: 9.2, evo: 48, aggro: 24,
        behavior: 'flyer', fly: 4.4, orbit: 9, pack: [1, 3], atk: { range: 1.6, windup: 0.45, cd: 1.4 },
        ability: { kind: 'dive', cd: 4.4, len: 14, w: 2.4, windup: 0.9, mult: 1.5 },
        body: B('land', 0.62, 0xb0653a, 0x6a3218, 0xe8c09a, 0xffe14d, { legs: 2, tail: 'short', wings: true, wingSpan: 2.6, fangs: true }) },
      { id: 'frog', name: 'Zıplayan Kurbağa', tier: 2, hp: 78, dmg: 19, speed: 5.0, evo: 34, aggro: 18,
        behavior: 'hopper', pack: [2, 4], atk: { range: 1.5, windup: 0.45, cd: 1.4 },
        ability: { kind: 'hop', cd: 2.8, range: 12, r: 2.6, windup: 0.75, mult: 1.3, st: [['poison', 1]] },
        body: B('land', 0.5, 0x4ad83a, 0x1f8a1a, 0xf0ff9a, 0xff3d3d, { legs: 4, tail: 'none' }) },
      { id: 'croc', name: 'Timsah', tier: 4, hp: 380, dmg: 44, speed: 7.6, evo: 80, aggro: 9, armor: 0.2,
        behavior: 'ambush', pack: [1, 1], atk: { range: 2.0, windup: 0.5, cd: 1.5 },
        ability: { kind: 'charge', cd: 6, len: 10, w: 2.6, windup: 0.5, mult: 1.8 },
        body: Object.assign(B('land', 1.0, 0x3a5a2a, 0x223a18, 0x9aa870, 0xffd83d, { legs: 4, tail: 'long', fangs: true }), { extras: ['scutes'] }) },
      { id: 'shaman', name: 'Kertenkele Şaman', tier: 3, hp: 118, dmg: 14, speed: 6.0, evo: 52, aggro: 22,
        behavior: 'healer', range: 12, pack: [1, 1], atk: { range: 1.6, windup: 0.5, cd: 1.6 },
        heal: { cd: 4.5, frac: 0.12, r: 11 },
        body: Object.assign(B('land', 0.66, 0x3a8a8a, 0x1f5a5a, 0xb8e8d8, 0x9dffe0, { legs: 2, tail: 'long' }), { extras: ['crest', 'sunCrest'] }) },
      { id: 'brood', name: 'Kuluçka Anası', tier: 5, hp: 420, dmg: 26, speed: 4.2, evo: 90, aggro: 22,
        behavior: 'summoner', range: 11, pack: [1, 1], atk: { range: 1.8, windup: 0.6, cd: 1.7 },
        summon: { id: 'bug', count: 2, cd: 7, max: 6 },
        body: Object.assign(B('land', 1.0, 0x5a3a5a, 0x3a1a3a, 0xc8a0c0, 0x9cff6a, { legs: 6, tail: 'none', spikes: true }), { extras: ['sacs'] }) },
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
      { id: 'bat', name: 'Dev Yarasa', tier: 2, hp: 140, dmg: 32, speed: 11, evo: 70, aggro: 24,
        behavior: 'flyer', fly: 3.6, orbit: 6, pack: [3, 5], atk: { range: 1.5, windup: 0.4, cd: 1.3 },
        ability: { kind: 'dive', cd: 3.4, len: 11, w: 2.0, windup: 0.7, mult: 1.2, st: [['bleed', 1]] },
        body: B('land', 0.46, 0x3a2a4a, 0x1e1428, 0x8a6a9a, 0xff4d4d, { legs: 2, tail: 'none', wings: true, wingSpan: 2.3, ears: true, fangs: true }) },
      { id: 'eagle', name: 'Kaya Kartalı', tier: 4, hp: 380, dmg: 56, speed: 10.4, evo: 150, aggro: 28,
        behavior: 'flyer', fly: 6, orbit: 10, pack: [1, 1], atk: { range: 1.8, windup: 0.45, cd: 1.4 },
        ability: { kind: 'dive', cd: 5, len: 18, w: 2.6, windup: 1.0, mult: 1.8 },
        body: B('land', 0.8, 0x6a4a2a, 0x3a2410, 0xf2eee0, 0xffc02d, { legs: 2, tail: 'fan', wings: true, wingSpan: 3.2 }) },
      { id: 'skunk', name: 'Kokarca', tier: 2, hp: 200, dmg: 28, speed: 7.4, evo: 85, aggro: 14,
        behavior: 'neutral', pack: [1, 2], atk: { range: 1.6, windup: 0.45, cd: 1.4 },
        ability: { kind: 'gas', cd: 6, r: 4.2, dur: 5, windup: 0.6, mult: 0.3, st: [['poison', 2]] },
        body: Object.assign(B('land', 0.55, 0x1a1a1e, 0x0a0a0c, 0xf2f2f2, 0x9cff6a, { legs: 4, tail: 'bushy', fur: true, ears: true }), { extras: ['tuft'] }) },
      { id: 'whitedeer', name: 'Ak Geyik', tier: 3, hp: 360, dmg: 30, speed: 9.0, evo: 125, aggro: 22,
        behavior: 'healer', range: 12, pack: [1, 1], atk: { range: 1.9, windup: 0.5, cd: 1.6 },
        heal: { cd: 4, frac: 0.12, r: 12 },
        body: Object.assign(B('land', 0.95, 0xf2f2ee, 0xc8c8c0, 0xffffff, 0x6fe8ff, { legs: 4, tail: 'short', fur: true, ears: true, horns: true }), { extras: ['crest'] }) },
      { id: 'hyena', name: 'Sırtlan', tier: 3, hp: 290, dmg: 40, speed: 9.2, evo: 115, aggro: 22,
        behavior: 'buffer', pack: [2, 4], atk: { range: 1.7, windup: 0.4, cd: 1.3 },
        buff: { cd: 9, r: 12, dur: 5, dmg: 1.25, speed: 1.3 },
        body: B('land', 0.7, 0xb8a060, 0x5a4a2a, 0xe8d8a8, 0xffe14d, { legs: 4, tail: 'short', fur: true, ears: true, fangs: true }) },
      { id: 'mammoth', name: 'Mamut Yavrusu', tier: 5, hp: 1100, dmg: 70, speed: 6.0, evo: 210, aggro: 14, armor: 0.15,
        behavior: 'neutral', pack: [1, 1], atk: { range: 2.2, windup: 0.65, cd: 1.8 },
        ability: { kind: 'spikes', cd: 6, r: 5, windup: 1.0, mult: 1.6 },
        body: Object.assign(B('land', 1.35, 0x6a4a30, 0x3a2818, 0xa8845a, 0x2f2f2f, { legs: 4, tail: 'short', fur: true, ears: true }), { extras: ['tusks'] }) },
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
     ARA BOSSLAR — aşama başına 3: EVO %25 / %50 / %75'te birer tane
     (sıra her aşamada karışır). 2-3 yetenek, uyarılı saldırılar.
     Yenince garanti Değerli+ eşya, bol Gen Özü ve büyük XP.
     hp/dmg seviye 1 değerleri; normal yaratıklar gibi seviyeyle ölçeklenir.
     --------------------------------------------------------- */
  const MINIS = [
    [
      { id: 'bigamoeba', kit: 'miniCell', name: 'Dev Amip', tier: 6, hp: 1500, dmg: 18, speed: 4.8, evo: 0, xp: 0,
        body: B('cell', 1.7, 0xd8b86a, 0x9a7a3a, 0xf2e6c0, 0xff5a3d, { flagella: 0, cilia: true, spikes: true, mouth: 0x9a7a3a }) },
      { id: 'memqueen', kit: 'miniQueen', name: 'Zar Kraliçesi', tier: 6, hp: 1300, dmg: 16, speed: 4.2, evo: 0, xp: 0,
        body: B('cell', 1.6, 0xd04a8a, 0x7a1a4a, 0xf2b0d0, 0xfff05a, { flagella: 3, cilia: true, mouth: 0xfff05a }) },
      { id: 'eelcell', kit: 'miniEel', name: 'Elektrikli Kamçı', tier: 6, hp: 1200, dmg: 20, speed: 6.4, evo: 0, xp: 0,
        body: B('cell', 1.4, 0x4ac8ff, 0x1a6aa8, 0xc8f0ff, 0xffff5a, { form: 'spiral' }) },
    ],
    [
      { id: 'hornlead', kit: 'miniReptile', name: 'Boynuzlu Lider', tier: 6, hp: 4200, dmg: 38, speed: 6.4, evo: 0, xp: 0,
        body: B('land', 1.5, 0x7a3a2a, 0x4a1a12, 0xd0a080, 0xffd83d, { legs: 4, tail: 'long', spikes: true, horns: true, fangs: true }) },
      { id: 'skyhunter', kit: 'miniSky', name: 'Gök Avcısı', tier: 6, hp: 3400, dmg: 36, speed: 8.4, evo: 0, xp: 0, fly: 5,
        body: B('land', 1.2, 0x8a3a1a, 0x4a1a0a, 0xf0c090, 0xffe14d, { legs: 2, tail: 'short', wings: true, wingSpan: 3.2, fangs: true, horns: true }) },
      { id: 'broodqueen', kit: 'miniBrood', name: 'Kuluçka Kraliçesi', tier: 6, hp: 4600, dmg: 32, speed: 4.6, evo: 0, xp: 0,
        body: Object.assign(B('land', 1.55, 0x5a2a5a, 0x2a0a2a, 0xc8a0c0, 0x9cff6a, { legs: 6, tail: 'none', spikes: true }), { extras: ['sacs'] }) },
    ],
    [
      { id: 'oldboar', kit: 'miniMammal', name: 'Yaşlı Yaban Domuzu', tier: 6, hp: 9500, dmg: 70, speed: 7.2, evo: 0, xp: 0,
        body: B('land', 1.6, 0x3a2e24, 0x1e1712, 0x7a6450, 0xff3d2d, { legs: 4, tail: 'short', fur: true, ears: true, horns: true, fangs: true }) },
      { id: 'wolfleader', kit: 'miniWolf', name: 'Sürü Lideri', tier: 6, hp: 8200, dmg: 64, speed: 9.4, evo: 0, xp: 0,
        body: Object.assign(B('land', 1.3, 0x8a8a92, 0x4a4a52, 0xd8d8e0, 0x6fe8ff, { legs: 4, tail: 'bushy', fur: true, ears: true, fangs: true }), { extras: ['mane'] }) },
      { id: 'oldmammoth', kit: 'miniMammoth', name: 'Yaşlı Mamut', tier: 6, hp: 12000, dmg: 76, speed: 5.8, evo: 0, xp: 0,
        body: Object.assign(B('land', 1.9, 0x5a3a24, 0x2a1a0e, 0x9a7a54, 0xff5a3d, { legs: 4, tail: 'short', fur: true, ears: true }), { extras: ['tusks', 'mane'] }) },
    ],
  ];

  /* ---------------------------------------------------------
     HAZİNE — Diablo'daki "hazine goblini": kaçar, 25 sn'de kaybolur.
     Yakalanırsa bol Gen Özü + 2 eşya (items.js onKill: isTreasure).
     --------------------------------------------------------- */
  const TREASURE = [
    { id: 'goldcell', name: 'Altın Hücre', tier: 3, hp: 140, dmg: 0, speed: 8.2, evo: 300, aggro: 30, behavior: 'treasure',
      pack: [1, 1], atk: { range: 1, windup: 1, cd: 9 },
      body: B('cell', 0.7, 0xffd23d, 0xc89a1a, 0xfff2b0, 0xffffff, { flagella: 2, cilia: true, mouth: 0xc89a1a }) },
    { id: 'goldlizard', name: 'Altın Kertenkele', tier: 3, hp: 480, dmg: 0, speed: 8.8, evo: 700, aggro: 30, behavior: 'treasure',
      pack: [1, 1], atk: { range: 1, windup: 1, cd: 9 },
      body: B('land', 0.55, 0xffd23d, 0xc89a1a, 0xfff2b0, 0xffffff, { legs: 4, tail: 'long' }) },
    { id: 'goldhare', name: 'Altın Tavşan', tier: 3, hp: 1300, dmg: 0, speed: 9.8, evo: 1500, aggro: 30, behavior: 'treasure',
      pack: [1, 1], atk: { range: 1, windup: 1, cd: 9 },
      body: B('land', 0.5, 0xffd23d, 0xc89a1a, 0xfff2b0, 0xffffff, { legs: 4, tail: 'short', fur: true, ears: true }) },
  ];

  // güce göre sıralı: doğum mantığı listenin başından başlayıp sonunu açar
  ENEMIES.forEach((pool) => pool.sort((a, b) => a.tier - b.tier));

  /** Aşamadaki tür (bölünme / çağırma için); bulamazsa null. */
  function find(stage, id) {
    const pool = ENEMIES[stage] || [];
    return pool.find((d) => d.id === id) || null;
  }

  return { ENEMIES, ALPHAS, APEX, MINIS, TREASURE, find };
})();
