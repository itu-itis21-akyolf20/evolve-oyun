/* ============================================================
   mating.js — eş bulma, çiftleşme, yumurta ve yavru

   Akış:
     1) Dünyada kendi türünden dişiler dolaşır (saldırmazlar).
     2) Yaklaşıp F'e basarsın -> kısa bir çiftleşme ritüeli.
     3) Yumurta bırakılır ve kuluçkaya girer (MATING.incubation sn).
     4) Bu süre boyunca avcılar yumurtayı hedef alır — korumazsan kırılır.
     5) Süre dolarsa yavru çıkar ve kalıcı müttefik olur.
   ============================================================ */
window.EV = window.EV || {};

EV.Mating = (function () {
  'use strict';

  const CFG = EV.CFG;
  const U = EV.U;
  const W = EV.World;

  const M = {
    ritual: 2.2,          // çiftleşme animasyonu süresi (sn)
    incubation: 120,      // kuluçka — kullanıcı isteği: 2 dakika
    eggHpBase: 260,       // seviyeyle ölçeklenir
    mateRange: 4.6,       // F'e basmak için gereken yakınlık
    maxMates: 2,          // dünyada aynı anda dolaşan dişi sayısı
    maxChildren: 4,       // aynı anda sahip olunabilecek yavru
    mateRespawn: [14, 26],
    eggAggro: 34,         // avcılar bu mesafeden yumurtayı fark eder
  };

  const eggs = [];
  let mateTimer = 6;

  /* =========================================================
     Dişiler
     ========================================================= */

  /** Oyuncunun türünden, dişi görünümlü bir beden üretir. */
  function femaleSpec(game) {
    // kendi türün: taşınan parçalar dahil oyuncunun bedeni
    const spec = JSON.parse(JSON.stringify(game.player.bodySpec || game.stage().body));
    spec.scale *= 0.88;
    // dişi tonlaması: gövde açılır, vurgular sıcaklaşır
    const b = new THREE.Color(spec.body);
    b.offsetHSL(0.06, 0.16, 0.12);
    spec.body = b.getHex();
    const a = new THREE.Color(spec.accent);
    a.offsetHSL(-0.04, 0.22, 0.1);
    spec.accent = a.getHex();
    spec.eye = 0xff8fc0;
    return spec;
  }

  function spawnMate(game) {
    const stage = game.stage();
    const def = {
      id: 'mate',
      name: stage.title + ' (dişi)',
      lvl: game.build.level,
      hp: game.maxHp() * 0.6,
      dmg: 0,
      speed: stage.base.speed * 0.55,
      evo: 0, xp: 0, aggro: 0,
      body: femaleSpec(game),
    };
    const spot = W.randomSpawn(game.player.group.position, 26, 58);
    const e = EV.Enemies.make(game, def, { pos: spot, name: def.name });
    e.isMate = true;
    e.peaceful = true;      // saldırmaz, saldırılmaz
    e.aggro = 0;
    EV.FX.ring(e.group.position, 0xff8fc0, 6, 0.7);
    return e;
  }

  function mates(game) {
    return game.enemies.filter(function (e) { return e.alive && e.isMate; });
  }

  function children(game) {
    return game.enemies.filter(function (e) { return e.alive && e.isChild; });
  }

  /** En yakın çiftleşilebilir dişi (menzil içindeyse). */
  function nearestMate(game) {
    const p = game.player.group.position;
    let best = null, bestD = M.mateRange;
    const list = mates(game);
    for (let i = 0; i < list.length; i++) {
      const d = list[i].group.position.distanceTo(p);
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    return best;
  }

  /* =========================================================
     Yumurta
     ========================================================= */
  function makeEggMesh(game, color) {
    const g = new THREE.Group();
    const s = 0.68 * game.player.sizeScale;

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s, 1),
      new THREE.MeshPhongMaterial({ shininess: 0, specular: 0x000000, color: color, flatShading: true })
    );
    shell.scale.set(1, 1.32, 1);
    shell.position.y = s * 1.25;
    g.add(shell);

    // benekler — kabuğun yumurta gibi okunmasını sağlar
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const sp = new THREE.Mesh(
        new THREE.IcosahedronGeometry(s * U.rand(0.1, 0.18), 0),
        new THREE.MeshPhongMaterial({ shininess: 0, specular: 0x000000, color: 0x9c7a4e, flatShading: true })
      );
      sp.position.set(
        Math.sin(a) * s * 0.88,
        s * (1.25 + Math.cos(a * 1.7) * 0.42),
        Math.cos(a) * s * 0.88
      );
      g.add(sp);
    }

    // yuva
    const nest = new THREE.Mesh(
      new THREE.TorusGeometry(s * 1.02, s * 0.22, 4, 10),
      new THREE.MeshPhongMaterial({ shininess: 0, specular: 0x000000, color: 0x5e4426, flatShading: true })
    );
    nest.rotation.x = Math.PI / 2;
    nest.position.y = s * 0.3;
    g.add(nest);

    g.userData = { height: s * 2.6, shell: shell, scale: s };
    return g;
  }

  function layEgg(game, at) {
    const hp = Math.round(M.eggHpBase * (1 + (game.build.level - 1) * 0.16) * game.genMul());
    // çağ paletinden bağımsız sabit krem kabuk: her dünyada "yumurta" gibi okunur
    const color = 0xf0e2c4;
    const group = makeEggMesh(game, color);
    group.position.set(at.x, W.groundY(at.x, at.z), at.z);
    game.scene.add(group);

    const egg = {
      group: group,
      radius: group.userData.scale * 1.3,
      hp: hp,
      maxHp: hp,
      time: M.incubation,
      alive: true,
      isEgg: true,
      t: 0,
    };
    eggs.push(egg);

    EV.FX.ring(group.position, 0xffd8ea, 10, 0.9);
    game.toast('🥚 YUMURTA BIRAKILDI<br><span style="font-size:13px">' +
      Math.round(M.incubation) + ' sn kuluçka — avcılardan koru</span>', '#ffd8ea');
    return egg;
  }

  function damageEgg(game, egg, dmg) {
    if (!egg.alive) return;
    egg.hp -= Math.max(1, Math.round(dmg));
    const at = egg.group.position.clone();
    at.y += egg.group.userData.height;
    EV.UI.dmgNumber(at, '-' + U.fmt(dmg), 'hurt', game.camera);
    EV.FX.burst(at, 0xffd8ea, 4, 4);
    U.audio.hurt();

    if (egg.hp <= 0) {
      egg.alive = false;
      EV.FX.burst(at, 0xffd8ea, 22, 10);
      U.audio.die();
      game.toast('💔 YUMURTA KIRILDI', '#ff6b6b');
    }
  }

  function hatch(game, egg) {
    const pos = egg.group.position.clone();
    const stage = game.stage();
    const spec = JSON.parse(JSON.stringify(game.player.bodySpec || stage.body));
    spec.scale *= 0.7;

    const def = {
      id: 'child',
      name: 'Yavru',
      lvl: game.build.level,
      hp: game.maxHp() * 0.5,
      dmg: game.playerDamage() * 0.5,
      speed: stage.base.speed * 0.95,
      evo: 0, xp: 0, aggro: 20,
      body: spec,
    };
    const child = EV.Enemies.make(game, def, {
      ally: true, life: Infinity, name: 'Yavru',
      pos: { x: pos.x, z: pos.z },
    });
    child.isChild = true;

    EV.FX.ring(pos, 0xffe08a, 14, 1.0);
    EV.FX.burst(pos, 0xffe08a, 20, 9);
    U.audio.levelUp();
    game.toast('🐣 YAVRUN DOĞDU<br><span style="font-size:13px">Bu aşama boyunca yanında savaşır</span>', '#9de89d');
    game.gainEvo(Math.round(game.evoMax() * 0.08), Math.round(EV.Build.xpNeed(game) * 0.5), pos);
  }

  function removeEgg(game, i) {
    const egg = eggs[i];
    game.scene.remove(egg.group);
    egg.group.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    eggs.splice(i, 1);
  }

  /* =========================================================
     Genel API
     ========================================================= */

  /** Şu an gerçekten çiftleşilebilir mi? (F tuşu ve ipucu bunu kullanır) */
  function canMate(game) {
    return game.player.mating <= 0 && eggs.length === 0 &&
      children(game).length < M.maxChildren && !!nearestMate(game);
  }

  /** F tuşu. Menzilde dişi yoksa false döner. */
  function tryMate(game) {
    if (game.player.mating > 0) return false;
    if (children(game).length >= M.maxChildren) {
      game.toast('Şimdilik yeterince yavrun var', '#ffd9a0');
      return false;
    }
    if (eggs.length > 0) {
      game.toast('Önce mevcut yumurtanı çıkart', '#ffd9a0');
      return false;
    }
    const mate = nearestMate(game);
    if (!mate) return false;

    game.player.mating = M.ritual;
    game.player.mateTarget = mate;
    EV.FX.ring(game.player.group.position, 0xff8fc0, 8, 0.8);
    U.audio.blip(520, 0.3, 'sine', 0.05, 760);
    return true;
  }

  function update(game, dt) {
    const P = game.player;

    /* --- çiftleşme ritüeli --- */
    if (P.mating > 0) {
      P.mating -= dt;
      const mate = P.mateTarget;
      if (mate && mate.alive) {
        mate.stun = 0.3;                   // ritüel boyunca dişi bekler
        if (Math.random() < dt * 14) {
          EV.FX.burst(mate.group.position.clone().setY(
            mate.group.position.y + mate.group.userData.height), 0xff8fc0, 2, 3);
        }
      }
      if (P.mating <= 0) {
        P.mating = 0;
        if (mate && mate.alive) {
          layEgg(game, mate.group.position);
          // dişi görevini tamamladı, dünyadan çekilir
          const i = game.enemies.indexOf(mate);
          if (i >= 0) EV.Enemies.despawn(game, i);
          mateTimer = U.rand(M.mateRespawn[0], M.mateRespawn[1]);
        }
        P.mateTarget = null;
      }
    }

    /* --- yumurtalar --- */
    for (let i = eggs.length - 1; i >= 0; i--) {
      const egg = eggs[i];
      egg.t += dt;
      const s = egg.group.userData.shell;
      if (s) {
        // kuluçka ilerledikçe daha hızlı sallanır
        const k = 1 - egg.time / M.incubation;
        s.rotation.z = Math.sin(egg.t * (2 + k * 7)) * (0.04 + k * 0.16);
      }
      if (!egg.alive) { removeEgg(game, i); continue; }

      egg.time -= dt;
      if (egg.time <= 0) {
        hatch(game, egg);
        egg.alive = false;
        removeEgg(game, i);
      }
    }

    /* --- dişi popülasyonu --- */
    if (mates(game).length < M.maxMates && eggs.length === 0) {
      mateTimer -= dt;
      if (mateTimer <= 0) {
        mateTimer = U.rand(M.mateRespawn[0], M.mateRespawn[1]);
        spawnMate(game);
      }
    }
  }

  function clearAll(game) {
    for (let i = eggs.length - 1; i >= 0; i--) removeEgg(game, i);
    game.player.mating = 0;
    game.player.mateTarget = null;
    mateTimer = 6;
  }

  /**
   * Avcıların hedefleyebileceği, HAYATTA olan yumurta.
   * .alive kontrolü şart: kırılan yumurta bir sonraki Mating.update'e kadar
   * dizide kalıyor ve Enemies.update ondan önce koştuğu için avcılar bir kare
   * boyunca kırık yumurtaya saldırmaya devam ediyordu.
   */
  function activeEgg() {
    return (eggs.length && eggs[0].alive) ? eggs[0] : null;
  }

  return {
    M, update, tryMate, canMate, clearAll, damageEgg, activeEgg,
    nearestMate, mates, children,
    get eggs() { return eggs; },
  };
})();
