/* ============================================================
   data/reptile.js — Sürüngen çağı: 16 aktif, 4 ultimate, 11 pasif
   ============================================================ */
(function () {
  'use strict';

  const S = 1;

  EV.DATA.addSkills([
    {
      id: 'r_spear', stage: S, slot: 'active', name: 'Kemik Mızrak', icon: '🦴', tags: ['kemik'],
      kind: 'bolt', cost: 16, cd: 1.4, flavor: 'Delip geçen kemik mızrak; kanatır.',
      base: { dmg: 1.3, speed: 40, count: 1, spread: 0.12, pierce: 2, range: 32, size: 0.36, st: [['bleed', 1]] },
      ranks: [
        { txt: 'Hasar %155', dmg: 1.55 },
        { txt: '+1 mızrak', count: 2 },
        { txt: '4 hedef deler, Kanama 2', pierce: 4, st: [['bleed', 2]] },
        { txt: '+1 mızrak, hasar %190', count: 3, dmg: 1.9 },
      ],
    },
    {
      id: 'r_tail', stage: S, slot: 'active', name: 'Kuyruk Savurma', icon: '🌀', tags: ['fiziksel'],
      kind: 'nova', cost: 18, cd: 4.5, flavor: 'Kuyruğunla çevreni süpürürsün.',
      base: { dmg: 1.6, r: 5.5, knock: 14, st: [['slow', 1]] },
      ranks: [
        { txt: 'Alan 6.3m', r: 6.3 },
        { txt: 'Hasar %200', dmg: 2.0 },
        { txt: 'Yavaşlama 2 + kısa sersemlik', st: [['slow', 2], ['stun', 0.5]] },
        { txt: 'Hasar %260, alan 7m', dmg: 2.6, r: 7 },
      ],
    },
    {
      id: 'r_trap', stage: S, slot: 'active', name: 'Kum Tuzağı', icon: '⏳', tags: ['kum'],
      kind: 'zone', cost: 22, cd: 7, flavor: 'Basılı tut, nişan al, bırak: ayak bağlayan kum çukuru.',
      base: { dmg: 0.22, r: 3.8, dur: 5, tick: 0.5, castRange: 20, st: [['slow', 1], ['vuln', 1]] },
      ranks: [
        { txt: 'Alan 4.5m', r: 4.5 },
        { txt: 'Süre 6.5sn', dur: 6.5 },
        { txt: 'Yavaşlama 2, hasar artar', st: [['slow', 2], ['vuln', 1]], dmg: 0.3 },
        { txt: 'Alan 5.5m, hasar %40', r: 5.5, dmg: 0.4 },
      ],
    },
    {
      id: 'r_breath', stage: S, slot: 'active', name: 'Güneş Nefesi', icon: '🔥', tags: ['gunes'],
      kind: 'cone', cost: 18, cd: 3, flavor: 'Güneşten topladığın ısıyı alev gibi üflersin.',
      base: { dmg: 1.2, range: 7.5, angle: 0.9, knock: 3, st: [['burn', 2]] },
      ranks: [
        { txt: 'Menzil 8.5m', range: 8.5 },
        { txt: 'Hasar %150', dmg: 1.5 },
        { txt: 'Yanık 3, geniş koni', st: [['burn', 3]], angle: 1.15 },
        { txt: 'Hasar %190, menzil 10m', dmg: 1.9, range: 10 },
      ],
    },
    {
      id: 'r_ambush', stage: S, slot: 'active', name: 'Bukalemun Pususu', icon: '🦎', tags: ['avci'],
      kind: 'stealth', cost: 20, cd: 9,
      flavor: 'Rengini ortama uydurursun: düşmanlar seni yakından görmedikçe kaybeder. İlk saldırın pusu olur: avın üstüne atılır, kritik ve sersemletici bir ısırık. Hasar alınca ya da yetenek atınca bozulur.',
      base: { dur: 5, speed: 0, mul: 2.6, pounce: 9, skillMul: 1.3, st: [['stun', 0.8], ['bleed', 2]] },
      ranks: [
        { txt: 'Süre 7sn, gizliyken +%15 hız', dur: 7, speed: 0.15 },
        { txt: 'Pusu %330', mul: 3.3 },
        { txt: 'Atılma 13m, Kanama 3 + uzun sersemlik', pounce: 13, st: [['stun', 1.2], ['bleed', 3]] },
        { txt: 'Bekleme 7sn, pusu %400', cd: 7, mul: 4.0 },
      ],
    },
    {
      id: 'r_scales', stage: S, slot: 'active', name: 'Pul Zırhı', icon: '🛡️', tags: ['pul'],
      kind: 'buff', cost: 20, cd: 14, flavor: 'Pullarını kabartırsın: zırh ve yansıtma.',
      base: { dur: 5, mods: { armor: 0.3, reflect: 0.2 } },
      ranks: [
        { txt: 'Süre 6sn', dur: 6 },
        { txt: 'Zırh %38, yansıtma %30', mods: { armor: 0.38, reflect: 0.3 } },
        { txt: '+ %15 kalkan', mods: { armor: 0.38, reflect: 0.3, shield: 0.15 } },
        { txt: 'Süre 8sn, zırh %45', dur: 8, mods: { armor: 0.45, reflect: 0.4, shield: 0.2 } },
      ],
    },
    {
      id: 'r_fang', stage: S, slot: 'active', name: 'Komodo Isırığı', icon: '🐍', tags: ['zehir', 'kemik'],
      kind: 'mark', cost: 14, cd: 4,
      flavor: 'Atılıp ısırırsın; ısırılanlarda zehir işaretin kalır. Her vuruşun ve geçen her saniye işareti büyütür. Tekrar bas: zehir aynı anda patlar. Basmazsan 6 sn sonra yarı güçle kendiliğinden patlar.',
      base: { shape: 'bite', range: 4.2, angle: 0.8, lunge: 3, dmg: 1.4, win: 6, boom: 1.6, per: 0.35, max: 5, grow: 1.5, autoFrac: 0.5, st: [['poison', 2]], boomSt: [['poison', 2]] },
      ranks: [
        { txt: 'Isırık %170', dmg: 1.7 },
        { txt: 'Patlama %200, işaret başı +%45', boom: 2.0, per: 0.45 },
        { txt: 'Patlama çevreye sıçrar (3m)', boomR: 3 },
        { txt: 'Isırık %200, patlama %280, işaret başı +%60', dmg: 2.0, boom: 2.8, per: 0.6 },
      ],
    },
    {
      id: 'r_spikes', stage: S, slot: 'active', name: 'Dikenli Sırt', icon: '🌵', tags: ['fiziksel', 'kemik'],
      kind: 'bolt', cost: 20, cd: 4, flavor: 'Sırtındaki dikenleri her yöne fırlatırsın.',
      base: { dmg: 0.9, speed: 30, count: 6, radial: true, pierce: 0, range: 16, size: 0.3, st: [['bleed', 1]] },
      ranks: [
        { txt: '8 diken', count: 8 },
        { txt: 'Hasar %115', dmg: 1.15 },
        { txt: '10 diken, 1 delme', count: 10, pierce: 1 },
        { txt: '12 diken, hasar %140', count: 12, dmg: 1.4 },
      ],
    },
    {
      id: 'r_tornado', stage: S, slot: 'active', name: 'Kum Hortumu', icon: '🌪️', tags: ['kum'],
      kind: 'bolt', cost: 26, cd: 8, flavor: 'Yavaş ilerleyen, içindekileri sürekli döven bir hortum.',
      base: { dmg: 0.4, speed: 9, count: 1, spread: 0.5, range: 24, size: 2.2, tick: 0.35, pierce: 99, knock: 2, st: [['slow', 1]] },
      ranks: [
        { txt: 'Daha geniş hortum', size: 2.6 },
        { txt: 'Hasar %55/tık', dmg: 0.55 },
        { txt: '+1 hortum', count: 2 },
        { txt: 'Hasar %75/tık, Kırılganlık', dmg: 0.75, st: [['slow', 1], ['vuln', 1]] },
      ],
    },
    {
      id: 'r_heat', stage: S, slot: 'active', name: 'Güneşlenme', icon: '☀️', tags: ['gunes'],
      kind: 'stance', cost: 10, cd: 1.5,
      flavor: 'Aç/kapa duruş: güneşi emersin. Açıkken temel saldırıların alev saçar (yakar, çevreye sıçrar) ve daha hızlı vurursun; her saniye enerji yakar.',
      base: { drain: 9, dur: 30, mods: { atkSpd: 0.25 }, basic: { mult: 1.1, st: [['burn', 1]], splash: 0.35, splashR: 2.5, color: 0xffa63d } },
      ranks: [
        { txt: 'Saldırı hızı +%35', mods: { atkSpd: 0.35 } },
        { txt: 'Yanık 2, sıçrama %50', basic: { mult: 1.1, st: [['burn', 2]], splash: 0.5, splashR: 2.5, color: 0xffa63d } },
        { txt: 'Enerji tüketimi 6/sn', drain: 6 },
        { txt: 'Hasar +%20, saldırı hızı +%45', mods: { atkSpd: 0.45, dmg: 0.2 }, basic: { mult: 1.2, st: [['burn', 2]], splash: 0.5, splashR: 3, color: 0xffa63d } },
      ],
    },
    {
      id: 'r_tongue', stage: S, slot: 'active', name: 'Yapışkan Dil', icon: '👅', tags: ['avci'],
      kind: 'grab', cost: 16, cd: 5,
      flavor: 'Dilini fırlatıp avı ağzına çekersin. Basılı tut: ağzında taşı, nişan al. Bırak: fırlat — çarptığı ve düştüğü yerdeki herkes hasar alır. Ağır avlar yalnızca sersemler.',
      base: { range: 14, maxSize: 1.5, carry: 2.5, grabDmg: 0.8, dmg: 2.6, splash: 1.4, splashR: 3, throwDist: 16, autoHold: 0.3, st: [['stun', 0.8]] },
      ranks: [
        { txt: 'Menzil 18m', range: 18 },
        { txt: 'Fırlatma %340', dmg: 3.4 },
        { txt: 'Daha iri avları da yakalar, çarpma alanı 4m', maxSize: 2.0, splashR: 4 },
        { txt: 'Bekleme 4sn, fırlatma %400', cd: 4, dmg: 4.0 },
      ],
    },

    /* ---------------- yeni türler: ışın, bumerang, totem, ışınlanma, dalga ---------------- */
    {
      id: 'r_sunray', stage: S, slot: 'active', name: 'Güneş Odağı', icon: '🔆', tags: ['gunes'],
      kind: 'beam', cost: 22, cd: 7, flavor: 'Güneşi gözlerinde toplayıp ince bir ışına odaklarsın; aynı hedefte kaldıkça ısınır.',
      base: { dmg: 0.2, tick: 0.25, dur: 2.5, range: 16, width: 0.8, pierce: false, ramp: 0.12, selfSlow: 0.3, turn: 5, st: [['burn', 1]] },
      ranks: [
        { txt: 'Süre 3sn', dur: 3 },
        { txt: 'Isınma her tıkta +%18', ramp: 0.18 },
        { txt: 'Hasar %26/tık, Yanık 2', dmg: 0.26, st: [['burn', 2]] },
        { txt: 'Menzil 20m, süre 3.5sn', range: 20, dur: 3.5 },
      ],
    },
    {
      id: 'r_disc', stage: S, slot: 'active', name: 'Pul Diski', icon: '🥏', tags: ['pul'],
      kind: 'boomerang', cost: 16, cd: 2.8, flavor: 'Keskin bir pulunu bumerang gibi fırlatırsın; gidişte ve dönüşte keser.',
      base: { dmg: 1.0, speed: 24, range: 15, size: 0.5, count: 1, spread: 0.45, knock: 3, st: [['bleed', 1]] },
      ranks: [
        { txt: 'Hasar %120', dmg: 1.2 },
        { txt: 'Dönüşte vurduklarını çeker, Kanama 2', pullBack: true, st: [['bleed', 2]] },
        { txt: 'Menzil 18m', range: 18 },
        { txt: 'Hasar %140, bekleme 2.4sn', dmg: 1.4, cd: 2.4 },
      ],
    },
    {
      id: 'r_nest', stage: S, slot: 'active', name: 'Engerek Yuvası', icon: '🪺', tags: ['zehir'],
      kind: 'totem', cost: 22, cd: 9, flavor: 'Basılı tut, nişan al, bırak: bir yuva kurarsın; yavru engerekler en yakın düşmana zehir tükürür.',
      base: { mode: 'shot', castRange: 16, r: 12, rate: 1.0, dur: 9, dmg: 0.45, speed: 26, max: 2, height: 1.2, st: [['poison', 1]] },
      ranks: [
        { txt: 'Süre 11sn', dur: 11 },
        { txt: 'Zehir 2, en fazla 3 yuva', st: [['poison', 2]], max: 3 },
        { txt: 'Tükürük 2m alana patlar', explode: 2 },
        { txt: 'Tükürme 0.9sn', rate: 0.9 },
      ],
    },
    {
      id: 'r_dive', stage: S, slot: 'active', name: 'Kum Dalışı', icon: '🕳️', tags: ['kum'],
      kind: 'burrow', cost: 18, cd: 5,
      flavor: 'Kuma dalarsın: görünmez ve dokunulmazsın, daha hızlısın. Tekrar bas ya da saldır: altındakileri havaya savurarak çık. Ne kadar uzun kalırsan çıkış o kadar sert.',
      base: { dur: 3, speed: 0.35, dmg: 2.2, grow: 0.3, growMax: 0.9, r: 4, knock: 10, st: [['stun', 0.6], ['slow', 1]] },
      ranks: [
        { txt: 'En çok 4sn, hız +%45', dur: 4, speed: 0.45 },
        { txt: 'Çıkış %280', dmg: 2.8 },
        { txt: 'Bekleme 4sn', cd: 4 },
        { txt: 'Çıkış alanı 5.5m, %340', r: 5.5, dmg: 3.4 },
      ],
    },
    {
      id: 'r_quake', stage: S, slot: 'active', name: 'Kuyruk Depremi', icon: '🦖', tags: ['fiziksel'],
      kind: 'wave', cost: 18, cd: 5, flavor: 'Kuyruğunu yere çarparsın; önüne ilerleyen bir fay hattı yolundakileri sersemletir.',
      base: { shape: 'line', width: 3, range: 16, speed: 22, height: 0.9, dmg: 1.6, knock: 5, st: [['stun', 0.5], ['slow', 1]] },
      ranks: [
        { txt: 'Menzil 19m', range: 19 },
        { txt: 'Hasar %220', dmg: 2.2 },
        { txt: 'Genişlik 4.5m, uzun sersemlik', width: 4.5, st: [['stun', 0.8], ['slow', 1]] },
        { txt: '3 fay hattı (yelpaze)', count: 3, spread: 0.7 },
      ],
    },

    /* ---------------- ULTIMATE ---------------- */
    {
      id: 'r_u_meteor', stage: S, slot: 'ult', name: 'Meteor Kuyruk', icon: '☄️', tags: ['gunes'],
      kind: 'leap', cost: 0, cd: 2, flavor: 'Göğe fırlayıp nişan aldığın yere meteor gibi inersin.',
      base: { castRange: 18, dmg: 5, r: 8, knock: 16, st: [['burn', 3], ['stun', 1]] },
      ranks: [
        { txt: 'İniş alanı 9m', r: 9 },
        { txt: 'Hasar %650', dmg: 6.5 },
        { txt: 'Yanık 4, uzun sersemlik', st: [['burn', 4], ['stun', 1.4]] },
        { txt: 'Hasar %800, alan 10m', dmg: 8, r: 10 },
      ],
    },
    {
      id: 'r_u_storm', stage: S, slot: 'ult', name: 'Kum Fırtınası', icon: '🏜️', tags: ['kum'],
      kind: 'zone', cost: 0, cd: 2, flavor: 'Nişan aldığın bölgeye dev bir kum fırtınası.',
      base: { dmg: 0.6, r: 10, dur: 6, tick: 0.5, castRange: 24, st: [['slow', 2], ['vuln', 1]] },
      ranks: [
        { txt: 'Süre 7sn', dur: 7 },
        { txt: 'Hasar %80/tık', dmg: 0.8 },
        { txt: 'Yavaşlama 3 + Kırılganlık 2', st: [['slow', 3], ['vuln', 2]] },
        { txt: 'Alan 12m, hasar %100', r: 12, dmg: 1 },
      ],
    },
    {
      id: 'r_u_blood', stage: S, slot: 'ult', name: 'Ölüm Yuvarlanışı', icon: '🐊', tags: ['avci'],
      kind: 'grab', cost: 0, cd: 2,
      flavor: 'Timsah gibi avını çenene alıp yuvarlanırsın: her dönüşte parçalar, emdiğin kanla iyileşirsin; sonunda nişana fırlatırsın. Boss bile bir süre yerine çivilenir.',
      base: { roll: true, boss: true, range: 10, maxSize: 99, carry: 2.4, rollTick: 0.25, rollDmg: 0.5, heal: 0.25, grabDmg: 1.0, dmg: 3.0, splash: 2.0, splashR: 4.5, throwDist: 14, st: [['bleed', 3], ['stun', 1]] },
      ranks: [
        { txt: 'Yuvarlanma 3sn', carry: 3.0 },
        { txt: 'Dönüş başı %65', rollDmg: 0.65 },
        { txt: 'Fırlatma %450, iyileşme %35', dmg: 4.5, heal: 0.35 },
        { txt: 'Kanama 5, fırlatma alanı 6m', st: [['bleed', 5], ['stun', 1.2]], splashR: 6 },
      ],
    },
    {
      id: 'r_u_sunrain', stage: S, slot: 'ult', name: 'Güneş Yağmuru', icon: '🌠', tags: ['gunes'],
      kind: 'barrage', cost: 0, cd: 2, flavor: 'Gökyüzünü tutuşturup nişan aldığın bölgeye kızgın taşlar yağdırırsın.',
      base: { from: 'sky', castRange: 24, count: 10, r: 7, blast: 3, delay: 0.7, gap: 0.12, dmg: 1.3, size: 0.8, knock: 6, st: [['burn', 2]] },
      ranks: [
        { txt: '+2 taş', count: 12 },
        { txt: 'Hasar %160, sersemletir', dmg: 1.6, st: [['burn', 2], ['stun', 0.5]] },
        { txt: 'Alan 8m, +3 taş', r: 8, count: 15 },
        { txt: 'Hasar %190, Yanık 3', dmg: 1.9, st: [['burn', 3], ['stun', 0.5]] },
      ],
    },
  ]);

  EV.DATA.addPassives([
    { id: 'p_coldb',    stage: S, name: 'Soğukkanlı',       icon: '🔋', tags: ['pul'],   max: 5, per: { maxEnergy: 0.12 } },
    { id: 'p_thick',    stage: S, name: 'Kalın Pul',        icon: '🛡️', tags: ['pul'],   max: 5, per: { armor: 0.06 } },
    { id: 'p_jaw',      stage: S, name: 'Güçlü Çene',       icon: '💪', tags: ['kemik'], max: 5, per: { dmg: 0.1 } },
    { id: 'p_longt',    stage: S, name: 'Uzun Kuyruk',      icon: '📏', tags: ['fiziksel'], max: 5, per: { area: 0.1 } },
    { id: 'p_bask',     stage: S, name: 'Güneşlenme',       icon: '🌞', tags: ['gunes'], max: 5, per: { hpRegen: 0.004 } },
    { id: 'p_instinct', stage: S, name: 'Avcı İçgüdüsü',    icon: '🎯', tags: ['avci'],  max: 5, per: { critDmg: 0.15, crit: 0.02 } },
    { id: 'p_legs',     stage: S, name: 'Çevik Bacaklar',   icon: '🦵', tags: ['avci'],  max: 5, per: { speed: 0.06, dashCost: -0.08 } },
    { id: 'p_bone',     stage: S, name: 'Keskin Kemik',     icon: '🦴', tags: ['kemik'], max: 5, per: { statusPower: 0.12, statusDur: 0.08 } },
    { id: 'p_opport',   stage: S, name: 'Fırsatçı',         icon: '🐊', tags: ['kum'],   max: 5, per: { ccDmg: 0.1 } },
    { id: 'p_venomgl',  stage: S, name: 'Zehir Bezleri',    icon: '🧪', tags: ['zehir'], max: 5, per: { statusPower: 0.1, ccDmg: 0.05 } },
    { id: 'p_sunscale', stage: S, name: 'Güneş Pulları',    icon: '🌅', tags: ['pul'],   max: 5, per: { reflect: 0.05, hpRegen: 0.002 },
      bonus: [{ at: 5, mods: { armor: 0.1 } }] },
  ]);
})();
