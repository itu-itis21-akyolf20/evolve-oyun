/* ============================================================
   data/mammal.js — Memeli çağı: 16 aktif, 4 ultimate, 11 pasif
   Sonsuz nesil modunda da bu havuz kullanılır.
   ============================================================ */
(function () {
  'use strict';

  const S = 2;

  EV.DATA.addSkills([
    {
      id: 'm_claw', stage: S, slot: 'active', name: 'Pençe Darbesi', icon: '🐾', tags: ['pence'],
      kind: 'cone', cost: 12, cd: 1.6, flavor: 'Geniş bir yayda pençe savurursun.',
      base: { dmg: 1.7, range: 5, angle: 1.4, knock: 4, st: [['bleed', 1]] },
      ranks: [
        { txt: 'Hasar %200', dmg: 2.0 },
        { txt: 'Kanama 2', st: [['bleed', 2]] },
        { txt: 'Menzil 6m, geniş yay', range: 6, angle: 1.7 },
        { txt: 'Çift darbe, hasar %260', hits: 2, dmg: 2.6 },
      ],
    },
    {
      id: 'm_pack', stage: S, slot: 'active', name: 'Sürü Çağrısı', icon: '🐺', tags: ['suru'],
      kind: 'summon', cost: 30, cd: 15, flavor: 'Sürünü çağırırsın.',
      base: { count: 2, dur: 15, hpFrac: 0.4, dmgFrac: 0.45 },
      ranks: [
        { txt: 'Süre 20sn', dur: 20 },
        { txt: '+1 kurt', count: 3 },
        { txt: 'Daha güçlü sürü', hpFrac: 0.55, dmgFrac: 0.6 },
        { txt: '+1 kurt', count: 4 },
      ],
    },
    {
      id: 'm_howl', stage: S, slot: 'active', name: 'Uluma', icon: '🌕', tags: ['uluma', 'suru'],
      kind: 'command', cost: 20, cd: 9,
      flavor: 'Sürüne av emri verirsin: tüm yardımcıların kilitli avın üstüne atılır, ısırır ve güçlenir. Yanında sürü yoksa hayalet kurtlar gelir. Uluma yakındaki küçükleri korkutur.',
      base: { r: 26, buff: 1.5, spd: 1.3, dur: 6, strike: 1.5, pack: 2, dmg: 0.6, fearR: 7, fear: [['fear', 1]], st: [['vuln', 1]],
        ghost: { dur: 7, hpFrac: 0.3, dmgFrac: 0.45 } },
      ranks: [
        { txt: 'Sürü hasarı ×1.7', buff: 1.7 },
        { txt: 'Ava Kırılganlık 2, uluma %90', st: [['vuln', 2]], dmg: 0.9 },
        { txt: 'En az 3 kurt', pack: 3 },
        { txt: 'Emir 8sn, sürü hasarı ×2', dur: 8, buff: 2.0 },
      ],
    },
    {
      id: 'm_scent', stage: S, slot: 'active', name: 'Kan Kokusu', icon: '🩸', tags: ['kan'],
      kind: 'buff', cost: 16, cd: 12, flavor: 'Kanın kokusunu alırsın: hızlanır, kanayanlara sertleşirsin.',
      base: { dur: 6, mods: { speed: 0.2, vsBleed: 0.25 } },
      ranks: [
        { txt: 'Süre 7sn', dur: 7 },
        { txt: 'Kanayanlara +%35', mods: { speed: 0.25, vsBleed: 0.35 } },
        { txt: '+ can çalma', mods: { speed: 0.25, vsBleed: 0.35, lifesteal: 0.08 } },
        { txt: 'Süre 9sn, kanayanlara +%50', dur: 9, mods: { speed: 0.3, vsBleed: 0.5, lifesteal: 0.12 } },
      ],
    },
    {
      id: 'm_pounce', stage: S, slot: 'active', name: 'Sıçrayış', icon: '🐆', tags: ['pence'],
      kind: 'leap', cost: 22, cd: 6, flavor: 'Basılı tut, nişan al, bırak: avının üstüne çullan.',
      base: { castRange: 15, dmg: 2.4, r: 3.5, knock: 6, st: [['bleed', 1], ['stun', 0.4]] },
      ranks: [
        { txt: 'Menzil 18m', castRange: 18 },
        { txt: 'Hasar %300', dmg: 3 },
        { txt: 'Geniş iniş, Kanama 2', r: 4.5, st: [['bleed', 2], ['stun', 0.6]] },
        { txt: 'Bekleme 4.5sn, hasar %380', cd: 4.5, dmg: 3.8 },
      ],
    },
    {
      id: 'm_crush', stage: S, slot: 'active', name: 'Kemik Kırıcı Isırık', icon: '🦷', tags: ['kan', 'pence'],
      kind: 'charge', cost: 18, cd: 5,
      flavor: 'Basılı tut: çene kasların gerilir. Bırak: avına atılıp ısırırsın — ne kadar uzun tutarsan o kadar ağır. Tam dolumda sersemletir ve savunmasız bırakır.',
      base: { shape: 'cone', full: 1.0, min: 0.35, dmg: 4.8, range: 4.4, angle: 0.7, lunge: 5, knock: 6, selfSlow: 0.3, autoHold: 1.0, st: [['bleed', 1]], stFull: [['stun', 1], ['vuln', 1]] },
      ranks: [
        { txt: 'Isırık %580', dmg: 5.8 },
        { txt: 'Kanama 2, dolum 0.8sn', st: [['bleed', 2]], full: 0.8 },
        { txt: 'Uzun atılış', lunge: 7 },
        { txt: 'Isırık %800', dmg: 8.0 },
      ],
    },
    {
      id: 'm_moon', stage: S, slot: 'active', name: 'Ay Işığı Çizgisi', icon: '🌙', tags: ['ay'],
      kind: 'dash', cost: 20, cd: 5, flavor: 'Nişana doğru süzülürsün; yolundakilere hep kritik vurursun.',
      base: { dist: 12, speed: 44, dmg: 1.6, width: 2.6, iframe: 0.4, crit: true, st: [['bleed', 1]] },
      ranks: [
        { txt: 'Mesafe 14m', dist: 14 },
        { txt: 'Hasar %200', dmg: 2 },
        { txt: 'Kanama 2 + Kırılganlık', st: [['bleed', 2], ['vuln', 1]] },
        { txt: 'Bekleme 3.5sn, hasar %260', cd: 3.5, dmg: 2.6 },
      ],
    },
    {
      id: 'm_snare', stage: S, slot: 'active', name: 'Av Tuzağı', icon: '🪤', tags: ['avci'],
      kind: 'trap', cost: 16, cd: 4, flavor: 'Basan yaratığı yerine çiviler.',
      base: { dmg: 2, r: 3, arm: 0.5, life: 25, max: 3, st: [['stun', 1], ['bleed', 1]] },
      ranks: [
        { txt: 'En fazla 4 tuzak', max: 4 },
        { txt: 'Hasar %260', dmg: 2.6 },
        { txt: 'Uzun sersemlik, Kanama 2', st: [['stun', 1.4], ['bleed', 2]] },
        { txt: 'En fazla 5 tuzak, hasar %330', max: 5, dmg: 3.3 },
      ],
    },
    {
      id: 'm_quills', stage: S, slot: 'active', name: 'Dikenli Kürk', icon: '🦔', tags: ['pence'],
      kind: 'parry', cost: 14, cd: 6,
      flavor: 'Darbe gelmeden hemen önce bas: kirpi gibi dikenlerini kabartırsın. Vuran kendini dikenlere geçirir, dikenler her yöne fırlar. Başarırsan bekleme yarıya iner.',
      base: { win: 0.55, counter: 2.6, counterR: 5, splash: 1.0, knock: 8, refund: 0.5, st: [['bleed', 2], ['stun', 0.6]] },
      ranks: [
        { txt: 'Pencere 0.7sn', win: 0.7 },
        { txt: 'Karşı darbe %350', counter: 3.5 },
        { txt: 'Diken alanı 7m, %150', counterR: 7, splash: 1.5 },
        { txt: 'Kanama 4, başarıda bekleme sıfırlanır', st: [['bleed', 4], ['stun', 0.8]], refund: 1.0 },
      ],
    },
    {
      id: 'm_mark', stage: S, slot: 'active', name: 'Avcı İşareti', icon: '🎯', tags: ['ay'],
      kind: 'mark', cost: 14, cd: 6,
      flavor: 'Basılı tut, nişan al, bırak: bölgedeki avları işaretlersin. Her vuruşun işareti büyütür. Tekrar bas: tüm işaretler aynı anda patlar. Basmazsan 7 sn sonra yarı güçle kendiliğinden patlar.',
      base: { shape: 'area', castRange: 22, r: 4.5, dmg: 0.4, win: 7, boom: 2.2, per: 0.5, max: 5, autoFrac: 0.5, st: [['vuln', 1]], boomSt: [['bleed', 1]] },
      ranks: [
        { txt: 'Alan 5.5m', r: 5.5 },
        { txt: 'Patlama %280, işaret başı +%65', boom: 2.8, per: 0.65 },
        { txt: 'Patlama sersemletir', boomSt: [['bleed', 2], ['stun', 0.6]] },
        { txt: 'Bekleme 5sn, patlama %360', cd: 5, boom: 3.6, per: 0.8 },
      ],
    },
    {
      id: 'm_wave', stage: S, slot: 'active', name: 'Kükreme Dalgası', icon: '🔊', tags: ['uluma'],
      kind: 'bolt', cost: 22, cd: 6, flavor: 'Önüne doğru ilerleyen, korkutan bir ses dalgası.',
      base: { dmg: 1.3, speed: 22, count: 1, spread: 0.6, range: 22, size: 1.8, pierce: 99, knock: 8, st: [['fear', 0.8], ['slow', 1]] },
      ranks: [
        { txt: 'Daha geniş dalga', size: 2.2 },
        { txt: 'Hasar %170', dmg: 1.7 },
        { txt: '3 dalga', count: 3 },
        { txt: 'Hasar %220, uzun korku', dmg: 2.2, st: [['fear', 1.2], ['slow', 2]] },
      ],
    },

    /* ---------------- yeni türler: ışın, yağmur, totem, ışınlanma, dalga ---------------- */
    {
      id: 'm_moonbeam', stage: S, slot: 'active', name: 'Ay Hüzmesi', icon: '🌛', tags: ['ay'],
      kind: 'beam', cost: 22, cd: 7, flavor: 'Gözlerinden soğuk bir ay ışığı akar; deldiği herkesi savunmasız bırakır, her 4. tık kritik.',
      base: { dmg: 0.28, tick: 0.25, dur: 2.5, range: 18, width: 1.2, pierce: true, critEvery: 4, selfSlow: 0.25, turn: 4.5, st: [['vuln', 1]] },
      ranks: [
        { txt: 'Süre 3sn', dur: 3 },
        { txt: 'Hasar %34/tık', dmg: 0.34 },
        { txt: 'Her 3. tık kritik', critEvery: 3 },
        { txt: 'Menzil 22m, genişlik 1.8m, süre 3.5sn', range: 22, width: 1.8, dur: 3.5 },
      ],
    },
    {
      id: 'm_raid', stage: S, slot: 'active', name: 'Sürü Baskını', icon: '🐕', tags: ['suru'],
      kind: 'barrage', cost: 20, cd: 6, flavor: 'Basılı tut, nişan al, bırak: hayalet kurtlar bölgedeki avlara tek tek atlar; tek av kalırsa hepsi ona.',
      base: { from: 'self', seek: true, castRange: 20, r: 6, count: 4, blast: 2, delay: 0.45, gap: 0.12, dmg: 1.1, size: 0.6, knock: 4, st: [['bleed', 1]] },
      ranks: [
        { txt: '+1 kurt', count: 5 },
        { txt: 'Kanama 2', st: [['bleed', 2]] },
        { txt: 'Hasar %140', dmg: 1.4 },
        { txt: '+1 kurt, kısa sersemlik', count: 6, st: [['bleed', 2], ['stun', 0.3]] },
      ],
    },
    {
      id: 'm_totem', stage: S, slot: 'active', name: 'Uluma Totemi', icon: '🗿', tags: ['uluma'],
      kind: 'totem', cost: 24, cd: 10, flavor: 'Basılı tut, nişan al, bırak: uluyan bir totem dikersin; çevresindekileri korkutup savunmasız bırakır.',
      base: { mode: 'pulse', castRange: 16, r: 6, rate: 1.2, dur: 8, dmg: 0.6, max: 1, height: 2.2, st: [['fear', 0.6], ['vuln', 1]] },
      ranks: [
        { txt: 'Süre 10sn', dur: 10 },
        { txt: 'Alan 7.5m', r: 7.5 },
        { txt: 'Hasar %70, korku 1sn', dmg: 0.7, st: [['fear', 1], ['vuln', 1]] },
        { txt: 'Nabız 1sn, Kırılganlık 2', rate: 1.0, st: [['fear', 1], ['vuln', 2]] },
      ],
    },
    {
      id: 'm_shadow', stage: S, slot: 'active', name: 'Gölge Pençe', icon: '🌑', tags: ['ay', 'pence'],
      kind: 'blink', cost: 18, cd: 6, flavor: 'Gölgeye karışıp nişandaki avın arkasında belirirsin; ilk pençe hep kritik.',
      base: { behind: true, dist: 14, r: 3, dmg: 2.0, crit: true, splash: 0.5, iframe: 0.35, knock: 4, st: [['bleed', 2]] },
      ranks: [
        { txt: 'Mesafe 17m', dist: 17 },
        { txt: 'Hasar %250, Kanama 3', dmg: 2.5, st: [['bleed', 3]] },
        { txt: 'Bekleme 5sn', cd: 5 },
        { txt: 'Hasar %260, korkutur (Dehşet)', dmg: 2.6, st: [['bleed', 3], ['fear', 0.8]] },
      ],
    },
    {
      id: 'm_stampede', stage: S, slot: 'active', name: 'Bizon Hücumu', icon: '🦬', tags: ['suru', 'vahsi'],
      kind: 'rush', cost: 20, cd: 6,
      flavor: 'Basılı tut: toynaklarınla hızlanırsın, nişanınla yön verirsin. Yolundakileri çiğneyip yana savurursun; bıraktığında hızınla orantılı boynuz darbesi. Ağır bir düşmana çarparsan tüm hızın ona geçer.',
      base: { v0: 10, vmax: 30, accel: 30, maxT: 1.8, turn: 2.4, width: 3.2, trample: 0.9, dmg: 3.2, r: 4, knock: 14, armor: 0.35, autoHold: 0.8, st: [['bleed', 1]] },
      ranks: [
        { txt: 'Daha seri hızlanır, en yüksek hız 34', accel: 40, vmax: 34 },
        { txt: 'Darbe %420, sersemletir', dmg: 4.2, st: [['bleed', 1], ['stun', 0.6]] },
        { txt: 'Genişlik 4.2m, ezme %130', width: 4.2, trample: 1.3 },
        { txt: 'Bekleme 5sn, darbe %460', cd: 5, dmg: 4.6 },
      ],
    },

    /* ---------------- ULTIMATE ---------------- */
    {
      id: 'm_u_alpha', stage: S, slot: 'ult', name: 'Alfa Kükreyişi', icon: '👑', tags: ['uluma', 'suru'],
      kind: 'nova', cost: 0, cd: 2, flavor: 'Herkes korkudan kaçarken sürün saldırır.',
      base: { dmg: 1.5, r: 12, st: [['fear', 2.5], ['vuln', 2]], summon: { count: 3, dur: 14, hpFrac: 0.5, dmgFrac: 0.6 } },
      ranks: [
        { txt: 'Alan 13m', r: 13 },
        { txt: '+1 kurt', summon: { count: 4, dur: 14, hpFrac: 0.5, dmgFrac: 0.6 } },
        { txt: 'Hasar %250, uzun korku', dmg: 2.5, st: [['fear', 3], ['vuln', 3]] },
        { txt: '5 güçlü kurt', summon: { count: 5, dur: 18, hpFrac: 0.7, dmgFrac: 0.8 } },
      ],
    },
    {
      id: 'm_u_rage', stage: S, slot: 'ult', name: 'Vahşi Form', icon: '💢', tags: ['vahsi'],
      kind: 'stance', cost: 0, cd: 2,
      flavor: 'Tüm öfkenle dönüşürsün: pençelerin geniş yaylarla savrulur, her vuruş seni iyileştirir, her 3. vuruş çevrendeki herkesi biçer.',
      base: { dur: 8, mods: { atkSpd: 0.3, armor: 0.2, speed: 0.15 }, basic: { mult: 1.3, arc: 2.2, rangeMul: 1.3, heal: 0.08, full3: true, knock: 4, color: 0xff5a3d } },
      ranks: [
        { txt: 'Süre 9sn', dur: 9 },
        { txt: 'Vuruşlar %145, iyileşme %10', basic: { mult: 1.45, arc: 2.2, rangeMul: 1.3, heal: 0.1, full3: true, knock: 4, color: 0xff5a3d } },
        { txt: 'Vuruşlar kanatır, zırh %30', mods: { atkSpd: 0.3, armor: 0.3, speed: 0.15 },
          basic: { mult: 1.45, arc: 2.2, rangeMul: 1.3, heal: 0.1, full3: true, knock: 4, color: 0xff5a3d, st: [['bleed', 2]] } },
        { txt: 'Süre 11sn, vuruşlar %160', dur: 11,
          basic: { mult: 1.6, arc: 2.2, rangeMul: 1.3, heal: 0.1, full3: true, knock: 4, color: 0xff5a3d, st: [['bleed', 2]] } },
      ],
    },
    {
      id: 'm_u_hunt', stage: S, slot: 'ult', name: 'Ay Avı', icon: '🌕', tags: ['ay'],
      kind: 'hunt', cost: 0, cd: 2, flavor: 'Yakındaki avların her birine ışık hızıyla atlarsın.',
      base: { count: 5, dmg: 3, range: 20, st: [['bleed', 2]] },
      ranks: [
        { txt: '6 hedef', count: 6 },
        { txt: 'Hasar %400', dmg: 4 },
        { txt: '8 hedef, Kırılganlık', count: 8, st: [['bleed', 2], ['vuln', 2]] },
        { txt: 'Hasar %550', dmg: 5.5 },
      ],
    },
    {
      id: 'm_u_claws', stage: S, slot: 'ult', name: 'Pençe Kasırgası', icon: '✴️', tags: ['pence', 'vahsi'],
      kind: 'boomerang', cost: 0, cd: 2, flavor: 'Öfkeyle her yöne hilal pençeler savurursun; hepsi sana geri döner.',
      base: { dmg: 1.6, radial: true, count: 8, speed: 22, range: 12, size: 0.9, knock: 5, st: [['bleed', 2]] },
      ranks: [
        { txt: 'Hasar %190', dmg: 1.9 },
        { txt: '12 pençe', count: 12 },
        { txt: 'Kanama 3, korkutur (Dehşet)', st: [['bleed', 3], ['fear', 0.8]] },
        { txt: 'Menzil 16m, hasar %250', range: 16, dmg: 2.5 },
      ],
    },
  ]);

  EV.DATA.addPassives([
    { id: 'p_warm',   stage: S, name: 'Sıcakkanlı',     icon: '🔋', tags: ['vahsi'], max: 5, per: { energyRegen: 0.12 } },
    { id: 'p_fur',    stage: S, name: 'Kalın Kürk',     icon: '🧥', tags: ['pence'], max: 5, per: { armor: 0.05, maxHp: 0.05 } },
    { id: 'p_muscle', stage: S, name: 'Kas Gücü',       icon: '💪', tags: ['pence'], max: 5, per: { dmg: 0.1 } },
    { id: 'p_leader', stage: S, name: 'Sürü Lideri',    icon: '🐺', tags: ['suru'],  max: 5, per: { summonPower: 0.15 },
      bonus: [{ at: 3, mods: { summonCount: 1 } }, { at: 5, mods: { summonCount: 1 } }] },
    { id: 'p_leech',  stage: S, name: 'Kan Emme',       icon: '🩸', tags: ['kan'],   max: 5, per: { lifesteal: 0.025 } },
    { id: 'p_senses', stage: S, name: 'Keskin Duyular', icon: '🎯', tags: ['ay'],    max: 5, per: { crit: 0.05 } },
    { id: 'p_heart',  stage: S, name: 'Dayanıklı Kalp', icon: '❤️', tags: ['kan'],   max: 5, per: { maxHp: 0.12 } },
    { id: 'p_reflex', stage: S, name: 'Hızlı Refleks',  icon: '⏱️', tags: ['ay'],    max: 5, per: { cdr: 0.06 } },
    { id: 'p_spirit', stage: S, name: 'Avcı Ruhu',      icon: '🔥', tags: ['vahsi'], max: 5, per: { rageGain: 0.15 } },
    { id: 'p_primal', stage: S, name: 'İlkel İçgüdü',   icon: '🐗', tags: ['vahsi'], max: 5, per: { critDmg: 0.12, speed: 0.03 },
      bonus: [{ at: 3, mods: { crit: 0.05 } }] },
    { id: 'p_trail',  stage: S, name: 'Kan İzi',        icon: '👣', tags: ['kan'],   max: 5, per: { vsBleed: 0.08, statusDur: 0.05 },
      bonus: [{ at: 5, mods: { lifesteal: 0.05 } }] },
  ]);
})();
