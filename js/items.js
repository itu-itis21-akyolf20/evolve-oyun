/* ============================================================
   items.js — eşyalar, düşüş, dünya sandıkları, çanta/sandık, basma

   Yuvalar: Diş (saldırı) · Kabuk (savunma) · Organ (enerji) · Kalıntı (özel)
            Pençe (kritik/vuruş) · Kuyruk (hareket/fayda)
   Nadirlik rengi: Sıradan (gri) · Nadir (yeşil) · Değerli (mavi) ·
                   Destansı (mor) · Efsanevi (turuncu, benzersiz etki)

   Gen Özü: her öldürülen yaratık kendi tier'ı kadar öz verir
   (güçlü yaratık = daha çok öz; Apex avı büyük ödül).
   Eşyalar KALICIDIR (aşamalar arası taşınır). ilvl = aşama + nesil.

   BASMA (+0 … +9): nadirlikten ayrı. Her + tüm özellik değerlerini
   birikimli artırır (CFG.ITEMS.plusBonus). +6 ve üstünde başarısızlık
   eşyayı bir kademe düşürür. Nadirlik yükseltme ayrı bir işlemdir.
   TAKIMLAR: Değerli+ eşyalar bir takıma ait olabilir; 2 ve 4 parça bonusu.
   ============================================================ */
window.EV = window.EV || {};

EV.Items = (function () {
  'use strict';

  const U = EV.U;
  const CFG = EV.CFG;
  const R = CFG.RARITY;
  const IC = CFG.ITEMS;

  const SLOTS = [
    { id: 'fang',  name: 'Diş',     icon: '🦷', pool: ['dmg', 'critDmg', 'atkSpd', 'crit', 'lifesteal'] },
    { id: 'hide',  name: 'Kabuk',   icon: '🛡️', pool: ['maxHp', 'armor', 'hpRegen', 'reflect', 'speed'] },
    { id: 'organ', name: 'Organ',   icon: '🫀', pool: ['energyRegen', 'maxEnergy', 'cdr', 'rageGain', 'speed'] },
    { id: 'relic', name: 'Kalıntı', icon: '🔮', pool: ['statusPower', 'statusDur', 'area', 'crit', 'xpGain', 'pickup'] },
    { id: 'claw',  name: 'Pençe',   icon: '🐾', pool: ['crit', 'critDmg', 'atkSpd', 'ccDmg', 'vsBleed'] },
    { id: 'tail',  name: 'Kuyruk',  icon: '🦎', pool: ['speed', 'dashCost', 'area', 'summonPower', 'rageGain', 'pickup'] },
  ];
  const SLOT = {};
  SLOTS.forEach((s) => { SLOT[s.id] = s; });

  /* rütbe 0, ilvl 0, Sıradan, +0 için taban değer (dashCost NEGATİF = ucuz atılım) */
  const AFFIX = {
    dmg: 0.06, critDmg: 0.12, atkSpd: 0.06, crit: 0.025, lifesteal: 0.012,
    maxHp: 0.07, armor: 0.035, hpRegen: 0.0015, reflect: 0.05, speed: 0.035,
    energyRegen: 0.07, maxEnergy: 0.07, cdr: 0.03, rageGain: 0.08,
    statusPower: 0.08, statusDur: 0.05, area: 0.045, xpGain: 0.04, pickup: 0.12,
    ccDmg: 0.08, vsBleed: 0.09, summonPower: 0.08, dashCost: -0.05,
  };

  /* Aşamaya göre taban adlar; her eşya birini (bv) seçer ve kaydeder.
     Her listenin İLK adı eski sürümün adıdır (eski kayıtlar bv=0 ile aynı adı alır). */
  const BASE_NAMES = [
    {
      fang: ['Protoplazma Dikeni', 'Silika İğnesi', 'Enzim Kancası', 'Asit Sivrisi'],
      hide: ['Hücre Zarı', 'Jel Kılıf', 'Kitin Zar', 'Silis Kabuk'],
      organ: ['Mitokondri Kesesi', 'Koful Kesesi', 'Kloroplast Tanesi', 'Ribozom Kümesi'],
      relic: ['Kristal Spor', 'Işıyan Spor', 'Fosil Tohum', 'Diatom Taşı'],
      claw: ['Sil Demeti', 'Yalancı Ayak', 'Tutunma Kancası', 'Kıskaç Lifi'],
      tail: ['Kamçı', 'Titrek Kamçı', 'Sarmal Kuyrukçuk', 'Çift Kamçı'],
    },
    {
      fang: ['Kemik Diş', 'Zehir Dişi', 'Testere Diş', 'Kanca Diş'],
      hide: ['Pul Zırh', 'Kemik Plaka', 'Diken Sırt', 'Kum Derisi'],
      organ: ['Soğuk Kalp', 'Zehir Bezesi', 'Güneş Kesesi', 'Taş Mide'],
      relic: ['Güneş Taşı', 'Yumurta Kabuğu', 'Kehanet Pulu', 'Fosil Göz'],
      claw: ['Kum Pençesi', 'Kanca Tırnak', 'Taş Tırnak', 'Kazıcı Pençe'],
      tail: ['Kırbaç Kuyruk', 'Topuz Kuyruk', 'Dikenli Kuyruk', 'Kopan Kuyruk'],
    },
    {
      fang: ['Kılıç Diş', 'Azı Dişi', 'Kurt Dişi', 'Kaplan Dişi'],
      hide: ['Kalın Post', 'Ayı Kürkü', 'Kış Postu', 'Yaralı Deri'],
      organ: ['Avcı Ciğeri', 'Aslan Yüreği', 'Sıcak Kan Kesesi', 'Koşucu Ciğeri'],
      relic: ['Ay Kehribarı', 'Ata Kemiği', 'Totem Diş', 'Kehribar Göz'],
      claw: ['Kurt Pençesi', 'Ayı Pençesi', 'Vaşak Tırnağı', 'Pars Pençesi'],
      tail: ['Tilki Kuyruğu', 'Pars Kuyruğu', 'Sürü Kuyruğu', 'Yele Kuyruk'],
    },
  ];
  const PREFIX = {
    dmg: 'Keskin', critDmg: 'Parçalayan', atkSpd: 'Çevik', crit: 'Ölümcül', lifesteal: 'Kana Susamış',
    maxHp: 'Dayanıklı', armor: 'Sert', hpRegen: 'Yenilenen', reflect: 'Dikenli', speed: 'Hafif',
    energyRegen: 'Canlı', maxEnergy: 'Derin', cdr: 'Hızlı', rageGain: 'Öfkeli',
    statusPower: 'Zehirli', statusDur: 'Kalıcı', area: 'Geniş', xpGain: 'Bilge', pickup: 'Açgözlü',
    ccDmg: 'Acımasız', vsBleed: 'Yırtıcı', summonPower: 'Buyurgan', dashCost: 'Fırlayan',
  };

  /* Efsanevi benzersizler: gen kancalarıyla aynı dili konuşur
     (basicSt · hitChanceSt · critSt · onHurtSt · dashSt) + sabit stat modları.
     İlk altısının adı kayıt uyumu için DEĞİŞMEZ. */
  const UNIQUES = [
    { slot: 'fang',  name: 'Yutucunun Dişi',     desc: 'Temel saldırılar 2 Zehir bırakır.', hooks: { basicSt: [['poison', 2, 1]] } },
    { slot: 'fang',  name: 'Alfa Pençesi',       desc: 'İsabetlerin %30 ihtimalle kanatır.', hooks: { hitChanceSt: [['bleed', 1, 0.3]] } },
    { slot: 'relic', name: 'Yıldırım Çekirdeği', desc: 'Kritik vuruşlar Şok 2 bırakır.', hooks: { critSt: [['shock', 2]] } },
    { slot: 'hide',  name: 'Taş Kalp',           desc: 'Sana vuran Yavaşlama 2 yer; zırh +%8.', hooks: { onHurtSt: [['slow', 2]] }, mods: { armor: 0.08 } },
    { slot: 'organ', name: 'Kan Pınarı',         desc: 'Can çalma +%6.', hooks: {}, mods: { lifesteal: 0.06 } },
    { slot: 'organ', name: 'Rüzgar Kesesi',      desc: 'Atılım çevreyi yavaşlatır, %30 ucuzlar.', hooks: { dashSt: [['slow', 2]] }, mods: { dashCost: -0.3 } },

    { slot: 'fang',  name: 'Kemik Kıran',        desc: 'Kritikler 2 Kırılganlık bırakır; kritik hasarı +%25.', hooks: { critSt: [['vuln', 2]] }, mods: { critDmg: 0.25 } },
    { slot: 'fang',  name: 'Kor Dişi',           desc: 'Temel saldırılar %40 ihtimalle 2 Yanık bırakır; hasar +%6.', hooks: { basicSt: [['burn', 2, 0.4]] }, mods: { dmg: 0.06 } },

    { slot: 'hide',  name: 'Diken Postu',        desc: 'Sana vuran 2 Kanama yer; hasar yansıtma +%12.', hooks: { onHurtSt: [['bleed', 2]] }, mods: { reflect: 0.12 } },
    { slot: 'hide',  name: 'Ejder Pulu',         desc: 'Sana vuran 2 Yanık yer; maks. can +%10.', hooks: { onHurtSt: [['burn', 2]] }, mods: { maxHp: 0.1 } },
    { slot: 'hide',  name: 'Korku Postu',        desc: 'Sana vuran 1 sn korkar; can yenilenmesi +%0.3/sn.', hooks: { onHurtSt: [['fear', 1]] }, mods: { hpRegen: 0.003 } },

    { slot: 'organ', name: 'Öfke Bezesi',        desc: 'Kritikler 0.6 sn korkutur; öfke kazanımı +%40.', hooks: { critSt: [['fear', 0.6]] }, mods: { rageGain: 0.4 } },
    { slot: 'organ', name: 'Şimşek Kesesi',      desc: 'Atılım çevreye 2 Şok bırakır; enerji dolumu +%20.', hooks: { dashSt: [['shock', 2]] }, mods: { energyRegen: 0.2 } },

    { slot: 'relic', name: 'Veba Totemi',        desc: 'İsabetlerin %25 ihtimalle 2 Zehir bırakır; durum hasarı +%20.', hooks: { hitChanceSt: [['poison', 2, 0.25]] }, mods: { statusPower: 0.2 } },
    { slot: 'relic', name: 'Buz Gözü',           desc: 'İsabetlerin %20 ihtimalle 2 Yavaşlama bırakır; durum süresi +%25.', hooks: { hitChanceSt: [['slow', 2, 0.2]] }, mods: { statusDur: 0.25 } },
    { slot: 'relic', name: 'Kâhin Kemiği',       desc: 'Kritikler 1 Kırılganlık bırakır; deneyim +%25, toplama menzili +%60.', hooks: { critSt: [['vuln', 1]] }, mods: { xpGain: 0.25, pickup: 0.6 } },

    { slot: 'claw',  name: 'Kanlı Orak',         desc: 'İsabetlerin %35 ihtimalle kanatır; kanayanlara +%25 hasar.', hooks: { hitChanceSt: [['bleed', 1, 0.35]] }, mods: { vsBleed: 0.25 } },
    { slot: 'claw',  name: 'Gök Gürültüsü Pençesi', desc: 'Kritikler 0.5 sn sersemletir; etkisizlere +%20 hasar.', hooks: { critSt: [['stun', 0.5]] }, mods: { ccDmg: 0.2 } },
    { slot: 'claw',  name: 'Yırtıcı Tırnak',     desc: 'Temel saldırılar 1 Kanama, %30 ihtimalle 1 Kırılganlık bırakır; kritik şansı +%6.', hooks: { basicSt: [['bleed', 1, 1], ['vuln', 1, 0.3]] }, mods: { crit: 0.06 } },
    { slot: 'claw',  name: 'Buz Pençesi',        desc: 'Temel saldırılar 1 Yavaşlama bırakır; etkisizlere +%15 hasar.', hooks: { basicSt: [['slow', 1, 1]] }, mods: { ccDmg: 0.15 } },

    { slot: 'tail',  name: 'Fırtına Kuyruğu',    desc: 'Atılım çevreye 2 Şok + 1 Yavaşlama bırakır; atılım %25 ucuz.', hooks: { dashSt: [['shock', 2], ['slow', 1]] }, mods: { dashCost: -0.25 } },
    { slot: 'tail',  name: 'Kum Fırtınası',      desc: 'Atılım çevreyi 0.6 sn sersemletir; alan +%10.', hooks: { dashSt: [['stun', 0.6]] }, mods: { area: 0.1 } },
    { slot: 'tail',  name: 'Alev Kuyruğu',       desc: 'Atılım çevreye 3 Yanık bırakır; hız +%8.', hooks: { dashSt: [['burn', 3]] }, mods: { speed: 0.08 } },
    { slot: 'tail',  name: 'Sürü Anası',         desc: 'Çağrı sayısı +1, çağrı gücü +%30; sana vuran 1 Kırılganlık yer.', hooks: { onHurtSt: [['vuln', 1]] }, mods: { summonCount: 1, summonPower: 0.3 } },
    { slot: 'tail',  name: 'Gölge Kuyruk',       desc: 'Atılım yakındakileri 1.2 sn korkutur; öfke kazanımı +%25.', hooks: { dashSt: [['fear', 1.2]] }, mods: { rageGain: 0.25 } },
  ];

  /* Takımlar: aynı takımdan 2 ve 4 parça kuşanınca bonus */
  const SETS = [
    { id: 'kurt', name: 'Kurt Sürüsü', icon: '🐺', color: '#ff8a5a',
      b2: { mods: { atkSpd: 0.08, speed: 0.05 } },
      b4: { mods: { vsBleed: 0.2 }, hooks: { hitChanceSt: [['bleed', 1, 0.2]] }, desc: 'İsabetlerin %20 kanatır; kanayanlara +%20 hasar' } },
    { id: 'yilan', name: 'Yılan Kanı', icon: '🐍', color: '#8ce04a',
      b2: { mods: { statusPower: 0.15 } },
      b4: { mods: { statusDur: 0.2 }, hooks: { basicSt: [['poison', 1, 1]] }, desc: 'Temel saldırılar 1 Zehir bırakır; durum süresi +%20' } },
    { id: 'kaya', name: 'Kaya Yüreği', icon: '⛰️', color: '#d9c7a0',
      b2: { mods: { armor: 0.05, maxHp: 0.06 } },
      b4: { mods: { reflect: 0.1 }, hooks: { onHurtSt: [['stun', 0.4]] }, desc: 'Sana vuran 0.4 sn sersemler; hasar yansıtma +%10' } },
    { id: 'firtina', name: 'Fırtına Kanadı', icon: '⚡', color: '#6fc8ff',
      b2: { mods: { cdr: 0.05, energyRegen: 0.1 } },
      b4: { mods: { crit: 0.05 }, hooks: { critSt: [['shock', 1]] }, desc: 'Kritikler 1 Şok bırakır; kritik şansı +%5' } },
  ];
  const SET = {};
  SETS.forEach((s) => { SET[s.id] = s; });

  let uidSeq = 1;
  const ground = [];
  const chests = [];
  const orbGeo = new THREE.OctahedronGeometry(1, 0);
  const beamGeo = new THREE.CylinderGeometry(0.08, 0.2, 5, 6, 1, true);
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  /* =========================================================
     Üretim
     ========================================================= */
  function freshInv() {
    const equip = {};
    SLOTS.forEach((s) => { equip[s.id] = null; });
    return { bag: new Array(IC.bagSize).fill(null), chest: new Array(IC.chestSize).fill(null), equip, essence: 0 };
  }

  function rollRarity(key, boost) {
    const r = U.weightedPick(R, (x) => x[key] * (x.id >= 2 ? (boost || 1) : 1));
    return r ? r.id : 0;
  }

  const plusOf = (it) => U.clamp(it.plus | 0, 0, IC.plusMax);
  const plusMul = (p) => 1 + IC.plusBonus[U.clamp(p | 0, 0, IC.plusMax)];

  /** Özelliğin etkin değeri; plus verilirse o basma seviyesi için (önizleme). */
  function value(it, a, plus) {
    return AFFIX[a.k] * R[it.rarity].mul * (1 + 0.3 * it.ilvl) * a.roll * plusMul(plus == null ? plusOf(it) : plus);
  }

  function baseName(it) {
    const list = BASE_NAMES[Math.min(it.ilvl, BASE_NAMES.length - 1)][it.slot];
    return list[(it.bv | 0) % list.length];
  }

  function rename(it) {
    const p = plusOf(it);
    const pre = p > 0 ? '+' + p + ' ' : '';
    if (it.unique) { it.name = pre + it.unique.name; return; }
    const top = it.affixes[0];
    it.name = pre + (top ? PREFIX[top.k] + ' ' : '') + baseName(it);
  }

  function addAffix(it) {
    const pool = SLOT[it.slot].pool.filter((k) => !it.affixes.some((a) => a.k === k));
    if (!pool.length) return;
    it.affixes.push({ k: U.pick(pool), roll: U.rand(0.7, 1.0) });
  }

  function pickUnique(slot) {
    const cands = UNIQUES.filter((u) => u.slot === slot);
    return cands.length ? U.pick(cands) : null;
  }

  function rollSet(it) {
    if (it.rarity >= 2 && !it.set && Math.random() < IC.setChance) it.set = U.pick(SETS).id;
  }

  function makeItem(slot, rarity, ilvl) {
    const s = own(SLOT, slot) ? slot : U.pick(SLOTS).id;
    const r = U.clamp(Math.round(Number(rarity)) || 0, 0, R.length - 1);
    const il = U.clamp(Number(ilvl) | 0, 0, 12);
    const it = { uid: uidSeq++, slot: s, rarity: r, ilvl: il, plus: 0, bv: Math.floor(Math.random() * 4), set: null, affixes: [], unique: null, name: '' };
    for (let i = 0; i < R[r].affixes; i++) addAffix(it);
    if (r === 4) it.unique = pickUnique(s);
    rollSet(it);
    rename(it);
    return it;
  }

  const ilvlOf = (game) => Math.min(game.stageIndex + game.generation, 12);

  function randomItem(game, key, boost) {
    return makeItem(U.pick(SLOTS).id, rollRarity(key, boost), ilvlOf(game));
  }

  /* =========================================================
     Statlar ve kancalar (kuşanılanlar)
     ========================================================= */
  function addMods(out, src) {
    if (!src) return;
    for (const k in src) out[k] = (out[k] || 0) + src[k];
  }

  function equipped(game) {
    const eq = (game.inv && game.inv.equip) || {};
    return SLOTS.map((s) => eq[s.id]).filter((it) => it && it.slot && own(SLOT, it.slot));
  }

  function setCount(game, id) {
    return equipped(game).filter((it) => it.set === id).length;
  }

  /** Etkin takım bonusları: [{ set, n, tiers: [b2, b4?] }] */
  function activeSets(game) {
    const out = [];
    SETS.forEach((s) => {
      const n = setCount(game, s.id);
      if (n >= 2) out.push({ set: s, n, tiers: n >= 4 ? [s.b2, s.b4] : [s.b2] });
    });
    return out;
  }

  function mods(game) {
    const out = {};
    equipped(game).forEach((it) => {
      it.affixes.forEach((a) => { out[a.k] = (out[a.k] || 0) + value(it, a); });
      if (it.unique) addMods(out, it.unique.mods);
    });
    activeSets(game).forEach((a) => a.tiers.forEach((t) => addMods(out, t.mods)));
    return out;
  }

  function hooks(game) {
    const out = [];
    equipped(game).forEach((it) => { if (it.unique && it.unique.hooks) out.push(it.unique.hooks); });
    activeSets(game).forEach((a) => a.tiers.forEach((t) => { if (t.hooks) out.push(t.hooks); }));
    return out;
  }

  /* =========================================================
     Dünyadaki eşyalar ve sandıklar
     ========================================================= */
  function dropAt(game, pos, it, quiet) {
    const color = new THREE.Color(R[it.rarity].color);
    const g = new THREE.Group();
    const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color }));
    orb.scale.setScalar(0.42 + Math.max(0, it.rarity - 2) * 0.1);
    orb.position.y = 0.8;
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 + it.rarity * 0.08, depthWrite: false }));
    const tall = it.rarity >= 3 ? 1.9 : 1;          // destansı/efsanevi: uzaktan görünen yüksek ışık
    beam.scale.set(tall, tall, tall);
    beam.position.y = 2.6 * tall;
    g.add(orb, beam);
    g.position.set(pos.x + U.rand(-0.8, 0.8), EV.World.groundY(pos.x, pos.z), pos.z + U.rand(-0.8, 0.8));
    game.scene.add(g);
    ground.push({ g, orb, it, t: 0, life: 240 });
    if (it.rarity >= 2 && !quiet) EV.UI.toast('<span style="color:' + R[it.rarity].color + '">' + R[it.rarity].name + ' eşya düştü: ' + it.name + '</span>', '#fff', 1600);
  }

  function spawnChests(game) {
    clearChests(game);
    const covers = EV.World.covers;
    covers.forEach((c, i) => {
      if (i % 2) return;                                // her iki saklanma yerinden birinde
      const g = new THREE.Group();
      const woodCol = game.stage().kind === 'cell' ? 0x6fd8c0 : 0x8a5a2a;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.9), new THREE.MeshPhongMaterial({ color: woodCol, flatShading: true }));
      box.position.y = 0.4;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.28, 0.96), new THREE.MeshPhongMaterial({ color: 0xffd23d, flatShading: true }));
      lid.position.y = 0.9;
      g.add(box, lid);
      g.position.set(c.x, EV.World.groundY(c.x, c.z), c.z);
      g.rotation.y = U.rand(0, 6);
      game.scene.add(g);
      chests.push({ g, lid, opened: false });
    });
  }

  function openChest(game, ch) {
    ch.opened = true;
    ch.lid.rotation.x = -1.1;
    ch.lid.position.z = -0.35;
    const n = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) dropAt(game, ch.g.position, randomItem(game, 'drop', 3));
    const ess = 20 + game.stageIndex * 15 + game.generation * 10;
    game.inv.essence += ess;
    EV.FX.ring(ch.g.position, 0xffd23d, 5, 0.5);
    EV.UI.toast('📦 Sandık açıldı · +' + ess + ' Gen Özü', '#ffd23d', 1800);
    U.audio.levelUp();
  }

  function update(game, dt) {
    const P = game.player;
    const pp = P.group.position;
    for (let i = ground.length - 1; i >= 0; i--) {
      const o = ground[i];
      o.t += dt;
      o.life -= dt;
      o.orb.rotation.y += dt * 2;
      o.orb.position.y = 0.8 + Math.sin(o.t * 2.5) * 0.15;
      const d = o.g.position.distanceTo(pp);
      if (o.life <= 0 || d > 160) { removeGround(game, i); continue; }
      if (P.alive && d < 2.2) {
        if (addTo(game.inv.bag, o.it)) {
          EV.UI.toast('<span style="color:' + R[o.it.rarity].color + '">+ ' + o.it.name + '</span> <span class="sub">(Tab)</span>', '#fff', 1400);
          U.audio.eat();
          removeGround(game, i);
        } else if (!o.warned) {
          o.warned = true;
          EV.UI.toast('Çanta dolu — Tab ile sandığa taşı ya da parçala', '#ff8a8a', 1800);
        }
      }
    }
    for (let i = 0; i < chests.length; i++) {
      const ch = chests[i];
      if (!ch.opened && P.alive && ch.g.position.distanceTo(pp) < 2.4) openChest(game, ch);
    }
  }

  function removeGround(game, i) {
    const o = ground[i];
    game.scene.remove(o.g);
    o.g.children.forEach((m) => m.material.dispose());
    ground.splice(i, 1);
  }

  function clearChests(game) {
    chests.forEach((c) => {
      game.scene.remove(c.g);
      c.g.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
    });
    chests.length = 0;
  }

  /** Aşama değişirken yerde kalan eşyalar kaybolmaz: çantaya, o doluysa sandığa. */
  function clear(game, discard) {
    let lost = 0;
    for (let i = ground.length - 1; i >= 0; i--) {
      const it = ground[i].it;
      if (!discard && game.inv && !addTo(game.inv.bag, it) && !addTo(game.inv.chest, it)) lost++;
      removeGround(game, i);
    }
    if (lost) EV.UI.toast('Çanta ve sandık dolu — yerdeki ' + lost + ' eşya kayboldu', '#ff8a8a', 2500);
    clearChests(game);
  }

  /* =========================================================
     Öldürme ödülü
     ========================================================= */
  const KILL_TITLE = { apex: '☠️ APEX AVLANDI', nemesis: '👤 GEÇMİŞ BENLİĞİN YENİLDİ', treasure: '💰 HAZİNE KOŞUCUSU' };

  function killKind(e) {
    if (e.isAlpha) return 'alpha';
    if (e.isApex) return 'apex';
    if (e.isNemesis) return 'nemesis';
    if (e.isMini) return 'mini';
    if (e.isTreasure) return 'treasure';
    return null;
  }

  const genMul = (game) => 1 + (game.generation || 0) * IC.genEss;

  /** Büyük avın ödülünü herkesin göreceği şekilde duyurur (DEVRİLDİ yazısından sonra tekrar). */
  function announce(game, kind, pos, out) {
    const lines = out.items.map((it) => '<span style="color:' + R[it.rarity].color + '">' + R[it.rarity].name + ': ' + it.name + '</span>');
    const html = '<b>' + KILL_TITLE[kind] + '</b><br>+' + U.fmt(out.essence) + ' 🧬 Gen Özü · ' + out.items.length + ' eşya düştü<br>' + lines.join('<br>');
    EV.UI.toast(html, '#ffd83d', 4200);
    setTimeout(() => EV.UI.toast(html, '#ffd83d', 4200), 1600);
    if (EV.FX && EV.FX.ring) { EV.FX.ring(pos, 0xffd23d, 9, 0.9); EV.FX.ring(pos, 0xff9a2a, 5, 0.6); }
    if (EV.UI.floatText && game.camera) EV.UI.floatText(pos.clone().setY(pos.y + 3), '+' + U.fmt(out.essence) + ' 🧬', '#ffd83d');
    U.audio.levelUp();
  }

  function rewardDrops(game, K, pos, quiet) {
    return K.drops.map((d) => {
      let r = Math.max(rollRarity('drop', K.boost), d.min || 0);
      if (d.leg && Math.random() < d.leg) r = 4;
      const it = makeItem(U.pick(SLOTS).id, r, ilvlOf(game));
      dropAt(game, pos, it, quiet);
      return it;
    });
  }

  /**
   * Öldürme ödülü: Gen Özü (tier kadar, nesille artar) + düşük ihtimalle eşya.
   * Özel avlar (Alfa · Apex · Geçmiş Benlik · Mini boss · Hazine) CFG.ITEMS.kill tablosundan.
   * Dönüş: { kind, essence, items } (ödül yoksa null).
   */
  function onKill(game, e) {
    if (!e || e.noLoot || !game.inv) return null;
    const pos = e.group ? e.group.position : game.player.group.position;
    const kind = killKind(e);
    const out = { kind, essence: 0, items: [] };
    if (kind) {
      const K = IC.kill[kind];
      out.essence = Math.round(K.ess * genMul(game));
      game.inv.essence += out.essence;
      out.items = rewardDrops(game, K, pos, K.announce);
      if (K.announce) announce(game, kind, pos, out);
      return out;
    }
    const tier = ((e.def && e.def.tier) || 1) + ((e.variant || 1) - 1);
    let ess = tier;
    let chance = IC.dropChance * tier;
    let boost = 1;
    if (e.isChampion) {
      ess *= IC.champion.essMul;
      chance = Math.min(1, chance * IC.champion.dropMul);
      boost = IC.champion.boost;
    }
    out.essence = Math.round(ess * genMul(game));
    game.inv.essence += out.essence;
    if (Math.random() < chance) {
      const it = randomItem(game, 'drop', boost);
      dropAt(game, pos, it);
      out.items.push(it);
    }
    return out;
  }

  /* =========================================================
     Çanta / sandık işlemleri
     ========================================================= */
  function addTo(arr, it) {
    const i = arr.indexOf(null);
    if (i < 0) return false;
    arr[i] = it;
    return true;
  }

  const isStore = (w) => w === 'bag' || w === 'chest';

  /** where/idx doğrulanmış erişim: bag/chest (tamsayı) ya da equip (yuva kimliği). */
  function itemAt(inv, where, idx) {
    if (!inv) return null;
    if (where === 'equip') return own(SLOT, idx) ? inv.equip[idx] || null : null;
    if (!isStore(where)) return null;
    const arr = inv[where];
    return Number.isInteger(idx) && idx >= 0 && idx < arr.length ? arr[idx] || null : null;
  }

  function setAt(inv, where, idx, it) {
    if (where === 'equip') inv.equip[idx] = it;
    else inv[where][idx] = it;
  }

  function equipFrom(game, where, idx) {
    const inv = game.inv;
    if (!isStore(where)) return false;
    const it = itemAt(inv, where, idx);
    if (!it) return false;
    const old = inv.equip[it.slot];
    inv.equip[it.slot] = it;
    inv[where][idx] = old || null;
    changed(game);
    return true;
  }

  function unequip(game, slot) {
    const inv = game.inv;
    const it = itemAt(inv, 'equip', slot);
    if (!it || !addTo(inv.bag, it)) return false;
    inv.equip[slot] = null;
    changed(game);
    return true;
  }

  function move(game, from, idx, to) {
    const inv = game.inv;
    if (!isStore(from) || !isStore(to)) return false;
    const it = itemAt(inv, from, idx);
    if (!it || !addTo(inv[to], it)) return false;
    inv[from][idx] = null;
    return true;
  }

  /* ---------------- basma (+0 … +9) ---------------- */
  /** hedef seviyeye (p+1) çıkma bedeli: seviye, nadirlik ve eşya seviyesiyle büyür */
  function plusStepCost(it, p) {
    return Math.round(IC.plusCost[p] * IC.plusRarityMul[it.rarity] * (1 + IC.plusIlvl * it.ilvl));
  }

  function plusCost(it) {
    const p = plusOf(it);
    return p >= IC.plusMax ? Infinity : plusStepCost(it, p);
  }

  function plusInfo(it) {
    const p = plusOf(it);
    const max = p >= IC.plusMax;
    return {
      plus: p, max, next: max ? p : p + 1,
      chance: max ? 0 : IC.plusChance[p],
      cost: plusCost(it),
      risk: !max && p >= IC.plusDropFrom,
      bonus: IC.plusBonus[p], nextBonus: IC.plusBonus[max ? p : p + 1],
    };
  }

  /**
   * Basma denemesi. Öz her durumda harcanır; başarıda +1,
   * +6 ve üstündeyken başarısızlık bir kademe düşürür.
   * Dönüş: { ok, result: 'success'|'fail'|'drop'|'max'|'poor'|'none', from, to, cost, chance }
   */
  function enhance(game, where, idx) {
    const inv = game.inv;
    const it = itemAt(inv, where, idx);
    const res = { ok: false, result: 'none', from: 0, to: 0, cost: 0, chance: 0 };
    if (!it) return res;
    const info = plusInfo(it);
    res.from = res.to = info.plus;
    if (info.max) { res.result = 'max'; return res; }
    res.cost = info.cost;
    res.chance = info.chance;
    if (!(inv.essence >= info.cost)) { res.result = 'poor'; return res; }
    inv.essence -= info.cost;
    if (Math.random() < info.chance) {
      it.plus = info.plus + 1;
      res.ok = true;
      res.result = 'success';
      if (it.plus >= 7) U.audio.evolve(); else U.audio.levelUp();
    } else if (info.risk) {
      it.plus = info.plus - 1;
      res.result = 'drop';
      U.audio.die();
    } else {
      res.result = 'fail';
      U.audio.hurt();
    }
    res.to = it.plus;
    rename(it);
    if (where === 'equip') changed(game);
    return res;
  }

  /* ---------------- parçala / üret / nadirlik ---------------- */
  function salvageValue(it) {
    let spent = 0;
    for (let p = 0; p < plusOf(it); p++) spent += plusStepCost(it, p);
    return Math.round(IC.salvage[it.rarity] * (1 + it.ilvl * 0.25)) + Math.round(spent * IC.plusRefund);
  }

  function salvage(game, where, idx) {
    const inv = game.inv;
    const it = itemAt(inv, where, idx);
    if (!it) return 0;
    const v = salvageValue(it);
    setAt(inv, where, idx, null);
    if (where === 'equip') changed(game);
    inv.essence += v;
    return v;
  }

  function craft(game, slot) {
    const inv = game.inv;
    if (!own(SLOT, slot)) return null;
    if (inv.essence < IC.craftCost) return null;
    if (inv.bag.indexOf(null) < 0) return null;
    inv.essence -= IC.craftCost;
    const it = makeItem(slot, rollRarity('craft', 1), ilvlOf(game));
    addTo(inv.bag, it);
    U.audio.evolve();
    return it;
  }

  function upgradeCost(it) { return it.rarity >= 4 ? Infinity : Math.round(IC.upgradeCost[it.rarity] * (1 + it.ilvl * 0.2)); }

  /** Nadirlik yükseltme (basmadan ayrı): + seviyesi korunur. */
  function upgrade(game, where, idx) {
    const inv = game.inv;
    const it = itemAt(inv, where, idx);
    if (!it || it.rarity >= 4) return false;
    const cost = upgradeCost(it);
    if (inv.essence < cost) return false;
    inv.essence -= cost;
    it.rarity++;
    while (it.affixes.length < R[it.rarity].affixes) addAffix(it);
    if (it.rarity === 4 && !it.unique) it.unique = pickUnique(it.slot);
    rollSet(it);
    rename(it);
    if (where === 'equip') changed(game);
    U.audio.levelUp();
    return true;
  }

  function changed(game) {
    EV.Build.recompute(game);
  }

  /** Özellik satırları (etkin değerler); plus verilirse o seviye için. */
  function affixText(it, plus) {
    return it.affixes.map((a) => EV.DATA.modText(a.k, value(it, a, plus)));
  }

  function describe(it) {
    const lines = affixText(it);
    if (it.unique) lines.push('★ ' + it.unique.desc);
    if (it.set && SET[it.set]) lines.push(SET[it.set].icon + ' ' + SET[it.set].name + ' takımı');
    return lines;
  }

  /* ---------------- kayıt ---------------- */
  function serialize(inv) {
    const s = (it) => (it ? { slot: it.slot, rarity: it.rarity, ilvl: it.ilvl, plus: plusOf(it), bv: it.bv | 0, set: it.set || null,
      affixes: it.affixes, unique: it.unique ? it.unique.name : null } : null);
    const equip = {};
    SLOTS.forEach((sl) => { equip[sl.id] = s(inv.equip[sl.id]); });
    return { bag: inv.bag.map(s), chest: inv.chest.map(s), equip, essence: inv.essence };
  }

  const intIn = (v, a, b) => U.clamp(Math.round(Number(v)) || 0, a, b);

  /** Kayıttan eşya: her alan doğrulanır/kırpılır; bozuk eşya atılır ama kayıt çökmez.
      Eski kayıtlar (plus/bv/set yok) +0, ilk taban ad ve takımsız yüklenir. */
  function revive(d) {
    if (!d || typeof d !== 'object' || !own(SLOT, d.slot)) return null;
    const rar = intIn(d.rarity, 0, 4);
    const it = { uid: uidSeq++, slot: d.slot, rarity: rar, ilvl: U.clamp(Number(d.ilvl) | 0, 0, 12),
      plus: intIn(d.plus, 0, IC.plusMax), bv: intIn(d.bv, 0, 3), set: null, affixes: [], unique: null, name: '' };
    const list = Array.isArray(d.affixes) ? d.affixes : [];
    for (let i = 0; i < list.length && it.affixes.length < R[rar].affixes; i++) {
      const a = list[i];
      if (!a || !own(AFFIX, a.k) || !SLOT[it.slot].pool.includes(a.k) || it.affixes.some((x) => x.k === a.k)) continue;
      it.affixes.push({ k: a.k, roll: U.clamp(Number(a.roll) || 0.85, 0.7, 1) });
    }
    while (it.affixes.length < R[rar].affixes) addAffix(it);
    if (rar === 4) {
      const cands = UNIQUES.filter((u) => u.slot === it.slot);
      it.unique = cands.find((u) => u.name === d.unique) || (cands.length ? U.pick(cands) : null);
    }
    if (rar >= 2 && own(SET, d.set)) it.set = d.set;
    rename(it);
    return it;
  }

  function deserialize(d) {
    const inv = freshInv();
    if (!d || typeof d !== 'object') return inv;
    const arr = (x) => (Array.isArray(x) ? x : []);
    arr(d.bag).slice(0, IC.bagSize).forEach((x, i) => { inv.bag[i] = revive(x); });
    arr(d.chest).slice(0, IC.chestSize).forEach((x, i) => { inv.chest[i] = revive(x); });
    const eq = d.equip && typeof d.equip === 'object' ? d.equip : {};
    SLOTS.forEach((s) => {
      const it = revive(eq[s.id]);
      if (!it) return;
      if (it.slot === s.id) inv.equip[s.id] = it;
      else if (!addTo(inv.bag, it)) addTo(inv.chest, it);      // yanlış yuvadaki eşya kaybolmasın
    });
    const e = Number(d.essence);
    inv.essence = Number.isFinite(e) ? U.clamp(e, 0, 1e9) : 0;
    return inv;
  }

  return {
    SLOTS, SLOT, UNIQUES, SETS, SET, AFFIX,
    freshInv, makeItem, mods, hooks, onKill, dropAt, spawnChests, update, clear,
    equipFrom, unequip, move, salvage, salvageValue, craft, upgrade, upgradeCost,
    enhance, plusCost, plusInfo, setCount, activeSets,
    describe, affixText, serialize, deserialize, value,
    get groundCount() { return ground.length; }, get chestCount() { return chests.length; },
  };
})();
