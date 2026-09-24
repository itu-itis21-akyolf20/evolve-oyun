/* ============================================================
   data/reptile.js — Sürüngen çağı: 11 aktif, 3 ultimate, 9 pasif
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
      id: 'r_ambush', stage: S, slot: 'active', name: 'Pusu Sıçrayışı', icon: '🦎', tags: ['avci'],
      kind: 'leap', cost: 24, cd: 7, flavor: 'Basılı tut, nişan al, bırak: hedefin üstüne atlarsın.',
      base: { castRange: 14, dmg: 2.2, r: 3.5, knock: 6, st: [['bleed', 2]] },
      ranks: [
        { txt: 'Menzil 17m', castRange: 17 },
        { txt: 'Hasar %280', dmg: 2.8 },
        { txt: 'Geniş iniş, Kanama 3 + sersemlik', r: 4.5, st: [['bleed', 3], ['stun', 0.4]] },
        { txt: 'Hasar %350, bekleme 5.5sn', dmg: 3.5, cd: 5.5 },
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
      id: 'r_fang', stage: S, slot: 'active', name: 'Zehirli Diş', icon: '🐍', tags: ['zehir', 'kemik'],
      kind: 'cone', cost: 14, cd: 2.2, flavor: 'Hedefe atılıp zehirli dişlerini geçirirsin.',
      base: { dmg: 2.2, range: 4.2, angle: 0.6, lunge: 3, st: [['poison', 2], ['bleed', 1]] },
      ranks: [
        { txt: 'Hasar %260', dmg: 2.6 },
        { txt: 'Zehir 3', st: [['poison', 3], ['bleed', 1]] },
        { txt: 'Daha uzun atılış, hasar %310', lunge: 5, dmg: 3.1 },
        { txt: 'Zehir 4 + Kanama 2, hasar %370', st: [['poison', 4], ['bleed', 2]], dmg: 3.7 },
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
      id: 'r_heat', stage: S, slot: 'active', name: 'Isı Soğurma', icon: '☀️', tags: ['gunes'],
      kind: 'buff', cost: 18, cd: 12, flavor: 'Güneşi emersin: hızlanırsın, vuruşların yakar.',
      base: { dur: 6, mods: { atkSpd: 0.3 }, onHitSt: [['burn', 1]] },
      ranks: [
        { txt: 'Süre 7sn', dur: 7 },
        { txt: 'Saldırı hızı %40, hasar %10', mods: { atkSpd: 0.4, dmg: 0.1 } },
        { txt: 'Vuruşlar Yanık 2', onHitSt: [['burn', 2]] },
        { txt: 'Süre 9sn, saldırı hızı %55', dur: 9, mods: { atkSpd: 0.55, dmg: 0.2 } },
      ],
    },
    {
      id: 'r_tongue', stage: S, slot: 'active', name: 'Yapışkan Dil', icon: '👅', tags: ['avci'],
      kind: 'bolt', cost: 16, cd: 6, flavor: 'Dilinle ilk vurduğun yaratığı yanına çekersin.',
      base: { dmg: 1.0, speed: 46, count: 1, range: 20, size: 0.42, pull: 1, st: [['stun', 0.6]] },
      ranks: [
        { txt: 'Menzil 24m', range: 24 },
        { txt: 'Hasar %150', dmg: 1.5 },
        { txt: 'Uzun sersemlik + Kırılganlık', st: [['stun', 0.9], ['vuln', 1]] },
        { txt: 'Bekleme 4sn, hasar %200', cd: 4, dmg: 2 },
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
      id: 'r_u_blood', stage: S, slot: 'ult', name: 'Kan Dansı', icon: '🩸', tags: ['avci'],
      kind: 'buff', cost: 0, cd: 2, flavor: 'Kana susarsın: vurdukça iyileşirsin.',
      base: { dur: 7, mods: { lifesteal: 0.25, atkSpd: 0.5, speed: 0.2 } },
      ranks: [
        { txt: 'Süre 8sn', dur: 8 },
        { txt: 'Can çalma %30, hasar %15', mods: { lifesteal: 0.3, atkSpd: 0.6, speed: 0.2, dmg: 0.15 } },
        { txt: 'Süre 9.5sn', dur: 9.5 },
        { txt: 'Can çalma %40, hasar %30', mods: { lifesteal: 0.4, atkSpd: 0.75, speed: 0.3, dmg: 0.3 } },
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
  ]);
})();
