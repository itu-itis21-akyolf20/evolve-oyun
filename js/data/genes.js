/* ============================================================
   data/genes.js — GENLER (kalıcı) ve VÜCUT PARÇALARI

   Genler: evrimde 3 genden 1'i seçilir, oyun sonuna kadar kalır.
     Teklif, o aşamada kullandığın etiketlere göre ağırlıklandırılır.
   Parçalar: aşamada en çok yatırım yaptığın 2 etiketin parçası
     bedenine eklenir, sonraki bedenlerde de görünür (Spore gibi).

   Gen kancaları:
     mods         kalıcı stat
     basicSt      temel saldırı isabetinde [durum, yük, şans]
     hitChanceSt  herhangi bir isabette [durum, yük, şans]
     critSt       kritik vuruşta [durum, yük]
     onHurtSt     sana yakından vurana [durum, yük]
     dashSt       atılım yaptığında çevredekilere [durum, yük]
   ============================================================ */
(function () {
  'use strict';

  EV.DATA.addGenes([
    /* ---------------- hücreden gelen genler ---------------- */
    { id: 'g_venom', stage: 0, name: 'Zehir Kesesi', icon: '🧪', tags: ['zehir'],
      desc: 'Temel saldırıların Zehir bırakır, durum hasarı +%10.',
      mods: { statusPower: 0.1 }, basicSt: [['poison', 1, 1]] },
    { id: 'g_shock', stage: 0, name: 'Elektrik Zarı', icon: '⚡', tags: ['elektrik'],
      desc: 'Sana yakından vuran Şok 2 yer. Enerji dolumu +%10.',
      mods: { energyRegen: 0.1 }, onHurtSt: [['shock', 2]] },
    { id: 'g_acid', stage: 0, name: 'Asit Salgısı', icon: '🟡', tags: ['asit'],
      desc: 'Her isabetin %20 ihtimalle Kırılganlık bırakır.',
      mods: {}, hitChanceSt: [['vuln', 1, 0.2]] },
    { id: 'g_whip', stage: 0, name: 'Kamçı Kası', icon: '🦵', tags: ['fiziksel'],
      desc: 'Hız +%8, atılım %25 daha az enerji harcar.',
      mods: { speed: 0.08, dashCost: -0.25 } },
    { id: 'g_sticky', stage: 0, name: 'Yapışkan Zar', icon: '🕸️', tags: ['yapiskan'],
      desc: 'Sana yakından vuran Yavaşlama 2 yer. Zırh +%4.',
      mods: { armor: 0.04 }, onHurtSt: [['slow', 2]] },
    { id: 'g_split', stage: 0, name: 'Bölünme Geni', icon: '🧬', tags: ['bolunme'],
      desc: 'Tüm çağrılar +1 ve %20 daha güçlü.',
      mods: { summonCount: 1, summonPower: 0.2 } },
    { id: 'g_thorn', stage: 0, name: 'Diken Zarı', icon: '🌵', tags: ['zar', 'fiziksel'],
      desc: 'Yakın dövüş hasarının %15\'ini yansıtır. Maks. can +%5.',
      mods: { reflect: 0.15, maxHp: 0.05 } },

    /* ---------------- sürüngenden gelen genler ---------------- */
    { id: 'g_bone', stage: 1, name: 'Kemik Kası', icon: '🦴', tags: ['kemik'],
      desc: 'Hasar +%10; temel saldırılar %35 ihtimalle kanatır.',
      mods: { dmg: 0.1 }, basicSt: [['bleed', 1, 0.35]] },
    { id: 'g_sun', stage: 1, name: 'Güneş Kanı', icon: '☀️', tags: ['gunes'],
      desc: 'Kritik vuruşlar Yanık 2 bırakır. Can yenilenmesi.',
      mods: { hpRegen: 0.003 }, critSt: [['burn', 2]] },
    { id: 'g_scale', stage: 1, name: 'Pul Zırhı', icon: '🛡️', tags: ['pul'],
      desc: 'Zırh +%10, maks. can +%5.',
      mods: { armor: 0.1, maxHp: 0.05 } },
    { id: 'g_sand', stage: 1, name: 'Kum Gözü', icon: '⏳', tags: ['kum'],
      desc: 'İsabetlerin %25 ihtimalle yavaşlatır. Alan +%8.',
      mods: { area: 0.08 }, hitChanceSt: [['slow', 1, 0.25]] },
    { id: 'g_hunter', stage: 1, name: 'Avcı Beyni', icon: '🎯', tags: ['avci'],
      desc: 'Kritik şansı +%8, kritik hasarı +%15.',
      mods: { crit: 0.08, critDmg: 0.15 } },
    { id: 'g_cold', stage: 1, name: 'Soğukkanlılık', icon: '🔋', tags: ['pul', 'zehir'],
      desc: 'Maks. enerji +%15, enerji dolumu +%8.',
      mods: { maxEnergy: 0.15, energyRegen: 0.08 } },

    /* ---------------- memeliden gelen genler (sonsuz mod) ---------------- */
    { id: 'g_blood', stage: 2, name: 'Kan Emme Geni', icon: '🩸', tags: ['kan'],
      desc: 'Can çalma +%5.', mods: { lifesteal: 0.05 } },
    { id: 'g_pack', stage: 2, name: 'Sürü Geni', icon: '🐺', tags: ['suru'],
      desc: 'Çağrılar +1 ve %15 daha güçlü.', mods: { summonCount: 1, summonPower: 0.15 } },
    { id: 'g_howl', stage: 2, name: 'Uluma Geni', icon: '🌕', tags: ['uluma'],
      desc: 'Atılım yaptığında çevrendekiler 0.8sn korkar.',
      mods: {}, dashSt: [['fear', 0.8]] },
    { id: 'g_moon', stage: 2, name: 'Ay Geni', icon: '🌙', tags: ['ay'],
      desc: 'Kritik hasarı +%30.', mods: { critDmg: 0.3 } },
    { id: 'g_wild', stage: 2, name: 'Vahşi Kalp', icon: '💢', tags: ['vahsi', 'pence'],
      desc: 'Öfke kazanımı +%30, hasar +%5.', mods: { rageGain: 0.3, dmg: 0.05 } },
  ]);

  /* ---------------------------------------------------------
     VÜCUT PARÇALARI — etiket başına bir parça.
     visual: creature.js'in tanıdığı ek parça kimliği.
     --------------------------------------------------------- */
  EV.DATA.addParts([
    { tag: 'zehir',    visual: 'sacs',    name: 'Zehir Keseleri',  icon: '🧪', mods: { statusPower: 0.05 } },
    { tag: 'elektrik', visual: 'stripes', name: 'Elektrik Şeritleri', icon: '⚡', mods: { energyRegen: 0.05 } },
    { tag: 'asit',     visual: 'glands',  name: 'Asit Bezleri',    icon: '🟡', mods: { dmg: 0.03 } },
    { tag: 'fiziksel', visual: 'spikes',  name: 'Sırt Dikenleri',  icon: '🌵', mods: { armor: 0.03 } },
    { tag: 'yapiskan', visual: 'bumps',   name: 'Yapışkan Kabarcıklar', icon: '🕸️', mods: { maxHp: 0.04 } },
    { tag: 'bolunme',  visual: 'buds',    name: 'Tomurcuklar',     icon: '🧬', mods: { summonPower: 0.08 } },
    { tag: 'zar',      visual: 'crest',   name: 'Zar Yelesi',      icon: '🫧', mods: { armor: 0.03 } },
    { tag: 'kemik',    visual: 'plates',  name: 'Kemik Plakalar',  icon: '🦴', mods: { armor: 0.04 } },
    { tag: 'gunes',    visual: 'sunCrest', name: 'Güneş Tepeliği', icon: '☀️', mods: { statusPower: 0.04 } },
    { tag: 'kum',      visual: 'frills',  name: 'Kum Yakası',      icon: '⏳', mods: { area: 0.04 } },
    { tag: 'avci',     visual: 'horns',   name: 'Boynuzlar',       icon: '🦌', mods: { crit: 0.02 } },
    { tag: 'pul',      visual: 'scutes',  name: 'Sırt Pulları',    icon: '🐢', mods: { maxHp: 0.04 } },
    { tag: 'pence',    visual: 'claws',   name: 'Pençeler',        icon: '🐾', mods: { dmg: 0.03 } },
    { tag: 'kan',      visual: 'redStripes', name: 'Kan Çizgileri', icon: '🩸', mods: { lifesteal: 0.01 } },
    { tag: 'uluma',    visual: 'mane',    name: 'Yele',            icon: '🦁', mods: { rageGain: 0.05 } },
    { tag: 'suru',     visual: 'tuft',    name: 'Sürü Tüyü',       icon: '🐺', mods: { summonPower: 0.06 } },
    { tag: 'ay',       visual: 'silver',  name: 'Gümüş Kürk',      icon: '🌙', mods: { crit: 0.02 } },
    { tag: 'vahsi',    visual: 'tusks',   name: 'Azı Dişleri',     icon: '🐗', mods: { dmg: 0.03 } },
  ]);
})();
