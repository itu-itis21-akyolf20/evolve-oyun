/* ============================================================
   items.js — eşyalar, düşüş, dünya sandıkları, çanta/sandık, basma

   Yuvalar: Diş (saldırı) · Kabuk (savunma) · Organ (enerji) · Kalıntı (özel)
   Nadirlik rengi: Sıradan (gri) · Nadir (yeşil) · Değerli (mavi) ·
                   Destansı (mor) · Efsanevi (turuncu, benzersiz etki)

   Gen Özü: her öldürülen yaratık kendi tier'ı kadar öz verir
   (güçlü yaratık = daha çok öz). Basma pahalıdır: bir aşamada ~2-3.
   Eşyalar KALICIDIR (aşamalar arası taşınır). ilvl = aşama + nesil;
   yeni aşamanın eşyaları daha güçlü olur, eskiler zamanla yer değiştirir.
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
  ];
  const SLOT = {};
  SLOTS.forEach((s) => { SLOT[s.id] = s; });

  /* rütbe 0, ilvl 0, Sıradan için taban değer */
  const AFFIX = {
    dmg: 0.06, critDmg: 0.12, atkSpd: 0.06, crit: 0.025, lifesteal: 0.012,
    maxHp: 0.07, armor: 0.035, hpRegen: 0.0015, reflect: 0.05, speed: 0.035,
    energyRegen: 0.07, maxEnergy: 0.07, cdr: 0.03, rageGain: 0.08,
    statusPower: 0.08, statusDur: 0.05, area: 0.045, xpGain: 0.04, pickup: 0.12,
  };

  const BASE_NAME = [
    { fang: 'Protoplazma Dikeni', hide: 'Hücre Zarı', organ: 'Mitokondri Kesesi', relic: 'Kristal Spor' },
    { fang: 'Kemik Diş', hide: 'Pul Zırh', organ: 'Soğuk Kalp', relic: 'Güneş Taşı' },
    { fang: 'Kılıç Diş', hide: 'Kalın Post', organ: 'Avcı Ciğeri', relic: 'Ay Kehribarı' },
  ];
  const PREFIX = {
    dmg: 'Keskin', critDmg: 'Parçalayan', atkSpd: 'Çevik', crit: 'Ölümcül', lifesteal: 'Kana Susamış',
    maxHp: 'Dayanıklı', armor: 'Sert', hpRegen: 'Yenilenen', reflect: 'Dikenli', speed: 'Hafif',
    energyRegen: 'Canlı', maxEnergy: 'Derin', cdr: 'Hızlı', rageGain: 'Öfkeli',
    statusPower: 'Zehirli', statusDur: 'Kalıcı', area: 'Geniş', xpGain: 'Bilge', pickup: 'Açgözlü',
  };

  /* Efsanevi benzersizler: gen kancalarıyla aynı dili konuşur */
  const UNIQUES = [
    { slot: 'fang',  name: 'Yutucunun Dişi',     desc: 'Temel saldırılar 2 Zehir bırakır.', hooks: { basicSt: [['poison', 2, 1]] } },
    { slot: 'fang',  name: 'Alfa Pençesi',       desc: 'İsabetlerin %30 ihtimalle kanatır.', hooks: { hitChanceSt: [['bleed', 1, 0.3]] } },
    { slot: 'relic', name: 'Yıldırım Çekirdeği', desc: 'Kritik vuruşlar Şok 2 bırakır.', hooks: { critSt: [['shock', 2]] } },
    { slot: 'hide',  name: 'Taş Kalp',           desc: 'Sana vuran Yavaşlama 2 yer; zırh +%8.', hooks: { onHurtSt: [['slow', 2]] }, mods: { armor: 0.08 } },
    { slot: 'organ', name: 'Kan Pınarı',         desc: 'Can çalma +%6.', hooks: {}, mods: { lifesteal: 0.06 } },
    { slot: 'organ', name: 'Rüzgar Kesesi',      desc: 'Atılım çevreyi yavaşlatır, %30 ucuzlar.', hooks: { dashSt: [['slow', 2]] }, mods: { dashCost: -0.3 } },
  ];

  let uidSeq = 1;
  const ground = [];
  const chests = [];
  const orbGeo = new THREE.OctahedronGeometry(1, 0);
  const beamGeo = new THREE.CylinderGeometry(0.08, 0.2, 5, 6, 1, true);

  /* =========================================================
     Üretim
     ========================================================= */
  function freshInv() {
    return { bag: new Array(IC.bagSize).fill(null), chest: new Array(IC.chestSize).fill(null),
      equip: { fang: null, hide: null, organ: null, relic: null }, essence: 0 };
  }

  function rollRarity(key, boost) {
    const r = U.weightedPick(R, (x) => x[key] * (x.id >= 2 ? (boost || 1) : 1));
    return r ? r.id : 0;
  }

  function value(it, a) {
    return AFFIX[a.k] * R[it.rarity].mul * (1 + 0.3 * it.ilvl) * a.roll;
  }

  function rename(it) {
    if (it.unique) { it.name = it.unique.name; return; }
    const base = BASE_NAME[Math.min(it.ilvl, 2)][it.slot];
    const top = it.affixes[0];
    it.name = (top ? PREFIX[top.k] + ' ' : '') + base;
  }

  function addAffix(it) {
    const pool = SLOT[it.slot].pool.filter((k) => !it.affixes.some((a) => a.k === k));
    if (!pool.length) return;
    it.affixes.push({ k: U.pick(pool), roll: U.rand(0.7, 1.0) });
  }

  function makeItem(slot, rarity, ilvl) {
    const it = { uid: uidSeq++, slot, rarity, ilvl, affixes: [], unique: null, name: '' };
    const n = R[rarity].affixes;
    for (let i = 0; i < n; i++) addAffix(it);
    if (rarity === 4) {
      const cands = UNIQUES.filter((u) => u.slot === slot);
      it.unique = cands.length ? U.pick(cands) : null;
    }
    rename(it);
    return it;
  }

  function randomItem(game, key, boost) {
    return makeItem(U.pick(SLOTS).id, rollRarity(key, boost), ilvlOf(game));
  }

  const ilvlOf = (game) => Math.min(game.stageIndex + game.generation, 12);

  /* =========================================================
     Statlar ve kancalar (kuşanılanlar)
     ========================================================= */
  function mods(game) {
    const out = {};
    const eq = game.inv.equip;
    for (const s in eq) {
      const it = eq[s];
      if (!it) continue;
      it.affixes.forEach((a) => { out[a.k] = (out[a.k] || 0) + value(it, a); });
      if (it.unique && it.unique.mods) for (const k in it.unique.mods) out[k] = (out[k] || 0) + it.unique.mods[k];
    }
    return out;
  }

  function hooks(game) {
    const out = [];
    const eq = game.inv.equip;
    for (const s in eq) if (eq[s] && eq[s].unique) out.push(eq[s].unique.hooks);
    return out;
  }

  /* =========================================================
     Dünyadaki eşyalar ve sandıklar
     ========================================================= */
  function dropAt(game, pos, it) {
    const color = new THREE.Color(R[it.rarity].color);
    const g = new THREE.Group();
    const orb = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color }));
    orb.scale.setScalar(0.42);
    orb.position.y = 0.8;
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 + it.rarity * 0.08, depthWrite: false }));
    beam.position.y = 2.6;
    g.add(orb, beam);
    g.position.set(pos.x + U.rand(-0.8, 0.8), EV.World.groundY(pos.x, pos.z), pos.z + U.rand(-0.8, 0.8));
    game.scene.add(g);
    ground.push({ g, orb, it, t: 0, life: 240 });
    if (it.rarity >= 2) EV.UI.toast('<span style="color:' + R[it.rarity].color + '">' + R[it.rarity].name + ' eşya düştü: ' + it.name + '</span>', '#fff', 1600);
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

  /** Öldürme ödülü: Gen Özü (tier kadar) + düşük ihtimalle eşya. */
  function onKill(game, e) {
    const tier = e.def.tier || 1;
    let ess = tier;
    let chance = IC.dropChance * tier;
    let boost = 1;
    if (e.isApex) { ess = 40; chance = 1; boost = 6; }
    if (e.isAlpha) { ess = 60; chance = 1; boost = 12; }
    game.inv.essence += Math.round(ess * (1 + game.generation * 0.3));
    if (Math.random() < chance) {
      const it = randomItem(game, 'drop', boost);
      if (e.isAlpha && it.rarity < 3) { it.rarity = 3; it.affixes.length = 0; for (let i = 0; i < R[3].affixes; i++) addAffix(it); rename(it); }
      dropAt(game, e.group.position, it);
    }
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

  function equipFrom(game, where, idx) {
    const inv = game.inv;
    const it = inv[where][idx];
    if (!it) return false;
    const old = inv.equip[it.slot];
    inv.equip[it.slot] = it;
    inv[where][idx] = old || null;
    changed(game);
    return true;
  }

  function unequip(game, slot) {
    const inv = game.inv;
    const it = inv.equip[slot];
    if (!it || !addTo(inv.bag, it)) return false;
    inv.equip[slot] = null;
    changed(game);
    return true;
  }

  function move(game, from, idx, to) {
    const inv = game.inv;
    const it = inv[from][idx];
    if (!it || !addTo(inv[to], it)) return false;
    inv[from][idx] = null;
    return true;
  }

  function salvageValue(it) { return Math.round(IC.salvage[it.rarity] * (1 + it.ilvl * 0.25)); }

  function salvage(game, where, idx) {
    const inv = game.inv;
    const it = where === 'equip' ? inv.equip[idx] : inv[where][idx];
    if (!it) return 0;
    const v = salvageValue(it);
    if (where === 'equip') { inv.equip[idx] = null; changed(game); } else inv[where][idx] = null;
    inv.essence += v;
    return v;
  }

  function craft(game, slot) {
    const inv = game.inv;
    if (inv.essence < IC.craftCost) return null;
    if (inv.bag.indexOf(null) < 0) return null;
    inv.essence -= IC.craftCost;
    const it = makeItem(slot, rollRarity('craft', 1), ilvlOf(game));
    addTo(inv.bag, it);
    U.audio.evolve();
    return it;
  }

  function upgradeCost(it) { return it.rarity >= 4 ? Infinity : Math.round(IC.upgradeCost[it.rarity] * (1 + it.ilvl * 0.2)); }

  function upgrade(game, where, idx) {
    const inv = game.inv;
    const it = where === 'equip' ? inv.equip[idx] : inv[where][idx];
    if (!it || it.rarity >= 4) return false;
    const cost = upgradeCost(it);
    if (inv.essence < cost) return false;
    inv.essence -= cost;
    it.rarity++;
    while (it.affixes.length < R[it.rarity].affixes) addAffix(it);
    if (it.rarity === 4 && !it.unique) {
      const c = UNIQUES.filter((u) => u.slot === it.slot);
      it.unique = c.length ? U.pick(c) : null;
    }
    rename(it);
    if (where === 'equip') changed(game);
    U.audio.levelUp();
    return true;
  }

  function changed(game) {
    EV.Build.recompute(game);
  }

  function describe(it) {
    const lines = it.affixes.map((a) => EV.DATA.modText(a.k, value(it, a)));
    if (it.unique) lines.push('★ ' + it.unique.desc);
    return lines;
  }

  /* ---------------- kayıt ---------------- */
  function serialize(inv) {
    const s = (it) => it && { slot: it.slot, rarity: it.rarity, ilvl: it.ilvl, affixes: it.affixes, unique: it.unique ? it.unique.name : null };
    return { bag: inv.bag.map(s), chest: inv.chest.map(s), equip: { fang: s(inv.equip.fang), hide: s(inv.equip.hide), organ: s(inv.equip.organ), relic: s(inv.equip.relic) }, essence: inv.essence };
  }

  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  /** Kayıttan eşya: her alan doğrulanır/kırpılır; bozuk eşya atılır ama kayıt çökmez. */
  function revive(d) {
    if (!d || typeof d !== 'object' || !own(SLOT, d.slot)) return null;
    const rar = U.clamp(Math.round(Number(d.rarity)) || 0, 0, 4);
    const it = { uid: uidSeq++, slot: d.slot, rarity: rar, ilvl: U.clamp(Number(d.ilvl) | 0, 0, 12), affixes: [], unique: null, name: '' };
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
    SLOTS, SLOT, freshInv, makeItem, mods, hooks, onKill, dropAt, spawnChests, update, clear,
    equipFrom, unequip, move, salvage, salvageValue, craft, upgrade, upgradeCost, describe,
    serialize, deserialize, value,
    get groundCount() { return ground.length; }, get chestCount() { return chests.length; },
  };
})();
