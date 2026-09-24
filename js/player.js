/* ============================================================
   player.js — girdi, TPS kamera, nişan, hedef kilidi, yetenek kullanımı

   Kontroller
     WASD hareket (kameraya göre) · Fare bak · Tekerlek yakınlaş
     Sol tık  temel saldırı (3'lü kombo, basılı tutulabilir)
     Sağ tık  basılı: nişan modu (nişangaha dönük yürü); bu sırada sol tık = uzaktan atış
     Q E F    yetenekler · R ultimate (öfke dolunca)
              yer hedefli olanlar: basılı tut → göstergeyle nişan al → bırak
     Boşluk   atılım (enerji) · Tab hedef kilitle/değiştir · X kilidi bırak
     F        (dişi yanındaysa) çiftleş
   ============================================================ */
window.EV = window.EV || {};

EV.Input = (function () {
  'use strict';

  const keys = Object.create(null);
  const pressed = new Set();
  const released = new Set();
  const mouse = { dx: 0, dy: 0, left: false, right: false, locked: false, wheel: 0, leftPressed: false, rightPressed: false, middlePressed: false };
  let canvas = null;

  function init(cv, onLockChange) {
    canvas = cv;
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;   // isim yazarken oyun tuşları devre dışı
      if (!e.repeat) pressed.add(e.code);
      keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; released.add(e.code); });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = mouse.right = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
      if (e.button === 2) { mouse.right = true; mouse.rightPressed = true; }
      if (e.button === 1) { mouse.middlePressed = true; e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) mouse.left = false;
      if (e.button === 2) mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('mousemove', (e) => {
      if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => {
      mouse.locked = document.pointerLockElement === canvas;
      if (!mouse.locked) mouse.left = mouse.right = false;
      if (onLockChange) onLockChange(mouse.locked);
    });
  }

  function requestLock() {
    if (!canvas || !canvas.requestPointerLock) return;
    const r = canvas.requestPointerLock();
    if (r && typeof r.catch === 'function') r.catch(() => { /* kilit alınamadı; oyun yine çalışır */ });
  }
  function releaseLock() { if (document.exitPointerLock) document.exitPointerLock(); }

  const down = (c) => !!keys[c];
  const hit = (c) => pressed.has(c);
  const up = (c) => released.has(c);

  /** Kare sonunda tek seferlik olayları temizler. */
  function endFrame() {
    pressed.clear();
    released.clear();
    mouse.leftPressed = mouse.rightPressed = mouse.middlePressed = false;
    mouse.dx = mouse.dy = 0;
    mouse.wheel = 0;
  }

  /* Test kancaları: otomatik oyuncu (tests/harness.js) tuş olayı üretir. */
  function _press(c) { pressed.add(c); keys[c] = true; }
  function _release(c) { released.add(c); keys[c] = false; }

  return { init, down, hit, up, keys, mouse, requestLock, releaseLock, endFrame, _press, _release };
})();

/* ============================================================ */
EV.Player = (function () {
  'use strict';

  const CFG = EV.CFG;
  const T = CFG.TUNE;
  const U = EV.U;
  const W = EV.World;
  const I = EV.Input;
  const DATA = EV.DATA;

  const SLOT_KEYS = ['KeyQ', 'KeyE', 'KeyF'];
  const GROUND = { zone: 1, leap: 1 };
  const raycaster = new THREE.Raycaster();
  const CENTER = new THREE.Vector2(0, 0);
  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();

  function create(game) {
    const P = {
      group: null, bodySpec: null,
      vel: new THREE.Vector3(), impulse: new THREE.Vector3(),
      hp: 100, energy: 100, rage: 0, shield: 0, shieldT: 0,
      alive: true, iframe: 0, radius: 1, sizeScale: 1,
      speed01: 0, t: 0, moving: false,
      yaw: 0, pitch: 0.4, zoom: 1, aimYaw: 0, faceT: 0, fps: loadFps(), autoCast: loadAuto(), autoT: 0,
      aimPoint: new THREE.Vector3(), hover: null, lockTarget: null,
      stats: null, buffs: [], buffOnHit: [],
      dash: null, leap: null, leapY: 0, hunt: null,
      basicCd: 0, combo: 0, comboT: 0, dashCd: 0, aiming: null,
      mating: 0, mateTarget: null, lastCombatT: -99, st: null,
      pivot: new THREE.Vector3(),
    };
    return P;
  }

  /** Bedeni çağa, taşınan parçalara ve nesle göre kurar. */
  function rebuild(game) {
    const P = game.player;
    const stage = game.stage();
    const spec = JSON.parse(JSON.stringify(stage.body));
    spec.extras = EV.Build.extras(game);
    if (game.generation > 0) {
      spec.parts.horns = true;
      spec.scale *= 1 + Math.min(game.generation, 6) * 0.05;
      const c = new THREE.Color(spec.body);
      c.offsetHSL(0.03 * game.generation, 0.05, -0.03 * Math.min(game.generation, 5));
      spec.body = c.getHex();
    }
    const old = P.group;
    const pos = old ? old.position.clone() : new THREE.Vector3();
    const rot = old ? old.rotation.y : 0;
    if (old) { game.scene.remove(old); EV.Creature.dispose(old); }
    P.group = EV.Creature.build(spec);
    P.group.position.copy(pos);
    P.group.rotation.y = rot;
    P.bodySpec = spec;
    P.sizeScale = spec.scale;
    P.radius = P.group.userData.radius;
    if (stage.cam && stage.cam.pitch != null) P.pitch = P.fps ? FPS_PITCH : stage.cam.pitch;
    P.pivot.copy(pos);
    game.scene.add(P.group);
  }

  /* =========================================================
     Nişan ışını
     ========================================================= */
  function raySphere(o, d, c, r) {
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
    const b = ox * d.x + oy * d.y + oz * d.z;
    const cc = ox * ox + oy * oy + oz * oz - r * r;
    const h = b * b - cc;
    if (h < 0) return Infinity;
    const t = -b - Math.sqrt(h);
    return t > 0 ? t : Infinity;
  }

  function updateAim(game, camera) {
    const P = game.player;
    raycaster.setFromCamera(CENTER, camera);
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    const pp = P.group.position;

    let best = Infinity, hover = null;
    EV.Enemies.forEachNear(pp.x, pp.z, 70, (e) => {
      if (e.ally || e.peaceful) return;
      const c = e.group.userData.cap;
      const s = EV.Creature.capsule(e.group);
      const y = e.group.position.y + e.group.userData.hipY;
      const rr = c.r * 1.1 + 0.3;
      for (let k = 0; k <= 2; k++) {
        _v.set(U.lerp(s.ax, s.bx, k / 2), y, U.lerp(s.az, s.bz, k / 2));
        const t = raySphere(o, d, _v, rr);
        if (t < best) { best = t; hover = e; }
      }
    });

    let tGround = 140;
    for (let t = 2; t < 140; t += 1.2) {
      _w.copy(o).addScaledVector(d, t);
      if (_w.y < W.height(_w.x, _w.z) + 0.2) {
        let lo = t - 1.2, hi = t;
        for (let k = 0; k < 6; k++) {
          const m = (lo + hi) / 2;
          _w.copy(o).addScaledVector(d, m);
          if (_w.y < W.height(_w.x, _w.z) + 0.2) hi = m; else lo = m;
        }
        tGround = hi;
        break;
      }
    }

    P.hover = best < tGround ? hover : null;
    P.aimPoint.copy(o).addScaledVector(d, Math.min(best, tGround));
    if (P.lockTarget && P.lockTarget.alive) {
      const lp = P.lockTarget.group.position;
      P.aimPoint.set(lp.x, lp.y + P.lockTarget.group.userData.hipY, lp.z);
    }
  }

  /* ---------------- hedef kilidi ---------------- */
  function cycleLock(game, camera) {
    const P = game.player;
    const pp = P.group.position;
    const list = [];
    EV.Enemies.forEachNear(pp.x, pp.z, 45, (e) => {
      if (e.ally || e.peaceful) return;
      _v.copy(e.group.position); _v.y += e.group.userData.hipY;
      _v.project(camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) return;
      list.push({ e, d: _v.x * _v.x + _v.y * _v.y });
    });
    list.sort((a, b) => a.d - b.d);
    if (!list.length) { P.lockTarget = null; return; }
    const i = list.findIndex((x) => x.e === P.lockTarget);
    P.lockTarget = list[(i + 1) % list.length].e;
    U.audio.blip(900, 0.05, 'sine', 0.03);
  }

  /* =========================================================
     Temel saldırı (3'lü kombo, hedefe mıknatıslanır)
     ========================================================= */
  /* Menzilli temel saldırı (sağ tık basılıyken sol tık): basılı tutunca şarj olur,
     bırakınca atar. Hızlı tık = zayıf atış (yakın dövüşün ~%40'ı / sn);
     tam şarj (1 sn) = ~4 kat hasar, büyük/hızlı mermi, 1 hedefi deler
     (~%60'ı / sn). Yakın dövüş yine en güçlüsü, uzak ise güvenli. */
  const SHOT = { mult: 0.6, maxMult: 2.5, cd: 0.65, charge: 1.0, grace: 0.12 };
  function chargeFrac(held) { return U.clamp((held - SHOT.grace) / (SHOT.charge - SHOT.grace), 0, 1); }

  function rangedBasic(game, held) {
    const P = game.player;
    const S = P.stats;
    const t = P.lockTarget && P.lockTarget.alive && !P.lockTarget.ally ? P.lockTarget : null;
    const pos = P.group.position;
    const tp = t ? t.group.position : P.aimPoint;
    P.aimYaw = Math.atan2(tp.x - pos.x, tp.z - pos.z);
    P.group.rotation.y = P.aimYaw;
    EV.Creature.attack(P.group, 0.15);
    const k = chargeFrac(held || 0);
    EV.Skills.basicShot(game, t, S.dmg * U.lerp(SHOT.mult, SHOT.maxMult, k), {
      size: 0.3 + 0.25 * k, speed: 38 + 16 * k, pierce: k >= 1 ? 1 : 0, knock: 1.5 + 6 * k,
    });
    P.basicCd = SHOT.cd / S.atkSpd;
    P.faceT = Math.max(0.3, P.basicCd + 0.1);
    P.combo = 0;
    P.lastCombatT = game.time;
  }

  function basic(game) {
    const P = game.player;
    const S = P.stats;
    const st = game.stage();
    const pos = P.group.position;
    const range = st.basic.range * Math.sqrt(P.sizeScale) * (1 + (S.area - 1) * 0.3);
    const step = P.comboT > 0 ? (P.combo + 1) % 3 : 0;
    P.combo = step;
    P.comboT = 0.95;
    const mult = [1, 1.1, 1.7][step];

    let tgt = null;
    const cand = [P.lockTarget, P.hover];
    for (let i = 0; i < cand.length && !tgt; i++) {
      const c = cand[i];
      if (c && c.alive && !c.ally && EV.Creature.surfDist(c.group, pos.x, pos.z) < range + 3) tgt = c;
    }
    if (!tgt) {
      tgt = EV.Enemies.nearest(pos.x, pos.z, range + 1.5, (e) => {
        if (e.ally || e.peaceful) return false;
        const a = Math.atan2(e.group.position.x - pos.x, e.group.position.z - pos.z);
        return Math.abs(U.wrapAngle(a - P.aimYaw)) < 1.2;
      });
    }
    if (tgt) {
      EV.Creature.closestPoint(tgt.group, pos.x, pos.z, _v);
      P.aimYaw = Math.atan2(_v.x - pos.x, _v.z - pos.z);
      const gap = EV.Creature.surfDist(tgt.group, pos.x, pos.z) - range * 0.6;
      if (gap > 0) P.impulse.add(new THREE.Vector3(Math.sin(P.aimYaw), 0, Math.cos(P.aimYaw)).multiplyScalar(Math.min(gap, 2.5) * 5));
    }
    P.faceT = 0.45;
    P.group.rotation.y = P.aimYaw;
    const yaw = P.aimYaw;
    EV.Creature.attack(P.group, 0.2 + step * 0.04);
    const arc = step === 2 ? 2.0 : 1.4;
    EV.FX.slash(pos, yaw + (step === 1 ? 0.3 : step === 0 ? -0.3 : 0), range + P.radius, arc, step === 2 ? 0xffe08a : 0xffffff);

    EV.Enemies.forEachNear(pos.x, pos.z, range + 6, (e) => {
      if (e.ally || e.peaceful) return;
      if (EV.Creature.surfDist(e.group, pos.x, pos.z) > range + P.radius * 0.5) return;
      EV.Creature.closestPoint(e.group, pos.x, pos.z, _v);
      const dx = _v.x - pos.x, dz = _v.z - pos.z, dd = Math.hypot(dx, dz);
      if (dd > 1 && Math.abs(U.wrapAngle(Math.atan2(dx, dz) - yaw)) > arc / 2 + Math.atan2(e.radius, dd)) return;
      EV.Combat.hitEnemy(game, e, S.dmg * mult, { source: 'player', basic: true, knock: step === 2 ? 8 : 3, from: pos });
    });
    P.basicCd = 0.55 / S.atkSpd;
    P.faceT = Math.max(0.45, P.basicCd + 0.12);   // vuruşlar arası boşlukta gövde dönmesin
    P.lastCombatT = game.time;
  }

  /* ---------------- atılım (Boşluk) ---------------- */
  function dash(game, wish) {
    const P = game.player;
    const cost = T.dashCost * P.stats.dashCost;
    if (P.dashCd > 0) return;
    if (P.energy < cost) { EV.UI.noEnergy('dash'); return; }
    const dir = wish.lengthSq() > 0.01 ? wish.clone().normalize() : new THREE.Vector3(Math.sin(P.group.rotation.y), 0, Math.cos(P.group.rotation.y));
    P.energy -= cost;
    P.dash = { dir, speed: T.dashSpeed, left: T.dashDist, dmg: 0, width: 0, st: null, hitSet: new Set(), src: 'player' };
    P.iframe = Math.max(P.iframe, 0.25 + T.dashDist / T.dashSpeed);
    P.dashCd = T.dashCd;
    EV.FX.burst(P.group.position.clone().setY(P.group.position.y + 0.8), 0xffffff, 6, 4);
    U.audio.blip(300, 0.12, 'sine', 0.04, 700);
    EV.Build.onDash(game);
    EV.UI.flashSlot('dash');
  }

  /* ---------------- yetenek ---------------- */
  function slotDef(game, slot) {
    const b = game.build;
    const s = slot === 'R' ? b.ult : b.skills[slot];
    return s ? { s, def: DATA.skill(s.id) } : null;
  }

  function isGround(def) { return !!GROUND[def.kind] && def.base.castRange; }

  function tryCast(game, slot) {
    const P = game.player;
    const sd = slotDef(game, slot);
    if (!sd) return;
    const { s, def } = sd;
    const ult = slot === 'R';
    const p = DATA.params(def, s.rank);
    if (s.cd > 0) { EV.UI.flashSlot(slot, 'cd'); return; }
    if (ult && P.rage < T.rageMax - 0.01) { EV.UI.flashSlot(slot, 'rage'); return; }
    if (!ult && P.energy < p.cost) { EV.UI.noEnergy(slot); return; }

    const opts = { point: P.aimPoint.clone(), target: P.lockTarget || P.hover, source: 'player' };
    P.aimYaw = Math.atan2(P.aimPoint.x - P.group.position.x, P.aimPoint.z - P.group.position.z);
    const ok = EV.Skills.cast(game, def, s.rank, opts);
    if (!ok) { EV.UI.flashSlot(slot, 'target'); return; }

    if (ult) { P.rage = 0; U.audio.ult(); }
    else P.energy -= p.cost;
    s.cd = p.cd * (1 - P.stats.cdr);
    s.cdMax = s.cd;
    game.build.uses[s.id] = (game.build.uses[s.id] || 0) + 1;
    P.faceT = 0.5;
    P.lastCombatT = game.time;
    EV.UI.flashSlot(slot);
  }

  /* ---------------- otomatik yetenek (G ile aç/kapat) ----------------
     Açıkken Q/E/F, beklemesi bitince ve menzilde hedef varken kendiliğinden
     atılır. Hareket yetenekleri (atılım, sıçrama, av) atılmaz: oyuncuyu
     istemediği yere fırlatırdı. Ultimate (R) de atılmaz: öfke değerli, oyuncu
     onu boss / kalabalık için saklar. Atılım için enerji payı bırakılır, gizlenirken
     (saklanma yeri) atılmaz, yetenekler arasında kısa ara verilir. */
  const AUTO_KEY = 'evolve_auto';
  const AUTO_SKIP = { dash: 1, leap: 1, hunt: 1 };
  const AUTO_GAP = 0.35;          // iki otomatik atış arası (sn)
  const AUTO_RESERVE = 15;        // atılım için bırakılan enerji
  function loadAuto() { try { return localStorage.getItem(AUTO_KEY) === '1'; } catch (e) { return false; } }

  function toggleAuto(game) {
    const P = game.player;
    P.autoCast = !P.autoCast;
    try { localStorage.setItem(AUTO_KEY, P.autoCast ? '1' : '0'); } catch (e) { /* gizli sekme */ }
    game.toast(P.autoCast ? '🔁 Otomatik yetenek AÇIK <span class="sub">(ulti, sıçrama, atılım hariç · G)</span>' : 'Otomatik yetenek kapalı',
      P.autoCast ? '#9de89d' : '#ffb35a', 1600);
  }

  /** Yeteneğin hedefe atılabileceği yüzey mesafesi. */
  function autoRange(def, p) {
    switch (def.kind) {
      case 'bolt': return (p.range || 20) * 0.9;
      case 'chain': return p.range || 16;
      case 'cone': return (p.range || 4) + 1;
      case 'nova': return (p.r || 5) * 0.9;
      case 'zone': return p.castRange || 18;
      case 'trap': return (p.r || 3) + 2;
      case 'orbit': return (p.r || 3) + 2;
      case 'buff': return 10;
      case 'summon': return 16;
      default: return 0;
    }
  }

  function autoTarget(game) {
    const P = game.player;
    const lt = P.lockTarget;
    if (lt && lt.alive && !lt.ally && !lt.peaceful) return lt;
    const pos = P.group.position;
    return EV.Enemies.nearest(pos.x, pos.z, 22, (e) => !e.ally && !e.peaceful);
  }

  function autoCast(game, dt) {
    const P = game.player;
    P.autoT -= dt;
    if (P.autoT > 0 || P.aiming || P.hidden) return;
    const t = autoTarget(game);
    if (!t) return;
    const pos = P.group.position;
    const d = EV.Creature.surfDist(t.group, pos.x, pos.z);
    for (let slot = 0; slot < 3; slot++) {
      const sd = slotDef(game, slot);
      if (!sd || AUTO_SKIP[sd.def.kind] || sd.s.cd > 0) continue;
      const p = DATA.params(sd.def, sd.s.rank);
      if (P.energy - p.cost < AUTO_RESERVE) continue;
      if (d > autoRange(sd.def, p)) continue;
      // nişanı geçici olarak hedefe çevir (yer hedefliler hedefin altına düşer)
      const saveAim = _aimSave.copy(P.aimPoint), saveHover = P.hover;
      const tp = t.group.position;
      P.aimPoint.set(tp.x, tp.y + t.group.userData.hipY, tp.z);
      if (!P.lockTarget) P.hover = t;
      const cd0 = sd.s.cd;
      tryCast(game, slot);
      P.aimPoint.copy(saveAim);
      P.hover = saveHover;
      if (sd.s.cd > cd0) { P.autoT = AUTO_GAP; return; }
    }
  }
  const _aimSave = new THREE.Vector3();

  /* ---------------- kalıtsal yankılar ---------------- */
  function updateEchoes(game, dt) {
    const P = game.player;
    const pp = P.group.position;
    game.legacy.echoes.forEach((ec) => {
      ec.t -= dt;
      if (ec.t > 0) return;
      const def = DATA.skill(ec.id);
      if (!def) { ec.t = 10; return; }
      const e = EV.Enemies.nearest(pp.x, pp.z, 18, (x) => !x.ally && !x.peaceful);
      if (!e) { ec.t = 1; return; }
      const pt = e.group.position.clone(); pt.y += e.group.userData.hipY;
      EV.Skills.cast(game, def, ec.rank, { point: pt, target: e, source: 'echo', dmgMul: 0.6 });
      ec.t = Math.max(4, (def.cd || 3) * 2.5);
      EV.UI.echoPulse(ec.id);
    });
  }

  /* =========================================================
     Ana güncelleme
     ========================================================= */
  function update(game, dt, camera) {
    const P = game.player;
    const b = game.build;
    P.t += dt;

    /* --- bakış ve yakınlaşma --- */
    if (I.mouse.locked) {
      P.yaw -= I.mouse.dx * 0.0022;
      P.pitch = P.fps ? U.clamp(P.pitch + I.mouse.dy * 0.0016, -1.1, 1.2)
        : U.clamp(P.pitch + I.mouse.dy * 0.0016, -0.35, 1.15);
    }
    if (I.mouse.wheel) P.zoom = U.clamp(P.zoom + I.mouse.wheel * 0.08, 0.6, 1.6);

    /* --- buff'lar ve statlar --- */
    const bm = {};
    P.buffOnHit = [];
    for (let i = P.buffs.length - 1; i >= 0; i--) {
      const bf = P.buffs[i];
      bf.t -= dt;
      if (bf.t <= 0) { P.buffs.splice(i, 1); continue; }
      for (const k in bf.mods) bm[k] = (bm[k] || 0) + bf.mods[k];
      if (bf.onHitSt) P.buffOnHit.push.apply(P.buffOnHit, bf.onHitSt);
    }
    const prevMax = P.stats ? P.stats.maxHp : 0;
    P.stats = EV.Build.stats(game, bm);
    const S = P.stats;
    if (prevMax && S.maxHp > prevMax) P.hp += S.maxHp - prevMax;   // can artışı anında dolsun
    P.hp = Math.min(P.hp, S.maxHp);

    if (P.st) EV.Status.tick(game, P, dt);
    if (!P.alive) { updateCamera(game, camera, dt); return; }

    /* --- sayaçlar ve dolumlar --- */
    P.iframe -= dt; P.dashCd -= dt; P.basicCd -= dt; P.comboT -= dt; P.faceT -= dt;
    if (P.shieldT > 0) { P.shieldT -= dt; if (P.shieldT <= 0) P.shield = 0; }
    b.skills.forEach((s) => { if (s.cd > 0) s.cd -= dt; });
    if (b.ult && b.ult.cd > 0) b.ult.cd -= dt;
    P.energy = Math.min(S.maxEnergy, P.energy + S.energyRegen * dt);
    P.hp = Math.min(S.maxHp, P.hp + S.maxHp * S.hpRegen * dt);
    // dolu bar hazır bekler (ultimate ile açılış yapılabilsin); sadece dolmamış öfke söner
    if (P.rage < T.rageMax && game.time - P.lastCombatT > T.rageDecayDelay) P.rage = Math.max(0, P.rage - T.rageDecay * dt);

    updateAim(game, camera);

    /* --- hedef kilidi (T / orta tuş) — Tab artık çanta --- */
    if (I.hit('KeyT') || I.mouse.middlePressed) cycleLock(game, camera);
    if (I.hit('KeyX')) P.lockTarget = null;
    if (P.lockTarget && (!P.lockTarget.alive || P.lockTarget.group.position.distanceTo(P.group.position) > 50)) P.lockTarget = null;

    /* --- hareket --- */
    let ix = 0, iz = 0;
    if (I.down('KeyW') || I.down('ArrowUp')) iz += 1;
    if (I.down('KeyS') || I.down('ArrowDown')) iz -= 1;
    if (I.down('KeyA') || I.down('ArrowLeft')) ix -= 1;
    if (I.down('KeyD') || I.down('ArrowRight')) ix += 1;
    const fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix);
    if (wish.lengthSq() > 0.001) wish.normalize();

    const smul = EV.Status.speedMul(P);
    const aimMode = I.mouse.right;
    const busy = P.mating > 0;
    const inMotion = EV.Skills.updateMotion(game, dt);

    if (!inMotion) {
      const speed = S.speed * smul * (aimMode ? 0.78 : 1) * (busy ? 0 : 1);
      const k = Math.min(1, (wish.lengthSq() > 0 ? 42 : 26) * dt / Math.max(speed, 1));
      P.vel.x = U.lerp(P.vel.x, wish.x * speed, k);
      P.vel.z = U.lerp(P.vel.z, wish.z * speed, k);
      P.impulse.multiplyScalar(Math.max(0, 1 - dt * 4.5));
      if (P.impulse.lengthSq() < 0.02) P.impulse.set(0, 0, 0);
      P.group.position.x += (P.vel.x + P.impulse.x) * dt;
      P.group.position.z += (P.vel.z + P.impulse.z) * dt;
      W.resolveCollision(P.group.position, P.radius);
    } else {
      P.vel.set(0, 0, 0);
    }
    P.group.position.y = W.groundY(P.group.position.x, P.group.position.z) + (P.leapY || 0);
    const spd = Math.hypot(P.vel.x + P.impulse.x, P.vel.z + P.impulse.z);
    P.moving = spd > 0.5;

    /* --- gizlilik: saklanma yerinde ve son 2 sn saldırmadıysan --- */
    P.cover = W.inCover(P.group.position.x, P.group.position.z);
    P.hidden = !!P.cover && game.time - P.lastCombatT > 2 && !game.bossActive;
    P.hiddenT = P.hidden ? (P.hiddenT || 0) + dt : 0;

    /* --- yön: hareket yönüne dön; saldırırken / nişan modunda nişana --- */
    const aimYawNow = Math.atan2(P.aimPoint.x - P.group.position.x, P.aimPoint.z - P.group.position.z);
    let face = null;
    if (P.faceT > 0) face = P.aimYaw;
    else if (P.fps) face = P.yaw;
    else if (aimMode || P.aiming) face = aimYawNow;
    else if (P.lockTarget && !P.moving) face = aimYawNow;
    else if (P.moving && !inMotion) face = Math.atan2(P.vel.x, P.vel.z);
    if (face != null) P.group.rotation.y = U.wrapAngle(U.approachAngle(P.group.rotation.y, face, dt * 14));
    if (P.faceT <= 0) P.aimYaw = aimYawNow;

    if (I.hit('KeyV')) toggleFps(game);
    if (I.hit('KeyG')) toggleAuto(game);

    /* --- girdiler --- */
    const canAct = !inMotion && !busy && !EV.Status.stunned(P);
    if (canAct) {
      // nişan modunda sol tık şarj eder, bırakınca atar (sağ tık önce bırakılsa da atış kaybolmaz)
      if (!P.aiming && (P.charge > 0 || (aimMode && I.mouse.left && P.basicCd <= 0))) {
        if (I.mouse.left) {
          const was = chargeFrac(P.charge || 0);
          P.charge = (P.charge || 0) + dt;
          if (was < 1 && chargeFrac(P.charge) >= 1) U.audio.blip(880, 0.08, 'triangle', 0.05);   // tam şarj sesi
        } else {
          rangedBasic(game, P.charge);
          P.charge = 0;
        }
      } else if (I.mouse.left && P.basicCd <= 0 && !P.aiming && !aimMode) basic(game);
      if (I.hit('Space')) dash(game, wish);

      const slots = [0, 1, 2, 'R'];
      const codes = SLOT_KEYS.concat(['KeyR']);
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i], code = codes[i];
        const sd = slotDef(game, slot);
        if (!sd) continue;
        const ground = isGround(sd.def);
        if (I.hit(code)) {
          // F: menzilde dişi varsa çiftleşme önceliklidir
          if (code === 'KeyF' && EV.Mating.canMate(game)) continue;
          if (ground) P.aiming = { slot, code, def: sd.def, rank: sd.s.rank };
          else tryCast(game, slot);
        }
        if (P.aiming && P.aiming.code === code && I.up(code)) {
          P.aiming = null;
          EV.Decal.hideIndicator();
          tryCast(game, slot);
        }
      }
      if (P.aiming && (I.mouse.rightPressed || I.hit('Escape'))) { P.aiming = null; EV.Decal.hideIndicator(); }
      if (P.autoCast) autoCast(game, dt);
    } else if (P.aiming) {
      P.aiming = null;
      EV.Decal.hideIndicator();
    }

    // bırakma olayı duraklatmada kaybolduysa nişanı iptal et (yoksa sol tık kilitli kalıyordu)
    if (P.aiming && !I.down(P.aiming.code)) { P.aiming = null; EV.Decal.hideIndicator(); }
    if (P.aiming) {
      const p = DATA.params(P.aiming.def, P.aiming.rank);
      const pp = P.group.position;
      let dx = P.aimPoint.x - pp.x, dz = P.aimPoint.z - pp.z;
      const l = Math.hypot(dx, dz);
      if (l > p.castRange) { dx *= p.castRange / l; dz *= p.castRange / l; }
      EV.Decal.showIndicator(pp.x, pp.z, p.castRange, pp.x + dx, pp.z + dz, (p.r || 3) * S.area, 0x7fd9ff);
    }

    /* --- çiftleşme --- */
    if (I.hit('KeyF') && !busy && EV.Mating.canMate(game)) EV.Mating.tryMate(game);

    updateEchoes(game, dt);

    P.speed01 = U.lerp(P.speed01, U.clamp(spd / Math.max(S.speed, 1), 0, 1.4), Math.min(1, dt * 9));
    EV.Creature.animate(P.group, dt, P.speed01, P.t);
    updateCamera(game, camera, dt);
  }

  /* =========================================================
     Kamera — omuz üstü, nişangah = ekran merkezi
     ========================================================= */
  const _fwd = new THREE.Vector3();
  const _cam = new THREE.Vector3();
  /* ---------------- birinci şahıs (FPS) kamera: V ile aç/kapat ---------------- */
  const FPS_KEY = 'evolve_fps';
  const FPS_PITCH = 0.08;
  function loadFps() { try { return localStorage.getItem(FPS_KEY) === '1'; } catch (e) { return false; } }

  function toggleFps(game) {
    const P = game.player;
    P.fps = !P.fps;
    try { localStorage.setItem(FPS_KEY, P.fps ? '1' : '0'); } catch (e) { /* gizli sekme */ }
    const c = game.stage().cam;
    P.pitch = P.fps ? FPS_PITCH : (c && c.pitch != null ? c.pitch : 0.4);
    P.group.visible = !P.fps;
    game.toast(P.fps ? '👁️ Birinci şahıs kamera <span class="sub">(V ile geri dön)</span>' : '🎥 Üçüncü şahıs kamera', '#cfe8ff', 1400);
  }

  /** Göz: gövdenin önü, boyunun ~%80'i. Kendi gövden gizlenir (kameranın içine girmesin). */
  function fpsCamera(game, camera) {
    const P = game.player;
    const pp = P.group.position;
    const cap = P.group.userData.cap;
    const fwdOff = (cap.cz + cap.hl + cap.r * 0.4);
    P.group.visible = false;
    _cam.set(pp.x + Math.sin(P.yaw) * fwdOff, pp.y + P.group.userData.height * 0.8, pp.z + Math.cos(P.yaw) * fwdOff);
    const minY = W.height(_cam.x, _cam.z) + 0.35;
    if (_cam.y < minY) _cam.y = minY;
    P.pivot.copy(_cam);
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    _fwd.set(Math.sin(P.yaw) * cp, -sp, Math.cos(P.yaw) * cp);
    camera.position.copy(_cam);
    camera.lookAt(_w.copy(_cam).add(_fwd));
    camera.updateMatrixWorld();
  }

  function updateCamera(game, camera, dt) {
    const P = game.player;
    if (P.fps && P.alive) return fpsCamera(game, camera);
    if (!P.group.visible) P.group.visible = true;
    const stage = game.stage();
    const c = stage.cam;
    const s = P.sizeScale;
    const pp = P.group.position;

    const target = _v.set(pp.x, pp.y - (P.leapY || 0) * 0.5 + c.height * s, pp.z);
    P.pivot.lerp(target, Math.min(1, dt * 12));

    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    _fwd.set(Math.sin(P.yaw) * cp, -sp, Math.cos(P.yaw) * cp);
    const dist = c.dist * s * P.zoom * (I.mouse.right ? 0.8 : 1);
    const sh = T.shoulder * Math.sqrt(s);
    _cam.copy(P.pivot).addScaledVector(_fwd, -dist);
    _cam.x += -Math.cos(P.yaw) * sh;
    _cam.z += Math.sin(P.yaw) * sh;
    const minY = W.height(_cam.x, _cam.z) + 1.2;
    if (_cam.y < minY) _cam.y = minY;
    camera.position.copy(_cam);
    camera.lookAt(_w.copy(_cam).add(_fwd));
    // nişan ışını bu karede kullanılacak; render beklenmeden matris güncel olmalı
    camera.updateMatrixWorld();
  }

  /** 0..1 şarj oranı (arayüz için). */
  function charge(game) { const P = game.player; return P && P.charge > 0 ? chargeFrac(P.charge) : -1; }

  return { create, rebuild, update, updateCamera, cycleLock, charge, toggleFps, toggleAuto };
})();
