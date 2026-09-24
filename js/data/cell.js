/* ============================================================
   data/cell.js — Hücre çağı: 11 aktif, 3 ultimate, 9 pasif
   dmg = oyuncunun hasar değerinin katı. st = [[durum, yük|sn]]
   ============================================================ */
(function () {
  'use strict';

  const S = 0; // aşama indeksi

  EV.DATA.addSkills([
    {
      id: 'c_drop', stage: S, slot: 'active', name: 'Zehir Damlası', icon: '🟢', tags: ['zehir'],
      kind: 'bolt', cost: 16, cd: 1.4, flavor: 'Nişangaha zehirli damla fırlatır.',
      base: { dmg: 1.4, speed: 32, count: 1, spread: 0.18, pierce: 0, range: 28, size: 0.42, st: [['poison', 2]] },
      ranks: [
        { txt: 'Hasar %160', dmg: 1.6 },
        { txt: '+1 damla', count: 2 },
        { txt: 'Zehir 3 yük, 1 hedefi deler', st: [['poison', 3]], pierce: 1 },
        { txt: '+1 damla (damla başı %150)', count: 3, dmg: 1.5 },
      ],
    },
    {
      id: 'c_spark', stage: S, slot: 'active', name: 'Elektrik Kıvılcımı', icon: '⚡', tags: ['elektrik'],
      kind: 'chain', cost: 18, cd: 2.2, flavor: 'Nişandaki hedeften diğerlerine sekerek atlar.',
      base: { dmg: 1.2, range: 18, bounces: 2, bounceRange: 8, falloff: 0.85, st: [['shock', 1]] },
      ranks: [
        { txt: '+1 sekme', bounces: 3 },
        { txt: 'Hasar %145', dmg: 1.45 },
        { txt: '+1 sekme, Şok 2', bounces: 4, st: [['shock', 2]] },
        { txt: 'Hasar %170, +1 sekme', dmg: 1.7, bounces: 5 },
      ],
    },
    {
      id: 'c_acid', stage: S, slot: 'active', name: 'Asit Bulutu', icon: '☁️', tags: ['asit'],
      kind: 'zone', cost: 22, cd: 7, flavor: 'Basılı tut, nişan al, bırak: yere geniş bir asit bulutu.',
      base: { dmg: 0.4, r: 4.5, dur: 5, tick: 0.5, castRange: 22, st: [['vuln', 1]] },
      ranks: [
        { txt: 'Alan 5.2m', r: 5.2 },
        { txt: 'Süre 6.5sn, hasar %50', dur: 6.5, dmg: 0.5 },
        { txt: 'Yavaşlatır da', st: [['vuln', 1], ['slow', 1]] },
        { txt: 'Alan 6.2m, hasar %60', r: 6.2, dmg: 0.6 },
      ],
    },
    {
      id: 'c_lash', stage: S, slot: 'active', name: 'Kamçı Darbesi', icon: '〰️', tags: ['fiziksel'],
      kind: 'cone', cost: 12, cd: 2.2, flavor: 'Önündeki yayı kamçıyla savurur.',
      base: { dmg: 1.6, range: 5.8, angle: 1.5, knock: 9, st: [] },
      ranks: [
        { txt: 'Hasar %190', dmg: 1.9 },
        { txt: 'Menzil 6.8m, yavaşlatır', range: 6.8, st: [['slow', 1]] },
        { txt: 'Hasar %220, daha sert itiş', dmg: 2.2, knock: 14 },
        { txt: 'Geniş yay, hasar %260', angle: 2.2, dmg: 2.6 },
      ],
    },
    {
      id: 'c_web', stage: S, slot: 'active', name: 'Yapışkan Ağ', icon: '🕸️', tags: ['yapiskan'],
      kind: 'bolt', cost: 16, cd: 3.5, flavor: 'Yavaş bir ağ topu; çarptığı yerde patlayıp yapıştırır.',
      base: { dmg: 0.8, speed: 22, count: 1, spread: 0.35, range: 24, size: 0.55, explode: 3.4, st: [['slow', 2]] },
      ranks: [
        { txt: 'Patlama 4m', explode: 4 },
        { txt: 'Yavaşlama 3 yük', st: [['slow', 3]] },
        { txt: '+1 ağ', count: 2 },
        { txt: 'Patlama 4.8m, Kırılganlık', explode: 4.8, dmg: 1.0, st: [['slow', 3], ['vuln', 1]] },
      ],
    },
    {
      id: 'c_cilia', stage: S, slot: 'active', name: 'Kirpik Dönüşü', icon: '🌀', tags: ['fiziksel', 'zar'],
      kind: 'nova', cost: 20, cd: 5, flavor: 'Çevrendeki her şeyi hızla döner kirpiklerle iter.',
      base: { dmg: 1.4, r: 5.5, knock: 12, st: [] },
      ranks: [
        { txt: 'Alan 6.3m', r: 6.3 },
        { txt: 'Hasar %180, yavaşlatır', dmg: 1.8, st: [['slow', 1]] },
        { txt: 'Alan 7.2m, güçlü itiş', r: 7.2, knock: 16 },
        { txt: 'Hasar %230, Yavaşlama 2', dmg: 2.3, st: [['slow', 2]] },
      ],
    },
    {
      id: 'c_bud', stage: S, slot: 'active', name: 'Hücre Tomurcuğu', icon: '🫧', tags: ['bolunme'],
      kind: 'summon', cost: 30, cd: 14, flavor: 'Kendinden küçük bir kopya koparır, seninle savaşır.',
      base: { count: 1, dur: 14, hpFrac: 0.35, dmgFrac: 0.45 },
      ranks: [
        { txt: 'Süre 18sn', dur: 18 },
        { txt: '+1 tomurcuk', count: 2 },
        { txt: 'Daha güçlü tomurcuklar', hpFrac: 0.5, dmgFrac: 0.6 },
        { txt: '+1 tomurcuk', count: 3 },
      ],
    },
    {
      id: 'c_membrane', stage: S, slot: 'active', name: 'Zar Kalkanı', icon: '🛡️', tags: ['zar'],
      kind: 'buff', cost: 22, cd: 12, flavor: 'Zarını kalınlaştırır, hasarı emen bir kalkan kazanırsın.',
      base: { dur: 4, mods: { shield: 0.22 } },
      ranks: [
        { txt: 'Kalkan %28', mods: { shield: 0.28 } },
        { txt: 'Süre 5sn, zırh', dur: 5, mods: { shield: 0.3, armor: 0.1 } },
        { txt: 'Kalkan %36', mods: { shield: 0.36, armor: 0.15 } },
        { txt: 'Süre 6sn, kalkan %45', dur: 6, mods: { shield: 0.45, armor: 0.2 } },
      ],
    },
    {
      id: 'c_mine', stage: S, slot: 'active', name: 'Spor Mayını', icon: '💣', tags: ['zehir'],
      kind: 'trap', cost: 14, cd: 3, flavor: 'Ayağının dibine patlayan spor bırakır.',
      base: { dmg: 1.4, r: 3.2, arm: 0.6, life: 20, max: 3, st: [['poison', 3]] },
      ranks: [
        { txt: 'En fazla 4 mayın', max: 4 },
        { txt: 'Hasar %180, alan 3.8m', dmg: 1.8, r: 3.8 },
        { txt: 'Zehir 4 + yavaşlatır', st: [['poison', 4], ['slow', 1]] },
        { txt: 'En fazla 5 mayın, hasar %240, alan 4.2m', max: 5, dmg: 2.4, r: 4.2 },
      ],
    },
    {
      id: 'c_zap', stage: S, slot: 'active', name: 'Elektrikli Atılım', icon: '💨', tags: ['elektrik'],
      kind: 'dash', cost: 20, cd: 4.5, flavor: 'Nişana doğru şimşek gibi fırlar, yolundakileri çarpar.',
      base: { dist: 9, speed: 38, dmg: 1.1, width: 2.2, iframe: 0.35, st: [['shock', 1]] },
      ranks: [
        { txt: 'Mesafe 11m', dist: 11 },
        { txt: 'Hasar %150, Şok 2', dmg: 1.5, st: [['shock', 2]] },
        { txt: 'Bekleme 3.5sn', cd: 3.5 },
        { txt: 'Mesafe 13m, hasar %190', dist: 13, dmg: 1.9 },
      ],
    },
    {
      id: 'c_orbs', stage: S, slot: 'active', name: 'Protoplazma Yörüngesi', icon: '🔵', tags: ['asit'],
      kind: 'orbit', cost: 26, cd: 9, flavor: 'Etrafında dönen asit küreleri çağırır.',
      base: { count: 2, dur: 6, r: 3.6, dmg: 0.8, speed: 3.2, size: 0.55, hitCd: 0.5, st: [['vuln', 1]] },
      ranks: [
        { txt: '+1 küre', count: 3 },
        { txt: 'Süre 8sn, hasar %100', dur: 8, dmg: 1.0 },
        { txt: '+1 küre, geniş yörünge', count: 4, r: 4.3 },
        { txt: 'Hasar %130, zehirler', dmg: 1.3, st: [['vuln', 1], ['poison', 1]] },
      ],
    },

    /* ---------------- ULTIMATE (Öfke) ---------------- */
    {
      id: 'c_u_mitosis', stage: S, slot: 'ult', name: 'Mitoz Patlaması', icon: '🧬', tags: ['bolunme'],
      kind: 'summon', cost: 0, cd: 2, flavor: 'Bölünürsün: kopyaların savaşa katılır, sen iyileşirsin.',
      base: { count: 3, dur: 16, hpFrac: 0.6, dmgFrac: 0.7, healFrac: 0.2 },
      ranks: [
        { txt: '+1 kopya', count: 4 },
        { txt: 'Süre 20sn, daha güçlü', dur: 20, dmgFrac: 0.85 },
        { txt: '+1 kopya', count: 5 },
        { txt: 'Kopyalar senin kadar güçlü', hpFrac: 0.8, dmgFrac: 1.0 },
      ],
    },
    {
      id: 'c_u_nova', stage: S, slot: 'ult', name: 'Toksik Süpernova', icon: '☢️', tags: ['zehir'],
      kind: 'nova', cost: 0, cd: 2, flavor: 'Tüm zehrini tek seferde patlatırsın.',
      base: { dmg: 4, r: 11, knock: 18, st: [['poison', 6]] },
      ranks: [
        { txt: 'Alan 12.5m', r: 12.5 },
        { txt: 'Hasar %500', dmg: 5 },
        { txt: 'Zehir 8 + Kırılganlık 2', st: [['poison', 8], ['vuln', 2]] },
        { txt: 'Hasar %700, alan 14m', dmg: 7, r: 14 },
      ],
    },
    {
      id: 'c_u_vortex', stage: S, slot: 'ult', name: 'Fagositoz Girdabı', icon: '🌪️', tags: ['asit'],
      kind: 'zone', cost: 0, cd: 2, flavor: 'Nişan aldığın yerde her şeyi içine çeken bir girdap.',
      base: { dmg: 0.6, r: 7, dur: 5, tick: 0.5, castRange: 22, pull: 6, st: [['vuln', 1]] },
      ranks: [
        { txt: 'Süre 6sn', dur: 6 },
        { txt: 'Hasar %75, alan 8m', dmg: 0.75, r: 8 },
        { txt: 'Daha güçlü çekim', pull: 9 },
        { txt: 'Hasar %90, süre 7sn', dmg: 0.9, dur: 7 },
      ],
    },
  ]);

  EV.DATA.addPassives([
    { id: 'p_mito',  stage: S, name: 'Mitokondri',       icon: '🔋', tags: ['elektrik'], max: 5, per: { energyRegen: 0.12 } },
    { id: 'p_cyto',  stage: S, name: 'Sitoplazma',       icon: '🫀', tags: ['zar'],      max: 5, per: { maxHp: 0.12 } },
    { id: 'p_flag',  stage: S, name: 'Kamçı Kası',       icon: '🦵', tags: ['fiziksel'], max: 5, per: { speed: 0.07 } },
    { id: 'p_wall',  stage: S, name: 'Zar Kalınlaşması', icon: '🛡️', tags: ['zar'],      max: 5, per: { armor: 0.06 } },
    { id: 'p_tox',   stage: S, name: 'Toksin Yoğunluğu', icon: '☣️', tags: ['zehir'],    max: 5, per: { statusPower: 0.15, statusDur: 0.06 } },
    { id: 'p_ribo',  stage: S, name: 'Ribozom Hızı',     icon: '⏱️', tags: ['asit'],     max: 5, per: { cdr: 0.06 } },
    { id: 'p_nerve', stage: S, name: 'Sinir Ağı',        icon: '🎯', tags: ['elektrik'], max: 5, per: { crit: 0.05 } },
    { id: 'p_vacu',  stage: S, name: 'Açgözlü Vakuol',   icon: '🍽️', tags: ['asit'],     max: 5, per: { xpGain: 0.08, pickup: 0.25, lifesteal: 0.01 } },
    { id: 'p_divide', stage: S, name: 'Hızlı Bölünme',   icon: '🧫', tags: ['bolunme'],  max: 5, per: { summonPower: 0.15 },
      bonus: [{ at: 3, mods: { summonCount: 1 } }] },
  ]);
})();
