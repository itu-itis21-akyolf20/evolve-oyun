/* ============================================================
   config.js — çağlar, zorluk, durum etkileri, reaksiyonlar, genel ayarlar
   Yetenek / gen / yaratık içerikleri js/data/ altındadır.
   ============================================================ */
window.EV = window.EV || {};

EV.CFG = (function () {
  'use strict';

  /* ---------------------------------------------------------
     ÇAĞLAR
     evoMax  : Alfa'nın uyanması için gereken EVO (≈ 10-15 dk hedefi)
     xpBase  : seviye 1->2 için gereken XP; sonrası TUNE.xpGrowth ile büyür
     base    : aşamanın taban oyuncu değerleri (kartlar bunun üstüne biner)
     --------------------------------------------------------- */
  const STAGES = [
    {
      id: 'cell', kind: 'cell', name: 'Hücre', title: 'Tek Hücreli',
      evoMax: 7800, xpBase: 120,
      terrainScale: 0.32, hover: 2.4, fog: [24, 100],
      cam: { dist: 9.5, height: 2.6, pitch: 0.42 },
      palette: {
        low: 0x14414f, mid: 0x1d5c6e, high: 0x2a7a8c,
        rock: 0x2c5b66, rockDark: 0x1c3f49,
        water: 0x39b0a8, crystal: 0x6fe0c4,
        sky: 0x0e2e3c, fog: 0x123c4c, sun: 0xaee6ff,
      },
      body: {
        kind: 'cell', scale: 1.0,
        body: 0x6fd8c0, accent: 0x2f9e86, belly: 0xbdf2e6, eye: 0xff5a7a,
        parts: { flagella: 2, cilia: true, spikes: false, mouth: 0xff7aa2 },
      },
      base: { hp: 130, dmg: 10, speed: 8.6, energy: 100, regen: 15 },
      basic: { name: 'Yutma', icon: '🦠', range: 2.6 },
      intro: 'Sıcak bir gölette tek bir hücresin. Etrafındaki her şey ya yem ya avcı.',
    },
    {
      id: 'reptile', kind: 'land', name: 'Sürüngen', title: 'Yavru Sürüngen',
      evoMax: 18000, xpBase: 280,
      terrainScale: 1, hover: 0, fog: [70, 190],
      cam: { dist: 10.5, height: 2.4, pitch: 0.3 },
      palette: {
        low: 0xb99c50, mid: 0xd4bc72, high: 0xe6d69b,
        rock: 0xb4bac6, rockDark: 0x878e9b,
        water: 0x27807d, crystal: 0x8fc9dd,
        sky: 0xe4d29a, fog: 0xe4d29a, sun: 0xfff2cc,
      },
      body: {
        kind: 'land', scale: 1.15,
        body: 0x5f7d4c, accent: 0x405732, belly: 0xc2b982, eye: 0xffd83d,
        parts: { legs: 4, tail: 'long', spikes: false, fur: false, ears: false, horns: false, fangs: false },
      },
      base: { hp: 300, dmg: 22, speed: 9.6, energy: 110, regen: 16 },
      basic: { name: 'Isırık', icon: '🦷', range: 3.0 },
      intro: 'Su çekildi, sen kaldın. Bacakların var, güneş seni ısıtıyor.',
    },
    {
      id: 'mammal', kind: 'land', name: 'Memeli', title: 'Kürklü Avcı',
      evoMax: 39000, xpBase: 610,
      terrainScale: 1, hover: 0, fog: [70, 190],
      cam: { dist: 11.5, height: 2.6, pitch: 0.3 },
      palette: {
        low: 0x3f6630, mid: 0x5b8a3f, high: 0x7aa855,
        rock: 0x8d9398, rockDark: 0x686e74,
        water: 0x286f95, crystal: 0xc2d894,
        sky: 0xa9d2e6, fog: 0xb6dbe9, sun: 0xfff6e2,
      },
      body: {
        kind: 'land', scale: 1.4,
        body: 0x8d5c33, accent: 0x5e3a1e, belly: 0xdcc59c, eye: 0x4de0a0,
        parts: { legs: 4, tail: 'bushy', spikes: false, fur: true, ears: true, horns: false, fangs: true },
      },
      base: { hp: 560, dmg: 40, speed: 10.8, energy: 120, regen: 17 },
      basic: { name: 'Pençe', icon: '🐾', range: 3.4 },
      intro: 'Kürk tuttu, kan ısındı. Artık sürünün başısın.',
    },
  ];

  /* Sonsuz mod: memeli bedeniyle nesiller. Her nesil yeni gen + yeni tur. */
  const ENDLESS = {
    name: 'Kadim Memeli',
    evoMax: 45000,
    evoGrowth: 1.2,
    enemyGrowth: 1.22,
    playerGrowth: 1.2,
  };

  /* ---------------------------------------------------------
     ZORLUK
     --------------------------------------------------------- */
  const DIFFICULTY = {
    normal: {
      id: 'normal', name: 'Normal', icon: '🌿',
      desc: 'Canavarlar daha yumuşak, uyarılar uzun, avcılar seyrek. Ölünce EVO\'nun %10\'u gider.',
      hp: 0.85, dmg: 0.8, speed: 1, windup: 1.12, spawn: 1, apexTimer: 1.3,
      energyRegen: 1, rerolls: 3, deathEvoLoss: 0.1, deathCardLoss: false, bossHeal: 0.15,
    },
    dehset: {
      id: 'dehset', name: 'Dehşet', icon: '☠️',
      desc: 'Canavarlar %45 daha dayanıklı, %30 daha sert vurur, uyarılar kısa. ' +
            'Ölünce EVO\'nun yarısı ve son seçtiğin kart gider.',
      hp: 1.45, dmg: 1.3, speed: 1.0, windup: 0.78, spawn: 1.15, apexTimer: 0.65,
      energyRegen: 0.9, rerolls: 1, deathEvoLoss: 0.5, deathCardLoss: true, bossHeal: 0.15,
    },
  };

  /* ---------------------------------------------------------
     DURUM ETKİLERİ
     type 'stack': sayı = yük (poison/bleed/burn/shock/slow/vuln)
     type 'timed': sayı = saniye (stun/fear)
     dot: saniyede (pow × dot × yük) hasar
     --------------------------------------------------------- */
  const STATUS = {
    poison: { name: 'Zehir',       icon: '☣', color: '#8ce04a', type: 'stack', max: 10, dur: 5,   dot: 0.07 },
    bleed:  { name: 'Kanama',      icon: '🩸', color: '#e0364a', type: 'stack', max: 5,  dur: 4,   dot: 0.14, movingMul: 1.7 },
    burn:   { name: 'Yanık',       icon: '🔥', color: '#ff8a2a', type: 'stack', max: 5,  dur: 3.5, dot: 0.16 },
    shock:  { name: 'Şok',         icon: '⚡', color: '#6fc8ff', type: 'stack', max: 3,  dur: 4,   burst: 0.9, stun: 0.6 },
    slow:   { name: 'Yavaşlama',   icon: '🐌', color: '#9aa7ff', type: 'stack', max: 4,  dur: 3,   per: 0.15 },
    vuln:   { name: 'Kırılganlık', icon: '💔', color: '#ffd23d', type: 'stack', max: 3,  dur: 4,   per: 0.15 },
    stun:   { name: 'Sersem',      icon: '💫', color: '#ffffff', type: 'timed', bossMul: 0.35 },
    fear:   { name: 'Korku',       icon: '😱', color: '#c27bff', type: 'timed', bossMul: 0.25 },
  };

  /* ---------------------------------------------------------
     REAKSİYONLAR — iki durum aynı hedefte buluşunca.
     Farklı aşamalardan gelen genler/yetenekler burada birleşir:
     hücrede aldığın Zehir geni + memelideki Kanama = Sepsis.
     --------------------------------------------------------- */
  const REACTIONS = [
    { id: 'neuro',    name: 'NÖROTOKSİN',   a: 'poison', b: 'shock', color: '#b6ff5a', desc: 'Zehri patlatır, hedefi sersemletir.' },
    { id: 'smoke',    name: 'ZEHİRLİ DUMAN', a: 'poison', b: 'burn',  color: '#9acd32', desc: 'Hedefin çevresinde zehir bulutu çıkar.' },
    { id: 'sepsis',   name: 'SEPSİS',        a: 'poison', b: 'bleed', color: '#c0304a', desc: 'Tüm süreli hasarlar 4 sn boyunca ×1.8.' },
    { id: 'shred',    name: 'PARÇALANMA',    a: 'bleed',  b: 'vuln',  color: '#ff5a5a', desc: 'Kanamayı tek seferde büyük hasara çevirir.' },
    { id: 'sear',     name: 'DAĞLAMA',       a: 'burn',   b: 'bleed', color: '#ffae5a', desc: 'Patlama hasarı verir ve seni iyileştirir.' },
    { id: 'overload', name: 'AŞIRI YÜK',     a: 'shock',  b: 'burn',  color: '#7fd0ff', desc: 'Çevredeki düşmanlara yıldırım patlaması.' },
    { id: 'paralyze', name: 'FELÇ',          a: 'slow',   b: 'shock', color: '#a0b4ff', desc: '2 sn sersemletir.' },
    { id: 'execute',  name: 'İNFAZ',         a: 'vuln',   b: 'stun',  color: '#ffe14d', desc: 'Canı %22 altındaysa öldürür (boss: ağır hasar).' },
    { id: 'terror',   name: 'DEHŞET',        a: 'fear',   b: 'bleed', color: '#d07bff', desc: 'Kanamayı en üst yüke çıkarır.' },
  ];

  /* ---------------------------------------------------------
     ETİKETLER — yeteneklerin elementi; genleri ve vücut parçalarını belirler.
     --------------------------------------------------------- */
  const TAGS = {
    zehir:    { name: 'Zehir',    color: '#8ce04a' },
    elektrik: { name: 'Elektrik', color: '#6fc8ff' },
    asit:     { name: 'Asit',     color: '#e6e04a' },
    fiziksel: { name: 'Fiziksel', color: '#d0d0d0' },
    yapiskan: { name: 'Yapışkan', color: '#b9a7ff' },
    bolunme:  { name: 'Bölünme',  color: '#7fe3c0' },
    zar:      { name: 'Zar',      color: '#7fd0c0' },
    kemik:    { name: 'Kemik',    color: '#e8dcc0' },
    gunes:    { name: 'Güneş',    color: '#ff9a3d' },
    kum:      { name: 'Kum',      color: '#d9b26a' },
    pul:      { name: 'Pul',      color: '#6fae8a' },
    avci:     { name: 'Avcı',     color: '#ff6b6b' },
    pence:    { name: 'Pençe',    color: '#c9a27a' },
    kan:      { name: 'Kan',      color: '#e0364a' },
    uluma:    { name: 'Uluma',    color: '#c27bff' },
    suru:     { name: 'Sürü',     color: '#9de89d' },
    ay:       { name: 'Ay',       color: '#cfd8ff' },
    vahsi:    { name: 'Vahşi',    color: '#ff7a2a' },
  };

  /* ---------------------------------------------------------
     GENEL AYARLAR
     --------------------------------------------------------- */
  const TUNE = {
    worldSize: 720,
    playRadius: 245,       // oynanabilir alan (kenardaki çanak yamacına girilmez; yamaç %72'de başlar)
    spawnMin: 20,          // doğum halkası oyuncuya yakın: harita boş görünmesin
    spawnMax: 52,
    despawn: 80,
    nearRadius: 60,        // "etrafımda kaç düşman var" sayımı bu yarıçapta yapılır
    maxEnemies: 38,
    maxFood: 34,
    foodEvo: 3, foodXp: 3, foodEnergy: 6,
    xpGrowth: 1.18,
    hpPerLevel: 0.08,      // aşama seviyesi başına maks. can
    dmgPerLevel: 0.06,     // aşama seviyesi başına hasar
    enemyHpLvl: 1.05,      // oyuncu seviyesi başına düşman canı (16. seviyede tavan)
    enemyDmgLvl: 1.03,
    invuln: 0.22,          // her darbeden sonra kısa dokunulmazlık
    dashDist: 7.5, dashSpeed: 32, dashCost: 22, dashCd: 0.8,
    rageMax: 100, rageDecayDelay: 6, rageDecay: 4,
    maxActives: 3, maxPassives: 5,
    fov: 60, shoulder: 1.1,
  };

  /* ---------------------------------------------------------
     EŞYA NADİRLİĞİ — renk = nadirlik
     drop: normal düşüşte ağırlık · craft: Gen Özü ile basmada ağırlık
     --------------------------------------------------------- */
  const RARITY = [
    { id: 0, name: 'Sıradan',  color: '#d8d8d8', affixes: 1, mul: 1.0, drop: 62,  craft: 34 },
    { id: 1, name: 'Nadir',    color: '#5fdc5f', affixes: 2, mul: 1.25, drop: 26, craft: 36 },
    { id: 2, name: 'Değerli',  color: '#4fa8ff', affixes: 3, mul: 1.5, drop: 9,   craft: 20 },
    { id: 3, name: 'Destansı', color: '#c26bff', affixes: 3, mul: 1.85, drop: 2.6, craft: 8 },
    { id: 4, name: 'Efsanevi', color: '#ff9a2a', affixes: 4, mul: 2.2, drop: 1.0, craft: 2 },
  ];

  const ITEMS = {
    bagSize: 24,
    chestSize: 48,
    dropChance: 0.015,         // sıradan yaratık başına, tier ile çarpılır
    craftCost: 400,            // Gen Özü — bir aşamada ~2-4 üretim (test: 3-4 öz/av)
    upgradeCost: [300, 550, 900, 1500],  // nadirliği bir kademe yükseltme
    salvage: [15, 35, 80, 180, 400],

    /* BASMA (+0 … +9) — nadirlikten ayrı. Dizinin i. elemanı: +i'den +(i+1)'e */
    plusMax: 9,
    plusBonus: [0, 0.06, 0.12, 0.19, 0.27, 0.36, 0.46, 0.57, 0.70, 0.85],  // +N'de tüm değerlere birikimli bonus
    plusChance: [1, 1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4],               // +1 … +9'a çıkma ihtimali
    plusCost: [40, 70, 110, 160, 230, 320, 440, 600, 800],                // +1 … +9 taban öz bedeli
    plusRarityMul: [1, 1.2, 1.45, 1.75, 2.1],                             // nadirliğe göre bedel çarpanı
    plusIlvl: 0.15,            // eşya seviyesi başına bedel artışı
    plusDropFrom: 6,           // +6 ve üstündeyken başarısızlık bir kademe düşürür
    plusRefund: 0.25,          // parçalarken basmaya harcananın geri dönen payı
    setChance: 0.3,            // Değerli+ eşyanın bir takıma ait olma ihtimali

    /* Öldürme ödülleri. ess × (1 + nesil × genEss). drops: her düşüşün en düşük
       nadirliği (min) ve efsanevi olma ihtimali (leg). announce: büyük duyuru. */
    genEss: 0.3,
    champion: { essMul: 4, dropMul: 6, boost: 2 },
    kill: {
      apex:     { ess: 150, boost: 6,  announce: true, drops: [{ min: 3, leg: 0.3 }, { min: 2 }] },
      alpha:    { ess: 60,  boost: 12, drops: [{ min: 3 }] },
      nemesis:  { ess: 90,  boost: 6,  announce: true, drops: [{ min: 3, leg: 0.35 }] },
      mini:     { ess: 25,  boost: 4,  drops: [{ min: 2 }] },
      treasure: { ess: 80,  boost: 3,  announce: true, drops: [{ min: 1 }, { min: 1 }] },
    },
  };

  return { STAGES, ENDLESS, DIFFICULTY, STATUS, REACTIONS, TAGS, TUNE, RARITY, ITEMS };
})();
