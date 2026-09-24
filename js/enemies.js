/* ============================================================
   enemies.js — yaratıklar: doğum, sürüler, yapay zekâ, yönlendirme

   Davranış: passive (kaçar) · neutral (vurulunca sürüsüyle saldırır)
             aggressive (menzile gireni kovalar) · ally (çağrı/yavru)
   Yönlendirme: hedefe istek + engelden kaçınma + ayrışma (üst üste
   binmesinler) + takılma algılayıcı (ilerleyemezse yan yola sapar).
   Temel saldırı windup'lıdır: vuruş anında menzilden çıktıysan ıskalar.
   Boss / apex / türe özgü yetenekler boss.js'dedir.

   Ek davranışlar: flyer (uçar, döner, dalar) · bomber (fitil + patlama)
   healer · summoner · hopper · ambush (kamufle) · buffer · treasure.
   Şampiyonlar (Diablo tarzı): ⭐ + 1-2 ek özellik, 4 kat ödül.
   Nesil arttıkça: daha çok düşman, IV/V seviyeler, daha çok şampiyon.
   ============================================================ */
window.EV = window.EV || {};

EV.Enemies = (function () {
  'use strict';

  const CFG = EV.CFG;
  const T = CFG.TUNE;
  const U = EV.U;
  const W = EV.World;
  const Status = EV.Status;

  let nextId = 1;
  let packId = 1;

  /* Aynı türün seviyeleri: II = +%20 can / +%10 hasar, III = +%40 / +%20;
     IV ve V sadece sonraki nesillerde. İri görünürler, adlarında yazar, ödülleri büyür. */
  const VARIANT = [null,
    { hp: 1.0, dmg: 1.0, size: 1.0, reward: 1.0, suffix: '' },
    { hp: 1.2, dmg: 1.1, size: 1.1, reward: 1.25, suffix: ' II' },
    { hp: 1.4, dmg: 1.2, size: 1.2, reward: 1.5, suffix: ' III' },
    { hp: 1.75, dmg: 1.32, size: 1.28, reward: 2.0, suffix: ' IV' },
    { hp: 2.2, dmg: 1.45, size: 1.36, reward: 2.6, suffix: ' V' },
  ];

  /** Nesil 0: II seviye 4'ten, III 7'den sonra, seyrek (en fazla %18 / %6).
   *  Her nesil II/III'ü artırır, nesil 1'den IV, nesil 2'den V açılır. Dehşet ×1.6. */
  function rollVariant(game) {
    const L = game.build.level, g = game.generation;
    const k = game.diff.id === 'dehset' ? 1.6 : 1;
    const p5 = g >= 2 ? Math.min(0.12, 0.03 * (g - 1)) * k : 0;
    const p4 = g >= 1 ? Math.min(0.2, 0.05 * g) * k : 0;
    const p3 = Math.min(0.25, (L < 7 ? 0 : Math.min(0.06, 0.01 * (L - 6))) + 0.06 * g) * k;
    const p2 = Math.min(0.35, (L < 4 ? 0 : Math.min(0.18, 0.04 + 0.012 * (L - 4))) + 0.08 * g) * k;
    let r = Math.random();
    if ((r -= p5) < 0) return 5;
    if ((r -= p4) < 0) return 4;
    if ((r -= p3) < 0) return 3;
    return r < p2 ? 2 : 1;
  }

  /* ---------------- şampiyonlar ---------------- */
  const CHAMP = {
    fast: { name: 'Hızlı' }, giant: { name: 'Dev' }, vamp: { name: 'Vampirik' },
    explosive: { name: 'Patlayıcı' }, shielded: { name: 'Kalkanlı' }, regen: { name: 'Yenilenen' },
  };
  const CHAMP_IDS = Object.keys(CHAMP);

  /** Paket başına şampiyon lider olasılığı: seviye 5'ten sonra, nesille artar. */
  function rollChampion(game) {
    if (game.build.level < 5 && game.generation === 0) return null;
    const ch = Math.min(0.2, 0.035 + 0.035 * game.generation) * (game.diff.id === 'dehset' ? 1.3 : 1);
    if (Math.random() > ch) return null;
    const n = game.generation >= 2 ? 2 : 1;
    const list = CHAMP_IDS.slice().sort(() => Math.random() - 0.5);
    return list.slice(0, n);
  }

  /* =========================================================
     Mekânsal ızgara (her kare yeniden kurulur)
     ========================================================= */
  const CELL = 10;
  const grid = new Map();
  const key = (x, z) => Math.floor(x / CELL) * 4096 + Math.floor(z / CELL);

  function rebuildGrid(game) {
    grid.clear();
    const list = game.enemies;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      const k = key(e.group.position.x, e.group.position.z);
      let b = grid.get(k);
      if (!b) { b = []; grid.set(k, b); }
      b.push(e);
    }
  }

  /** (x,z)'ye merkezce yakın canlılar için fn çağırır (kaba süzgeç). */
  function forEachNear(x, z, r, fn) {
    const x0 = Math.floor((x - r - 6) / CELL), x1 = Math.floor((x + r + 6) / CELL);
    const z0 = Math.floor((z - r - 6) / CELL), z1 = Math.floor((z + r + 6) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const b = grid.get(cx * 4096 + cz);
        if (!b) continue;
        for (let i = 0; i < b.length; i++) {
          const e = b[i];
          if (!e.alive) continue;
          const reach = r + e.radius + e.group.userData.cap.hl + Math.abs(e.group.userData.cap.cz);
          const dx = e.group.position.x - x, dz = e.group.position.z - z;
          if (dx * dx + dz * dz <= reach * reach) fn(e);
        }
      }
    }
  }

  function nearest(x, z, r, filter) {
    let best = null, bd = Infinity;
    forEachNear(x, z, r, (e) => {
      if (filter && !filter(e)) return;
      const d = EV.Creature.surfDist(e.group, x, z);
      if (d < bd && d <= r) { bd = d; best = e; }
    });
    return best;
  }

  /* =========================================================
     Can barı (sprite)
     ========================================================= */
  const BAR_H = 0.16;
  const _cFull = new THREE.Color(0x4ade4a), _cLow = new THREE.Color(0xe8434a);

  function makeBar(width, y) {
    const g = new THREE.Group();
    const sp = (color, op) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, transparent: true, opacity: op }));
      s.renderOrder = 998;
      return s;
    };
    const bg = sp(0x120808, 0.85);
    bg.scale.set(width, BAR_H, 1);
    const fill = sp(0x4ade4a, 1);
    fill.scale.set(width, BAR_H * 0.72, 1);
    fill.renderOrder = 999;
    g.add(bg, fill);
    const pips = [];
    for (let i = 0; i < 4; i++) {
      const p = sp(0xffffff, 1);
      p.scale.set(0.2, 0.2, 1);
      p.position.set(-width / 2 + 0.12 + i * 0.26, 0.26, 0);
      p.visible = false;
      p.renderOrder = 999;
      g.add(p);
      pips.push(p);
    }
    g.position.y = y;
    g.userData = { fill, width, pips };
    g.visible = false;
    return g;
  }

  const _tc = new THREE.Color();
  function updateBar(game, e) {
    const bar = e.hpBar;
    const show = e.isAlpha || e.isApex || e.isMini || e.isNemesis || e.isChampion || e.isTreasure || e === game.player.lockTarget || e === game.player.hover ||
      (game.time - (e.lastHitT || -99) < 4) || (e.ally && e.hp < e.maxHp);
    bar.visible = !!show;
    if (!show) return;
    const pct = U.clamp(e.hp / e.maxHp, 0, 1);
    const { fill, width, pips } = bar.userData;
    fill.scale.x = Math.max(0.0001, width * pct);
    fill.position.x = -width * (1 - pct) * 0.5;
    if (e.ally) fill.material.color.setHex(0x6fd8ff);
    else if (e.peaceful) fill.material.color.setHex(0xff8fc0);
    else if (e.isChampion || e.isTreasure) fill.material.color.setHex(0xffc83d);
    else if (e.isNemesis) fill.material.color.setHex(0xc27bff);
    else fill.material.color.copy(_tc.copy(_cLow).lerp(_cFull, pct));
    const sts = Status.list(e);
    for (let i = 0; i < pips.length; i++) {
      const s = sts[i];
      pips[i].visible = !!s;
      if (s) pips[i].material.color.set(s.def.color);
    }
  }

  /* =========================================================
     Kurulum
     ========================================================= */
  function statScale(game, kind) {
    const L = game.build.level;
    const D = game.diff;
    const g = Math.pow(CFG.ENDLESS.enemyGrowth, game.generation);
    if (kind === 'alpha') return { hp: D.hp * g * (1 + game.generation * 0.1), dmg: D.dmg * g };
    // Seviye ölçeği 16'da durur: XP ölümde kaybolmadığı için zorlanan oyuncu
    // seviye atlamaya devam ediyor, düşmanlar üstel büyüyüp onu kapana kıstırıyordu.
    const Lc = Math.min(L, 16 + 4 * game.generation);
    return {
      hp: Math.pow(T.enemyHpLvl, Lc - 1) * D.hp * g,
      dmg: Math.pow(T.enemyDmgLvl, Lc - 1) * D.dmg * g,
    };
  }

  function make(game, def, opts) {
    opts = opts || {};
    const V = VARIANT[opts.variant || 1];
    const champ = opts.champ || null;
    const size = V.size * (champ && champ.indexOf('giant') >= 0 ? 1.3 : 1);
    const body = opts.body || (size !== 1 ? Object.assign({}, def.body, { scale: def.body.scale * size }) : def.body);
    const group = EV.Creature.build(body, opts.isAlpha || opts.isApex || opts.boss ? 'boss' : 'creature');
    const spot = opts.pos || W.randomSpawn(game.player.group.position, T.spawnMin, T.spawnMax);
    group.position.set(spot.x, W.groundY(spot.x, spot.z), spot.z);
    group.rotation.y = U.rand(0, Math.PI * 2);
    game.scene.add(group);

    let hp = opts.hp != null ? opts.hp : def.hp;
    let reward = V.reward;
    let dmg0 = opts.dmg != null ? opts.dmg : def.dmg;
    let speed0 = (def.speed || 6) * (opts.ally ? 1 : game.diff.speed);
    if (champ) {
      hp *= 2.2 * (champ.indexOf('giant') >= 0 ? 1.8 : 1);
      dmg0 *= 1.3 * (champ.indexOf('giant') >= 0 ? 1.2 : 1);
      if (champ.indexOf('fast') >= 0) speed0 *= 1.45;
      reward *= 4;
    }
    const e = {
      id: nextId++, def,
      name: opts.name || (champ ? '⭐ ' + champ.map((c) => CHAMP[c].name).join(' ') + ' ' : '') + def.name + V.suffix,
      lvl: opts.lvl || game.build.level + ((opts.variant || 1) - 1) * 2,
      variant: opts.variant || 1,
      maxHp: hp, hp,
      dmg: dmg0,
      speed: speed0,
      armor: Math.min(0.6, (def.armor || 0) + (champ && champ.indexOf('shielded') >= 0 ? 0.35 : 0)),
      evo: (def.evo || 0) * reward, xp: (def.xp != null ? def.xp : (def.evo || 0)) * reward,
      isChampion: !!champ, champ, isTreasure: def.behavior === 'treasure',
      flyH: def.fly || 0, flyNow: def.fly || 0, diveT: 0, hopT: 0, hopDur: 0,
      orbitA: U.rand(0, Math.PI * 2), orbitDir: Math.random() < 0.5 ? 1 : -1,
      healCd: U.rand(1.5, 3), summonCd: U.rand(2, 4), buffCd: U.rand(2, 5), buffT: 0, children: 0,
      ambushing: def.behavior === 'ambush', fused: false, lastHurtT: -99,
      aggro: def.aggro || 14,
      behavior: opts.ally ? 'ally' : (def.behavior || 'aggressive'),
      atk: def.atk || { range: 1.5, windup: 0.45, cd: 1.4 },
      group, radius: group.userData.radius,
      alive: true, ally: !!opts.ally, isAlpha: !!opts.isAlpha, isApex: !!opts.isApex,
      isSummon: !!opts.isSummon, isChild: false, isMate: false, peaceful: false,
      life: opts.life || 0, pack: opts.pack || 0,
      wander: null, wanderT: 0, atkCd: U.rand(0.3, 1.2), atkT: 0,
      abilityCd: U.rand(2, 5), busyT: 0, aggroT: 0, fleeT: 0,
      knock: new THREE.Vector3(), lunge: null, st: null,
      t: U.rand(0, 100), speed01: 0, stuckT: 0, lastD: 0, detour: null, stun: 0, moving: false,
      lastHitT: -99,
    };
    e.baseDmg = e.dmg;
    e.baseSpeed = e.speed;
    if (champ && champ.indexOf('fast') >= 0) e.atk = Object.assign({}, e.atk, { cd: e.atk.cd * 0.75 });
    if (e.flyH) group.userData.flying = true;
    if (champ) EV.Creature.setGlow(group, { r: 0.32, g: 0.22, b: 0.0 });
    if (e.isTreasure) { EV.Creature.setGlow(group, { r: 0.35, g: 0.28, b: 0.05 }); e.life = 25; }
    if (e.ambushing) camo(e, true);
    const barW = Math.max(1.3, Math.min(5, e.radius * 2.2));
    e.hpBar = makeBar(barW, group.userData.cap.top + 0.7);
    group.add(e.hpBar);
    game.enemies.push(e);
    return e;
  }

  /** Pusucu kamuflajı: yarı saydam. */
  function camo(e, on) {
    e.group.traverse((o) => {
      if (!o.material || o.isSprite) return;
      o.material.transparent = on || o.material.transparent;
      if (o.userData.op0 == null) o.userData.op0 = o.material.opacity;
      o.material.opacity = on ? 0.28 : o.userData.op0;
    });
  }

  function despawn(game, index) {
    const e = game.enemies[index];
    e.alive = false;
    EV.Decal.cancelOwner(e);
    game.scene.remove(e.group);
    EV.Creature.dispose(e.group);
    game.enemies.splice(index, 1);
  }

  function clearAll(game) {
    for (let i = game.enemies.length - 1; i >= 0; i--) despawn(game, i);
    grid.clear();
  }

  /* ---------------- sürüler ---------------- */
  /** Açık en yüksek tier: seviye 1 → 2, her 3 seviyede +1 (5'te tavan); sonraki nesillerde hepsi açık. */
  function maxTier(game) {
    if (game.generation > 0) return 9;
    return Math.min(5, 2 + Math.floor((game.build.level - 1) / 3));
  }

  function spawnPack(game, near, opts) {
    opts = opts || {};
    const top = maxTier(game);
    const pool = EV.MOBS.ENEMIES[game.stageIndex].filter((d) => d.spawn !== false && d.tier <= top && (!opts.filter || opts.filter(d)));
    if (!pool.length) return [];
    const best = pool.reduce((m, d) => Math.max(m, d.tier), 0);
    const def = Math.random() < 0.15 ? U.pick(pool.filter((d) => d.tier === best)) : U.pick(pool);
    const sc = statScale(game, 'normal');
    const n = opts.count || U.randInt(def.pack[0], def.pack[1]);
    const c = opts.at || W.randomSpawn(near || game.player.group.position, T.spawnMin, T.spawnMax, 3);
    const pid = packId++;
    const champ = opts.noChamp ? null : rollChampion(game);
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = { x: c.x + U.rand(-4, 4), z: c.z + U.rand(-4, 4) };
      if (W.blocked(p.x, p.z, 1)) { p.x = c.x; p.z = c.z; }
      W.clampToPlay(p);
      const v = rollVariant(game);
      out.push(make(game, def, { pos: p, hp: def.hp * sc.hp * VARIANT[v].hp, dmg: def.dmg * sc.dmg * VARIANT[v].dmg, pack: pid, variant: v,
        champ: i === 0 ? champ : null }));
    }
    return out;
  }

  /** Aynı türden tek yaratık (bölünme / çağırma): mevcut ölçekle. */
  function spawnOne(game, def, pos, extra) {
    const sc = statScale(game, 'normal');
    const p = { x: pos.x + U.rand(-1.5, 1.5), z: pos.z + U.rand(-1.5, 1.5) };
    W.clampToPlay(p);
    return make(game, def, Object.assign({ pos: p, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg }, extra || {}));
  }

  /** Oyuncunun çevresindeki (TUNE.nearRadius) sıradan düşman sayısı.
   *  Eskiden tüm haritadaki sayılıyordu: uzaktakiler kotayı doldurunca
   *  oyuncunun etrafı bomboş kalıyordu. */
  function hostileCount(game) {
    const p = game.player.group.position;
    const R2 = T.despawn * T.despawn;
    let n = 0;
    for (let i = 0; i < game.enemies.length; i++) {
      const e = game.enemies[i];
      if (!e.alive || e.ally || e.isAlpha || e.isApex || e.isMini || e.isNemesis || e.isTreasure || e.peaceful) continue;
      if (e.group.position.distanceToSquared(p) < R2) n++;
    }
    return n;
  }

  function targetCount(game) {
    // nesil başına +3 (en fazla +21); Kan Ayı olayında ×1.5
    const base = Math.round((T.maxEnemies * game.diff.spawn + Math.min(game.generation * 3, 21)) * (game.bloodMoon > 0 ? 1.5 : 1));
    return game.bossActive ? Math.round(base * 0.35) : base;
  }

  function seed(game) {
    const target = targetCount(game);
    let guard = 0;
    while (hostileCount(game) < target * 0.5 && guard++ < 30) spawnPack(game);
  }

  function maintain(game, dt) {
    const p = game.player.group.position;
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      if (!e.alive || e.ally || e.isAlpha || e.isApex || e.isMini || e.isNemesis) continue;
      if (e.isMate && game.player.mateTarget === e) continue;
      if (e.group.position.distanceTo(p) > T.despawn) despawn(game, i);
    }
    if (hostileCount(game) < targetCount(game)) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnPack(game);
        // eksik çoksa hızlı doldur
        const gap = targetCount(game) - hostileCount(game);
        game.spawnTimer = gap > 12 ? 0.15 : U.rand(0.35, 0.8);
      }
    }
  }

  /* ---------------- boss / apex / çağrılar ---------------- */
  function spawnAlpha(game) {
    const def = EV.MOBS.ALPHAS[game.stageIndex];
    const sc = statScale(game, 'alpha');
    const pos = W.randomSpawn(game.player.group.position, 20, 28, 4);
    const name = game.generation > 0 ? 'Kadim ' + def.name : def.name;
    const e = make(game, def, { pos, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg, isAlpha: true, name, lvl: game.build.level + 3 });
    e.behavior = 'boss';
    EV.Boss.init(game, e, def.kit);
    game.bossActive = true;
    game.boss = e;
    EV.FX.ring(e.group.position, 0xff3d3d, 26, 1.2);
    U.audio.roar();
    return e;
  }

  function spawnApex(game) {
    const def = EV.MOBS.APEX[game.stageIndex];
    const sc = statScale(game, 'normal');
    const g = game.generation;
    const name = g > 0 ? 'Kadim ' + def.name : def.name;
    // leash'in (55) İÇİNDE doğmalı; eskiden 50-72'de doğup ilk karede kayboluyordu
    const pos = W.randomSpawn(game.player.group.position, 34, 48, 4);
    const e = make(game, def, { pos, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg, isApex: true, name, lvl: game.build.level + 8 });
    e.behavior = 'boss';
    EV.Boss.init(game, e, def.kit);
    game.apex = e;
    U.audio.roar();
    game.toast('⚠️ ' + name.toLocaleUpperCase('tr-TR') + ' AVLANIYOR<br><span class="sub">Savaşma — <b>KAÇ</b></span>', '#ff6b6b');
    return e;
  }

  /**
   * Apex yaşam döngüsü: gelir → en fazla def.hunt sn kovalar → vazgeçip gider.
   * Kapalı arenada sınırsız kovalama kurtuluşu olmayan bir kovalamacaydı;
   * şimdi kaçmak = hayatta kalıp süreyi doldurmak ya da leash dışına çıkmak.
   */
  function maintainApex(game, dt) {
    const def = EV.MOBS.APEX[game.stageIndex];
    const a = game.apex;
    if (a && a.alive) {
      a.huntT = (a.huntT || 0) + dt;
      const far = a.group.position.distanceTo(game.player.group.position) > def.leash;
      const lost = game.player.hiddenT > 3;                // saklanınca apex izini kaybeder
      if (far || lost || a.huntT > def.hunt || game.bossActive) {
        const i = game.enemies.indexOf(a);
        if (i >= 0) despawn(game, i);
        game.apex = null;
        game.apexTimer = U.rand(def.respawn[0], def.respawn[1]) * game.diff.apexTimer;
        if (!game.bossActive) game.toast(far || lost ? 'Avcı izini kaybetti' : a.name + ' uzaklaştı', '#9de89d');
      }
      return;
    }
    if (game.bossActive || (game.miniBoss && game.miniBoss.alive)) return;
    game.apex = null;
    game.apexTimer -= dt;
    if (game.apexTimer <= 0) {
      game.apexTimer = U.rand(def.respawn[0], def.respawn[1]) * game.diff.apexTimer;
      spawnApex(game);
    }
  }

  function spawnMini(game, def) {
    def = def || EV.MOBS.MINIS[game.stageIndex][0];
    const sc = statScale(game, 'normal');
    const name = game.generation > 0 ? 'Kadim ' + def.name : def.name;
    const pos = W.randomSpawn(game.player.group.position, 18, 26, 4);
    const e = make(game, def, { pos, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg, name, lvl: game.build.level + 4, boss: true });
    e.isMini = true;
    e.behavior = 'boss';
    EV.Boss.init(game, e, def.kit);
    game.miniBoss = e;
    EV.FX.ring(e.group.position, 0xffa03d, 20, 1.0);
    U.audio.roar();
    game.toast('⚔️ ARA BOSS: ' + name.toLocaleUpperCase('tr-TR') + '<br><span class="sub">Yen: garanti Değerli eşya + Gen Özü</span>', '#ffb35a', 3200);
    return e;
  }

  /** Hazine yaratığı: kaçar; 25 sn içinde yakalanırsa bol ödül. */
  function spawnTreasure(game) {
    const def = EV.MOBS.TREASURE[game.stageIndex];
    const sc = statScale(game, 'normal');
    const pos = W.randomSpawn(game.player.group.position, 16, 24, 3);
    const e = make(game, def, { pos, hp: def.hp * sc.hp, dmg: 0, noChamp: true });
    EV.FX.ring(e.group.position, 0xffd23d, 6, 0.8);
    game.toast('✨ ' + def.name.toLocaleUpperCase('tr-TR') + ' GÖRÜNDÜ<br><span class="sub">25 sn içinde yakala: bol Gen Özü + 2 eşya</span>', '#ffd23d', 3000);
    return e;
  }

  /** Sürü dalgası: oyuncunun çevresinde halka halinde, hepsi saldırgan. */
  function spawnHorde(game) {
    const pp = game.player.group.position;
    const n = Math.min(22, 10 + game.generation * 2);
    const packs = Math.ceil(n / 4);
    let made = 0;
    for (let i = 0; i < packs; i++) {
      const a = (i / packs) * Math.PI * 2 + U.rand(-0.3, 0.3);
      const at = { x: pp.x + Math.sin(a) * U.rand(22, 27), z: pp.z + Math.cos(a) * U.rand(22, 27) };
      W.clampToPlay(at);
      const list = spawnPack(game, null, { at, count: Math.min(4, n - made), noChamp: i > 0,
        filter: (d) => d.behavior !== 'passive' && d.behavior !== 'treasure' });
      list.forEach((e) => { e.aggroT = 40; });
      made += list.length;
    }
    return made;
  }

  /** Geçmiş benlik: önceki nesildeki kahramanın, ara boss gücünde. */
  function spawnNemesis(game, snap) {
    const stage = game.stageIndex;
    const ref = EV.MOBS.MINIS[stage][0];
    const sc = statScale(game, 'normal');
    const spec = JSON.parse(JSON.stringify(snap.spec));
    spec.scale = (spec.scale || 1) * 1.15;
    const def = { id: 'nemesis', kit: 'nemesis', name: snap.name, tier: 7, hp: ref.hp * 1.35, dmg: ref.dmg * 1.1,
      speed: Math.max(6, (snap.speed || 8) * 0.85), evo: 0, xp: 0, body: spec };
    const pos = W.randomSpawn(game.player.group.position, 18, 26, 4);
    const e = make(game, def, { pos, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg, lvl: game.build.level + 5, noChamp: true, boss: true });
    e.isNemesis = true;
    e.nemesisKinds = snap.kinds || [];
    e.behavior = 'boss';
    EV.Boss.init(game, e, 'nemesis');
    EV.Creature.setGlow(e.group, { r: 0.22, g: 0.05, b: 0.35 });
    game.nemesis = e;
    EV.FX.ring(e.group.position, 0xc27bff, 18, 1.0);
    U.audio.roar();
    game.toast('👤 GEÇMİŞ BENLİĞİN<br><span class="sub">' + snap.name + ' — seni tanıyor. Yen: Destansı eşya</span>', '#c27bff', 3500);
    return e;
  }

  /* =========================================================
     Ölüm tepkileri (main.killEnemy çağırır)
     ========================================================= */
  function onKilled(game, e) {
    const pos = e.group.position;
    const sp = e.def.splitInto;
    if (sp) {
      const d = EV.MOBS.find(game.stageIndex, sp.id);
      for (let i = 0; d && i < sp.count; i++) {
        const c = spawnOne(game, d, pos);
        c.aggroT = 10;
      }
      if (d) EV.FX.burst(pos.clone().setY(pos.y + 1), 0xc8d84a, 10, 6);
    }
    if (e.champ && e.champ.indexOf('explosive') >= 0) EV.Boss.deathBlast(game, pos.x, pos.z, 4.2, e.dmg * 1.6);
  }

  const SUMMON_NAME = ['Tomurcuk', 'Kopya', 'Kurt'];
  function spawnSummon(game, o) {
    const P = game.player;
    const spec = JSON.parse(JSON.stringify(P.bodySpec));
    spec.scale *= 0.62;
    const tint = new THREE.Color(spec.body).lerp(new THREE.Color(0x7fc8ff), 0.45);
    spec.body = tint.getHex();
    spec.eye = 0x9de89d;
    const def = { id: 'summon', name: SUMMON_NAME[game.stageIndex] || 'Kopya', hp: o.hp, dmg: o.dmg,
      speed: game.stage().base.speed * 1.05, evo: 0, xp: 0, aggro: 24, atk: { range: 1.6, windup: 0.25, cd: 0.9 }, body: spec };
    const pos = W.randomSpawn(P.group.position, 2, 5, 1);
    const e = make(game, def, { ally: true, life: o.dur, pos, isSummon: true });
    EV.FX.burst(e.group.position.clone().setY(e.group.position.y + 1), 0x9de89d, 8, 5);
    return e;
  }

  /* =========================================================
     Hasar tepkisi
     ========================================================= */
  function onDamaged(game, e, src) {
    if (e.ally || e.peaceful) return;
    if (e.behavior === 'passive') { e.fleeT = 3.5; return; }
    e.aggroT = 14;
    if (e.pack) {
      for (let i = 0; i < game.enemies.length; i++) {
        const o = game.enemies[i];
        if (o.pack === e.pack && o.alive && o.behavior !== 'passive') o.aggroT = Math.max(o.aggroT, 12);
        else if (o.pack === e.pack && o.alive) o.fleeT = 3.5;
      }
    }
  }

  /* =========================================================
     Yönlendirme
     ========================================================= */
  const _av = { x: 0, z: 0 };

  /** e'yi (tx,tz)'ye doğru hareket ettirir; varınca false döner. */
  function steer(game, e, tx, tz, spd, dt, stopAt, airborne) {
    const pos = e.group.position;
    let dx = tx - pos.x, dz = tz - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= (stopAt || 0.8) || spd <= 0) return false;

    // takılma: 1.2 sn boyunca mesafe kısalmıyorsa yan yola sap
    if (e.detour) {
      e.detour.t -= dt;
      if (e.detour.t <= 0) e.detour = null;
      else { dx = e.detour.x - pos.x; dz = e.detour.z - pos.z; }
    } else {
      e.stuckT += dt;
      if (e.stuckT > 1.2) {
        if (e.lastD - dist < 0.6 && dist > 4) {
          const side = Math.random() < 0.5 ? 1 : -1;
          const nx = -dz / dist * side, nz = dx / dist * side;
          e.detour = { x: pos.x + nx * 6 + dx / dist * 2, z: pos.z + nz * 6 + dz / dist * 2, t: 0.9 };
        }
        e.stuckT = 0;
        e.lastD = dist;
      }
    }

    const l = Math.hypot(dx, dz) || 1;
    let vx = dx / l, vz = dz / l;
    if (!airborne && !e.flyH) {
      W.avoid(pos.x, pos.z, vx, vz, e.radius, 2.5 + e.radius * 1.6, _av);
      vx += _av.x;
      vz += _av.z;
    }

    // ayrışma: aynı noktaya yığılmasınlar
    let sx = 0, sz = 0;
    forEachNear(pos.x, pos.z, e.radius + 2, (o) => {
      if (o === e) return;
      const ox = pos.x - o.group.position.x, oz = pos.z - o.group.position.z;
      const d = Math.hypot(ox, oz);
      const min = e.radius + o.radius;
      if (d > 0.001 && d < min) { sx += (ox / d) * (min - d) / min; sz += (oz / d) * (min - d) / min; }
    });
    vx += sx * 1.4;
    vz += sz * 1.4;

    const vl = Math.hypot(vx, vz) || 1;
    const step = Math.min(dist, spd * dt);
    pos.x += (vx / vl) * step;
    pos.z += (vz / vl) * step;
    e.group.rotation.y = U.approachAngle(e.group.rotation.y, Math.atan2(vx, vz), dt * 7);
    return true;
  }

  /* =========================================================
     Hedef seçimi (düşmanlar için)
     ========================================================= */
  const HUNTERS = { aggressive: 1, ranged: 1, flyer: 1, bomber: 1, hopper: 1, buffer: 1, healer: 1, summoner: 1 };
  const KEEP_AWAY = { ranged: 1, healer: 1, summoner: 1 };

  function pickHostileTarget(game, e) {
    const P = game.player;
    const pos = e.group.position;
    const dP = P.alive ? EV.Creature.surfDist(e.group, P.group.position.x, P.group.position.z) : Infinity;
    const egg = EV.Mating.activeEgg();
    const dE = egg ? pos.distanceTo(egg.group.position) : Infinity;
    let ally = null, dA = Infinity;
    forEachNear(pos.x, pos.z, e.aggro, (o) => {
      if (!o.ally) return;
      const d = pos.distanceTo(o.group.position);
      if (d < dA) { dA = d; ally = o; }
    });

    // oyuncu saklanma yerindeyse görüş 4 birime iner ve öfke çabuk söner
    const hidden = P.hidden;
    if (hidden && dP > 4) e.aggroT = 0;
    const sight = hidden ? 4 : e.aggro;
    const chasing = HUNTERS[e.behavior] ? (dP < sight || e.aggroT > 0) : e.aggroT > 0;
    if (!chasing && !(egg && dE < 14 && e.behavior === 'aggressive')) return null;

    if (egg && dE < EV.Mating.M.eggAggro && dE + 8 < dP) return egg;
    if (ally && dA + 4 < dP) return ally;
    if (P.alive && (dP < (hidden ? 4 : e.aggro * 1.6) || e.aggroT > 0)) return P;
    return null;
  }

  function pickAllyTarget(game, e) {
    const P = game.player.group.position;
    const pos = e.group.position;
    if (pos.distanceTo(P) > 22) return null;          // oyuncudan kopma
    return nearest(pos.x, pos.z, 18, (o) => !o.ally && !o.peaceful);
  }

  /* =========================================================
     Güncelleme
     ========================================================= */
  function update(game, dt) {
    rebuildGrid(game);
    const P = game.player;
    const ppos = P.group.position;
    const windMul = game.diff.windup;

    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      if (!e.alive) continue;
      e.t += dt;
      const pos = e.group.position;
      const far = pos.distanceTo(ppos) > 75;

      if (e.ally) {
        e.life -= dt;
        if (e.life <= 0) { EV.FX.burst(pos.clone().setY(pos.y + 1), 0x9de89d, 6, 5); despawn(game, i); continue; }
      }
      if (e.isTreasure) {
        e.life -= dt;
        if (e.life <= 0) {
          EV.FX.burst(pos.clone().setY(pos.y + 1), 0xffd23d, 16, 8);
          game.toast(e.name + ' kaçtı…', '#cfc6b8', 1500);
          despawn(game, i);
          continue;
        }
      }
      if (e.buffT > 0) {                                  // sırtlan çığlığı bitti
        e.buffT -= dt;
        if (e.buffT <= 0) { e.dmg = e.baseDmg; e.speed = e.baseSpeed; }
      }
      if (e.champ && e.champ.indexOf('regen') >= 0 && game.time - e.lastHitT > 3 && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.025 * dt);
      }

      if (e.st) { Status.tick(game, e, dt); if (!e.alive) continue; }
      if (e.stun > 0) e.stun -= dt;           // eş ritüeli gibi harici bekletmeler
      if (e.atkCd > 0) e.atkCd -= dt;
      if (e.abilityCd > 0) e.abilityCd -= dt;
      if (e.aggroT > 0) e.aggroT -= dt;
      if (e.fleeT > 0) e.fleeT -= dt;

      let moving = 0;
      const smul = Status.speedMul(e);
      const disabled = smul === 0 || e.stun > 0;

      // geri tepme ve atılma her şeyden önce
      if (e.knock.lengthSq() > 0.01) {
        pos.addScaledVector(e.knock, dt);
        e.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
      }
      if (e.lunge) {
        pos.x += e.lunge.vx * dt;
        pos.z += e.lunge.vz * dt;
        e.lunge.t -= dt;
        moving = 1;
        if (e.lunge.t <= 0) e.lunge = null;
      }

      if (e.behavior === 'boss') {
        if (!disabled && !e.lunge) moving = EV.Boss.update(game, e, dt, smul) ? 1 : 0;
      } else if (!disabled && !e.lunge) {
        if (e.busyT > 0) {
          e.busyT -= dt;
        } else if (Status.feared(e) && !e.ally) {
          const dx = pos.x - ppos.x, dz = pos.z - ppos.z, l = Math.hypot(dx, dz) || 1;
          moving = steer(game, e, pos.x + dx / l * 8, pos.z + dz / l * 8, e.speed * 0.9 * smul, dt) ? 1 : 0;
        } else if (e.atkT > 0) {
          e.atkT -= dt;
          if (e.atkT <= 0) resolveAttack(game, e);
        } else {
          moving = think(game, e, dt, smul, windMul) ? 1 : 0;
        }
      }

      const gy = W.groundY(pos.x, pos.z);
      if (e.flyH) {
        // uçanlar engellerin üstünden geçer; dalışta alçalır
        W.clampToPlay(pos);
        if (e.diveT > 0) e.diveT -= dt;
        const want = e.diveT > 0 ? Math.min(1.1, e.flyH) : e.flyH;
        e.flyNow = U.lerp(e.flyNow, want, Math.min(1, dt * (e.diveT > 0 ? 7 : 2.5)));
        pos.y = gy + e.flyNow;
        if (e.group.userData.blob) e.group.userData.blob.position.y = 0.06 - e.flyNow;
      } else {
        W.resolveCollision(pos, e.radius);
        pos.y = gy;
        if (e.hopT > 0) {                                  // kurbağa sıçrama yayı
          e.hopT = Math.max(0, e.hopT - dt);
          const k = 1 - e.hopT / e.hopDur;
          pos.y += Math.sin(Math.PI * k) * 2.6;
          if (e.group.userData.blob) e.group.userData.blob.position.y = 0.06 - Math.sin(Math.PI * k) * 2.6;
        }
      }
      e.moving = moving > 0;
      e.speed01 = U.lerp(e.speed01, moving, Math.min(1, dt * 8));
      if (!far || (e.t * 10 | 0) % 3 === 0) EV.Creature.animate(e.group, far ? dt * 3 : dt, e.speed01, e.t);
      updateBar(game, e);
    }
  }

  /** Normal yaratık ve müttefik karar döngüsü; hareket ettiyse true. */
  function think(game, e, dt, smul, windMul) {
    const pos = e.group.position;
    const P = game.player;

    if (e.peaceful) return wander(game, e, dt, smul);

    if (e.behavior === 'passive') {
      const d = pos.distanceTo(P.group.position);
      if (e.fleeT > 0 || d < 5) {
        const dx = pos.x - P.group.position.x, dz = pos.z - P.group.position.z, l = Math.hypot(dx, dz) || 1;
        return steer(game, e, pos.x + dx / l * 10, pos.z + dz / l * 10, e.speed * 1.1 * smul, dt);
      }
      return wander(game, e, dt, smul);
    }

    if (e.behavior === 'treasure') return treasureThink(game, e, dt, smul);
    if (e.ambushing) return ambushThink(game, e, dt);
    if (e.behavior === 'healer') healTick(game, e, dt);
    if (e.behavior === 'summoner') summonTick(game, e, dt);
    if (e.behavior === 'buffer') buffTick(game, e, dt);

    const target = e.ally ? pickAllyTarget(game, e) : pickHostileTarget(game, e);
    if (!target) {
      if (e.ally) return steer(game, e, P.group.position.x, P.group.position.z, e.speed * smul, dt, 4);
      return wander(game, e, dt, smul);
    }
    if (e.behavior === 'flyer' && target === P) return flyerThink(game, e, dt, smul);

    // hedefle aramızdaki yüzeyden yüzeye mesafe
    const tp = target.group.position;
    let surf;
    if (target === P) surf = EV.Creature.surfDist(e.group, tp.x, tp.z) - P.radius;
    else if (target.isEgg) surf = EV.Creature.surfDist(e.group, tp.x, tp.z) - target.radius;
    else surf = EV.Creature.surfDist(target.group, pos.x, pos.z) - e.radius;

    // türe özgü yetenek
    if (!e.ally && target === P && e.def.ability && e.abilityCd <= 0 && EV.Boss.species(game, e, surf)) return false;

    // bombacı: yanına gelince fitil yakar, patlar
    if (e.behavior === 'bomber' && target === P && surf < 1.6 && !e.fused) {
      e.fused = true;
      EV.Boss.fuse(game, e);
      return false;
    }

    // uzakçı / şifacı / çağırıcı: tercih ettiği mesafeyi korur, çok yaklaşılırsa geri çekilir
    if (KEEP_AWAY[e.behavior] && target === P && surf > e.atk.range) {
      const pref = e.def.range || 12;
      const dx = pos.x - tp.x, dz = pos.z - tp.z, l = Math.hypot(dx, dz) || 1;
      e.group.rotation.y = U.approachAngle(e.group.rotation.y, Math.atan2(-dx, -dz), dt * 8);
      if (surf < pref * 0.6) return steer(game, e, pos.x + dx / l * 6, pos.z + dz / l * 6, e.speed * smul, dt, 0.5);
      if (surf > pref * 1.2) return steer(game, e, tp.x, tp.z, e.speed * smul, dt, pref);
      e.strafe = e.strafe || (Math.random() < 0.5 ? 1 : -1);
      if (Math.random() < dt * 0.4) e.strafe = -e.strafe;
      return steer(game, e, pos.x - dz / l * 4 * e.strafe, pos.z + dx / l * 4 * e.strafe, e.speed * 0.6 * smul, dt, 0.5);
    }

    if (surf <= e.atk.range) {
      e.group.rotation.y = U.approachAngle(e.group.rotation.y, Math.atan2(tp.x - pos.x, tp.z - pos.z), dt * 10);
      if (e.atkCd <= 0) {
        e.atkT = e.atk.windup * (e.ally ? 1 : windMul);
        e.atkTarget = target;
        e.atkCd = e.atk.cd;
      }
      return false;
    }
    return steer(game, e, tp.x, tp.z, e.speed * smul, dt, 0.2);
  }

  /* ---------------- yeni davranışlar ---------------- */

  /** Uçan: hedefin çevresinde yörüngede döner; dalış yeteneği species()'te. */
  function flyerThink(game, e, dt, smul) {
    const pos = e.group.position, tp = game.player.group.position;
    const surf = EV.Creature.surfDist(e.group, tp.x, tp.z) - game.player.radius;
    if (e.def.ability && e.abilityCd <= 0 && EV.Boss.species(game, e, surf)) return false;
    const R = e.def.orbit || 7;
    e.orbitA += e.orbitDir * dt * (e.speed * 0.8) / R;
    if (Math.random() < dt * 0.15) e.orbitDir = -e.orbitDir;
    const gx = tp.x + Math.sin(e.orbitA) * R, gz = tp.z + Math.cos(e.orbitA) * R;
    return steer(game, e, gx, gz, e.speed * smul, dt, 0.6, true);
  }

  /** Şifacı: çevredeki en yaralı dostları iyileştirir. */
  function healTick(game, e, dt) {
    e.healCd -= dt;
    if (e.healCd > 0) return;
    const h = e.def.heal;
    const pos = e.group.position;
    let n = 0;
    forEachNear(pos.x, pos.z, h.r, (o) => {
      if (o.ally || o.peaceful || o === e || o.hp >= o.maxHp) return;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * h.frac);
      EV.FX.burst(o.group.position.clone().setY(o.group.position.y + o.group.userData.height), 0x7dff8a, 5, 3);
      n++;
    });
    if (n) {
      EV.FX.ring(pos, 0x7dff8a, h.r, 0.5);
      EV.Creature.attack(e.group, 0.4);
    }
    e.healCd = n ? h.cd : 1;
  }

  /** Çağırıcı: yavru döker (en fazla summon.max canlı). */
  function summonTick(game, e, dt) {
    e.summonCd -= dt;
    if (e.summonCd > 0) return;
    const sm = e.def.summon;
    e.summonCd = sm.cd;
    if (e.children >= sm.max || (e.aggroT <= 0 && e.group.position.distanceTo(game.player.group.position) > 20)) return;
    const d = EV.MOBS.find(game.stageIndex, sm.id);
    if (!d) return;
    for (let i = 0; i < sm.count && e.children < sm.max; i++) {
      const c = spawnOne(game, d, e.group.position, { noChamp: true });
      c.aggroT = 20;
      c.mother = e;
      e.children++;
    }
    EV.FX.ring(e.group.position, 0xc27bff, 3.5, 0.5);
    EV.Creature.attack(e.group, 0.5);
  }

  /** Güçlendirici: sürüsünü (kendisi dahil) azdırır: hız + hasar. */
  function buffTick(game, e, dt) {
    e.buffCd -= dt;
    if (e.buffCd > 0 || e.aggroT <= 0) return;
    const b = e.def.buff;
    e.buffCd = b.cd;
    const pos = e.group.position;
    forEachNear(pos.x, pos.z, b.r, (o) => {
      if (o.ally || o.peaceful || o.isAlpha || o.isApex || o.isMini) return;
      if (o.buffT <= 0) { o.dmg = o.baseDmg * b.dmg; o.speed = o.baseSpeed * b.speed; }
      o.buffT = b.dur;
      EV.Creature.flash(o.group);
    });
    EV.FX.ring(pos, 0xff5a3d, b.r, 0.6);
    EV.Creature.attack(e.group, 0.5);
    U.audio.roar();
  }

  /** Pusucu: kıpırdamadan bekler; yaklaşan olursa kamuflajı bozup saldırır. */
  function ambushThink(game, e, dt) {
    const P = game.player;
    const d = e.group.position.distanceTo(P.group.position);
    if (P.alive && (d < 8 || e.aggroT > 0) && !(P.hidden && d > 4)) {
      e.ambushing = false;
      camo(e, false);
      e.aggroT = 15;
      e.abilityCd = 0;                                    // ilk hamle hemen
      EV.FX.burst(e.group.position.clone().setY(e.group.position.y + 1), 0x9aa870, 10, 6);
    }
    return false;
  }

  /** Hazine: oyuncudan kaçar, arada yön değiştirir. */
  function treasureThink(game, e, dt, smul) {
    const pos = e.group.position, pp = game.player.group.position;
    const dx = pos.x - pp.x, dz = pos.z - pp.z, l = Math.hypot(dx, dz) || 1;
    e.zig = (e.zig || 0) - dt;
    if (e.zig <= 0) { e.zig = U.rand(0.8, 1.6); e.zigA = U.rand(-0.9, 0.9); }
    const a = Math.atan2(dx, dz) + e.zigA;
    const run = l < 26 ? 1 : 0.55;
    return steer(game, e, pos.x + Math.sin(a) * 8, pos.z + Math.cos(a) * 8, e.speed * run * smul, dt);
  }

  function resolveAttack(game, e) {
    const t = e.atkTarget;
    e.atkTarget = null;
    if (!t) return;
    EV.Creature.attack(e.group, 0.25);
    const pos = e.group.position;
    const P = game.player;
    if (t === P) {
      if (!P.alive) return;
      const surf = EV.Creature.surfDist(e.group, P.group.position.x, P.group.position.z) - P.radius;
      if (surf <= e.atk.range + 0.6) EV.Combat.hitPlayer(game, e.dmg, { attacker: e, melee: true });
    } else if (t.isEgg) {
      if (t.alive && pos.distanceTo(t.group.position) <= e.radius + t.radius + e.atk.range + 0.8) EV.Mating.damageEgg(game, t, e.dmg);
    } else if (t.alive) {
      const surf = EV.Creature.surfDist(t.group, pos.x, pos.z) - e.radius;
      if (surf <= e.atk.range + 0.6) {
        EV.Combat.hitEnemy(game, t, e.dmg, { source: e.ally ? 'ally' : 'enemy', knock: 3, from: pos });
      }
    }
  }

  function wander(game, e, dt, smul) {
    const pos = e.group.position;
    e.wanderT -= dt;
    if (!e.wander || e.wanderT <= 0 || pos.distanceTo(e.wander) < 1.2) {
      let s = W.randomSpawn(pos, 6, 18, e.radius);
      const cv = game.player.hidden ? game.player.cover : null;
      for (let k = 0; cv && k < 6 && Math.hypot(s.x - cv.x, s.z - cv.z) < cv.r + 4; k++) s = W.randomSpawn(pos, 6, 18, e.radius);
      e.wander = new THREE.Vector3(s.x, 0, s.z);
      e.wanderT = U.rand(3, 7);
    }
    return steer(game, e, e.wander.x, e.wander.z, e.speed * 0.42 * smul, dt, 1);
  }

  return {
    make, despawn, clearAll, seed, maintain, update, spawnPack,
    spawnAlpha, spawnApex, spawnMini, spawnTreasure, spawnHorde, spawnNemesis, onKilled, spawnOne, maintainApex, CHAMP, spawnSummon, onDamaged, steer,
    forEachNear, nearest, statScale, rebuildGrid,
  };
})();
