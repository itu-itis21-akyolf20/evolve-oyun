/* ============================================================
   data/fusions.js — FÜZYONLAR (Vampire Survivors "evrim"i gibi)

   Bir yetenek 5. rütbeye çıktığında ve gereken gen/pasif sende
   varsa, kart havuzuna füzyon kartı girer; alınca yetenek evrimleşir.

   Hücre füzyonları o aşamanın PASİFİNİ ister (öncesinde gen yok).
   Sürüngen ve Memeli füzyonları ÖNCEKİ AŞAMALARDAN taşınan GENİ ister:
   hücrede aldığın bir karar, memelide yeni bir yetenek doğurur.
   ============================================================ */
(function () {
  'use strict';

  EV.DATA.addFusions([
    /* ---------------- HÜCRE (pasif ister) ---------------- */
    {
      id: 'f_necro', stage: 0, slot: 'active', fusion: true, from: 'c_drop', needPassive: 'p_tox',
      name: 'Nekroz Yağmuru', icon: '💀', tags: ['zehir'], kind: 'bolt', cost: 16, cd: 1.0,
      flavor: 'Zehir Damlası + Toksin Yoğunluğu: yelpaze halinde patlayan ölüm damlaları.',
      base: { dmg: 1.7, speed: 34, count: 5, spread: 0.7, pierce: 1, range: 30, size: 0.45, explode: 2.5, st: [['poison', 4]] },
    },
    {
      id: 'f_synapse', stage: 0, slot: 'active', fusion: true, from: 'c_spark', needPassive: 'p_nerve',
      name: 'Sinaps Fırtınası', icon: '🌩️', tags: ['elektrik'], kind: 'chain', cost: 20, cd: 2.0,
      flavor: 'Elektrik Kıvılcımı + Sinir Ağı: sürünün tamamını dolaşan yıldırım.',
      base: { dmg: 3.2, range: 20, bounces: 8, bounceRange: 10, falloff: 0.92, st: [['shock', 2]] },
    },
    {
      id: 'f_digest', stage: 0, slot: 'active', fusion: true, from: 'c_acid', needPassive: 'p_vacu',
      name: 'Sindirim Havuzu', icon: '🫠', tags: ['asit'], kind: 'zone', cost: 26, cd: 6,
      flavor: 'Asit Bulutu + Açgözlü Vakuol: içine çeker, sindirdikçe seni iyileştirir.',
      base: { dmg: 0.8, r: 5.5, dur: 7, tick: 0.5, castRange: 22, pull: 4, heal: 0.3, st: [['vuln', 2]] },
    },
    {
      id: 'f_thornwall', stage: 0, slot: 'active', fusion: true, from: 'c_cilia', needPassive: 'p_wall',
      name: 'Dikenli Zar', icon: '🌵', tags: ['fiziksel', 'zar'], kind: 'nova', cost: 22, cd: 4.5,
      flavor: 'Kirpik Dönüşü + Zar Kalınlaşması: iter ve her yöne diken fırlatır.',
      base: { dmg: 4, r: 7.5, knock: 18, st: [['slow', 2]], shards: { count: 10, dmg: 1.4 } },
    },

    /* ---------------- SÜRÜNGEN (hücre geni ister) ---------------- */
    {
      id: 'f_bolt', stage: 1, slot: 'active', fusion: true, from: 'r_spear', needGene: 'g_shock',
      name: 'Yıldırım Mızrak', icon: '⚡', tags: ['kemik', 'elektrik'], kind: 'bolt', cost: 18, cd: 1.3,
      flavor: 'Kemik Mızrak + Elektrik Zarı geni: her isabette yıldırım sekmesi.',
      base: { dmg: 2.4, speed: 44, count: 3, spread: 0.2, pierce: 6, range: 34, size: 0.4, chainOnHit: 2, st: [['bleed', 2], ['shock', 1]] },
    },
    {
      id: 'f_venomfire', stage: 1, slot: 'active', fusion: true, from: 'r_breath', needGene: 'g_venom',
      name: 'Zehirli Alev', icon: '🔥', tags: ['gunes', 'zehir'], kind: 'cone', cost: 20, cd: 2.8,
      flavor: 'Güneş Nefesi + Zehir Kesesi geni: yanık ve zehir birlikte = Zehirli Duman.',
      base: { dmg: 1.9, range: 11, angle: 1.3, knock: 3, st: [['burn', 3], ['poison', 3]] },
    },
    {
      id: 'f_acidbog', stage: 1, slot: 'active', fusion: true, from: 'r_trap', needGene: 'g_acid',
      name: 'Asit Bataklığı', icon: '🟡', tags: ['kum', 'asit'], kind: 'zone', cost: 24, cd: 6.5,
      flavor: 'Kum Tuzağı + Asit Salgısı geni: yutan, eriten dev bataklık.',
      base: { dmg: 0.9, r: 6.5, dur: 8, tick: 0.5, castRange: 22, pull: 2, st: [['slow', 3], ['vuln', 3]] },
    },
    {
      id: 'f_whipstorm', stage: 1, slot: 'active', fusion: true, from: 'r_tail', needGene: 'g_whip',
      name: 'Kamçı Kasırgası', icon: '🌀', tags: ['fiziksel'], kind: 'nova', cost: 20, cd: 4.5,
      flavor: 'Kuyruk Savurma + Kamçı Kası geni: art arda üç süpürme.',
      base: { dmg: 2.8, r: 8, knock: 16, pulses: 3, pulseGap: 0.45, st: [['slow', 2], ['stun', 0.5]] },
    },
    {
      id: 'f_clonestrike', stage: 1, slot: 'active', fusion: true, from: 'r_ambush', needGene: 'g_split',
      name: 'Sürü Pususu', icon: '🦎', tags: ['avci', 'bolunme'], kind: 'leap', cost: 24, cd: 6,
      flavor: 'Pusu Sıçrayışı + Bölünme geni: indiğin yerde iki kopyan belirir.',
      base: { castRange: 18, dmg: 4.2, r: 5, knock: 8, st: [['bleed', 3], ['stun', 0.6]], summon: { count: 2, dur: 10, hpFrac: 0.4, dmgFrac: 0.6 } },
    },

    /* ---------------- MEMELİ (hücre/sürüngen geni ister) ---------------- */
    {
      id: 'f_bonebreaker', stage: 2, slot: 'active', fusion: true, from: 'm_claw', needGene: 'g_bone',
      name: 'Kemik Kıran', icon: '💀', tags: ['pence', 'kemik'], kind: 'cone', cost: 14, cd: 1.5,
      flavor: 'Pençe Darbesi + Kemik Kası geni: kemik parçalayan çifte darbe.',
      base: { dmg: 2.7, range: 6.5, angle: 1.8, hits: 2, knock: 6, st: [['bleed', 3], ['vuln', 1]] },
    },
    {
      id: 'f_plague', stage: 2, slot: 'active', fusion: true, from: 'm_howl', needGene: 'g_venom',
      name: 'Veba Uluması', icon: '☠️', tags: ['uluma', 'zehir'], kind: 'nova', cost: 24, cd: 8,
      flavor: 'Uluma + Zehir Kesesi geni (hücreden!): korku ve veba.',
      base: { dmg: 1.2, r: 12, st: [['fear', 2.2], ['vuln', 3], ['poison', 5]] },
    },
    {
      id: 'f_sunfall', stage: 2, slot: 'active', fusion: true, from: 'm_pounce', needGene: 'g_sun',
      name: 'Güneş Düşüşü', icon: '☀️', tags: ['pence', 'gunes'], kind: 'leap', cost: 24, cd: 5.5,
      flavor: 'Sıçrayış + Güneş Kanı geni: indiğin yer alev alır.',
      base: { castRange: 20, dmg: 5, r: 6.5, knock: 10, st: [['burn', 4], ['stun', 0.8]] },
    },
    {
      id: 'f_endless', stage: 2, slot: 'active', fusion: true, from: 'm_pack', needGene: 'g_split',
      name: 'Sonsuz Sürü', icon: '🐺', tags: ['suru', 'bolunme'], kind: 'summon', cost: 32, cd: 14,
      flavor: 'Sürü Çağrısı + Bölünme geni (hücreden!): koca bir sürü.',
      base: { count: 6, dur: 24, hpFrac: 0.6, dmgFrac: 0.7 },
    },
    {
      id: 'f_thunderclaw', stage: 2, slot: 'active', fusion: true, from: 'm_moon', needGene: 'g_shock',
      name: 'Yıldırım Pençe', icon: '⚡', tags: ['ay', 'elektrik'], kind: 'dash', cost: 22, cd: 3.5,
      flavor: 'Ay Işığı Çizgisi + Elektrik Zarı geni: geçtiğin her hedeften yıldırım seker.',
      base: { dist: 15, speed: 48, dmg: 3.2, width: 3, iframe: 0.45, crit: true, chainOnHit: 2, st: [['shock', 2], ['bleed', 2]] },
    },
    {
      id: 'f_sandroar', stage: 2, slot: 'active', fusion: true, from: 'm_wave', needGene: 'g_sand',
      name: 'Kum Kükreyişi', icon: '🏜️', tags: ['uluma', 'kum'], kind: 'bolt', cost: 24, cd: 5.5,
      flavor: 'Kükreme Dalgası + Kum Gözü geni: kum yüklü dev dalgalar.',
      base: { dmg: 2.4, speed: 22, count: 5, spread: 1.2, range: 24, size: 2.4, pierce: 99, knock: 10, st: [['fear', 1.2], ['slow', 3], ['vuln', 1]] },
    },
  ]);
})();
