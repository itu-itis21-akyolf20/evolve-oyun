/* ============================================================
   skills.js — yetenek motoru

   Veriyi (data/*.js) okur, türüne göre çalıştırır:
     bolt  cone  nova  zone  dash  leap  chain  buff  summon  orbit  trap  hunt
     beam      nişanı izleyen sürekli ışın (tıklarla vurur; delen / ilk hedefte duran)
     barrage   nişan bölgesine gecikmeli yağmur: yerde işaret, sonra darbe
     boomerang gidip dönen disk: gidişte ve dönüşte vurur
     totem     yere dikilen nesne: en yakına atar / yıldırım / çevresine nabız
     blink     nişana ışınlanır (ya da hedefin arkasına / toprak altından)
     wave      önüne doğru genişleyen dalga (yay ya da düz duvar), sürükleyebilir
   Ayrıca kalıcı nesneleri yönetir: mermiler, alanlar, yörüngeler,
   tuzaklar, ışınlar, yağmur darbeleri, totemler, dalgalar, zamanlanmış
   darbeler ve oyuncunun atılım/sıçrama hareketi.

   cast(game, def, rank, opts)
     opts.point   nişan noktası (Vector3)
     opts.target  kilitli / nişandaki düşman (varsa)
     opts.source  'player' | 'echo'
     opts.dmgMul  hasar çarpanı (yankı %60)
   Başarısızsa false döner (ör. zincir için hedef yok) — enerji harcanmaz.
   ============================================================ */
window.EV = window.EV || {};

EV.Skills = (function () {
  'use strict';

  const U = EV.U;
  const CFG = EV.CFG;
  const DATA = EV.DATA;

  let scene = null;
  const projs = [];
  const zones = [];
  const orbits = [];
  const traps = [];
  const timers = [];
  const projGeo = new THREE.IcosahedronGeometry(1, 0);
  const _v = new THREE.Vector3();
  const _c = { x: 0, z: 0 };

  function init(sc) { scene = sc; }

  function tagColor(def) {
    const t = def.tags && CFG.TAGS[def.tags[0]];
    return t ? new THREE.Color(t.color).getHex() : 0xffffff;
  }

  const P = (game) => game.player;

  function chest(game, fwd) {
    const p = P(game);
    const y = p.group.position.y + p.group.userData.height * 0.55;
    return new THREE.Vector3(
      p.group.position.x + Math.sin(p.aimYaw) * (fwd || 0),
      y,
      p.group.position.z + Math.cos(p.aimYaw) * (fwd || 0));
  }

  /** Oyuncudan nişan noktasına yatay birim yön. */
  function flatDir(game, point) {
    const p = P(game).group.position;
    const dx = point.x - p.x, dz = point.z - p.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.3) return new THREE.Vector3(Math.sin(P(game).aimYaw), 0, Math.cos(P(game).aimYaw));
    return new THREE.Vector3(dx / l, 0, dz / l);
  }

  function clampPoint(game, point, range) {
    const p = P(game).group.position;
    let dx = point.x - p.x, dz = point.z - p.z;
    const l = Math.hypot(dx, dz);
    if (l > range) { dx *= range / l; dz *= range / l; }
    const v = { x: p.x + dx, z: p.z + dz };
    EV.World.clampToPlay(v);
    return v;
  }

  function later(t, fn) { timers.push({ t, fn }); }

  /* =========================================================
     MERMİLER
     ========================================================= */
  function spawnProj(game, o) {
    const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: o.color, transparent: true, opacity: o.tick ? 0.55 : 1 }));
    m.scale.set(o.size, o.tick ? o.size * 1.6 : o.size, o.size * (o.tick ? 1 : 1.8));
    m.position.copy(o.pos);
    scene.add(m);
    projs.push(Object.assign({ mesh: m, traveled: 0, hitSet: new Set(), tickMap: new Map(), dead: false }, o));
  }

  function projHit(game, pr, e) {
    const from = pr.pull ? P(game).group.position : pr.mesh.position;
    let knock = pr.knock || 0;
    if (pr.pull) knock = Math.min(30, e.group.position.distanceTo(from) * 3.2);
    EV.Combat.hitEnemy(game, e, pr.dmg, { source: pr.src, st: pr.st, pow: pr.pow, knock, from, pull: !!pr.pull, basic: !!pr.basic, noRage: !!pr.noRage });
    if (pr.chainOnHit) chainFrom(game, e, pr.chainOnHit, pr.dmg * 0.6, pr.st, pr.src, pr.pow, 9);
  }

  function explode(game, pr) {
    const p = pr.mesh.position;
    EV.Combat.hitArea(game, p.x, p.z, pr.explode, pr.dmg * 0.7, { source: pr.src, st: pr.st, pow: pr.pow, knock: 4, from: p });
    EV.FX.ring(p, pr.color, pr.explode, 0.35);
    EV.FX.burst(p, pr.color, 8, 6);
  }

  function updateProjs(game, dt) {
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      if (pr.rang) {
        updateRang(game, pr, dt);
        if (pr.dead) { drop(pr.mesh); projs.splice(i, 1); }
        continue;
      }
      const step = pr.speed * dt;
      pr.mesh.position.addScaledVector(pr.dir, step);
      pr.traveled += step;
      pr.mesh.rotation.y += dt * (pr.tick ? 10 : 6);
      const p = pr.mesh.position;
      const gy = EV.World.height(p.x, p.z);

      if (pr.tick) {
        p.y = gy + pr.size * 0.7 + EV.World.hover;
        pr.tickMap.forEach((t, id) => { if (t > 0) pr.tickMap.set(id, t - dt); });
        EV.Enemies.forEachNear(p.x, p.z, pr.size + 6, (e) => {
          if (e.ally || e.peaceful || (pr.tickMap.get(e.id) || 0) > 0) return;
          if (EV.Creature.surfDist(e.group, p.x, p.z) <= pr.size) {
            pr.tickMap.set(e.id, pr.tick);
            EV.Combat.hitEnemy(game, e, pr.dmg, { source: pr.src, st: pr.st, pow: pr.pow, knock: pr.knock, from: p, noRage: true });
          }
        });
      } else {
        if (p.y < gy + 0.05) {
          if (pr.explode) explode(game, pr);
          pr.dead = true;
        } else {
          EV.Enemies.forEachNear(p.x, p.z, pr.size + 6, (e) => {
            if (pr.dead || e.ally || e.peaceful || pr.hitSet.has(e.id)) return;
            const dy = p.y - e.group.position.y;
            if (dy < -1.2 || dy > e.group.userData.height + 1.2) return;
            if (EV.Creature.surfDist(e.group, p.x, p.z) > pr.size) return;
            pr.hitSet.add(e.id);
            projHit(game, pr, e);
            if (pr.pierce > 0) pr.pierce--;
            else {
              if (pr.explode) explode(game, pr);
              pr.dead = true;
            }
          });
        }
      }
      if (!pr.dead && pr.traveled >= pr.range) {
        if (pr.explode) explode(game, pr);
        pr.dead = true;
      }
      if (pr.dead) {
        scene.remove(pr.mesh);
        pr.mesh.material.dispose();
        projs.splice(i, 1);
      }
    }
  }

  /** Nişan modunda (sağ tık basılı) sol tık: kilitli hedefe ya da nişangaha tek mermi. */
  const SHOT_COLOR = [0x9de89d, 0xffc06a, 0xf0e2c8];
  function basicShot(game, target, dmg, o) {
    o = o || {};
    const pl = P(game);
    const from = chest(game, 1.0);
    const aimAt = target ? target.group.position.clone().setY(target.group.position.y + target.group.userData.hipY) : pl.aimPoint;
    const dir = new THREE.Vector3().subVectors(aimAt, from);
    const flatLen = Math.hypot(dir.x, dir.z);
    if (flatLen < 0.3) dir.set(Math.sin(pl.aimYaw), 0, Math.cos(pl.aimYaw));
    else dir.y = U.clamp(dir.y / flatLen, -0.35, 0.25) * flatLen;
    dir.normalize();
    spawnProj(game, {
      pos: from, dir, speed: o.speed || 38, range: 26, size: o.size || 0.3, dmg, st: [], pow: pl.stats.dmg * pl.stats.statusPower,
      pierce: o.pierce || 0, explode: 0, tick: 0, knock: o.knock || 1.5, chainOnHit: 0, color: SHOT_COLOR[game.stageIndex] || 0xffffff,
      src: 'player', basic: true,
    });
    U.audio.shoot();
  }

  /* =========================================================
     ZİNCİR
     ========================================================= */
  function chainFrom(game, first, bounces, dmg, st, src, pow, bounceRange) {
    const hit = new Set([first.id]);
    let cur = first;
    for (let b = 0; b < bounces; b++) {
      const c = cur.group.position;
      const next = EV.Enemies.nearest(c.x, c.z, bounceRange, (e) => !e.ally && !e.peaceful && !hit.has(e.id));
      if (!next) break;
      hit.add(next.id);
      const from = c.clone(); from.y += cur.group.userData.height * 0.6;
      const to = next.group.position.clone(); to.y += next.group.userData.height * 0.6;
      EV.FX.beam(from, to, 0x9fe0ff);
      EV.Combat.hitEnemy(game, next, dmg, { source: src, st, pow, cls: 'shock' });
      cur = next;
    }
  }

  /** Zincir/işaret için ilk hedef: kilitli > nişandaki > nişan noktasına en yakın. */
  function pickTarget(game, opts, range) {
    const p = P(game).group.position;
    const ok = (e) => e && e.alive && !e.ally && !e.peaceful && e.group.position.distanceTo(p) <= range + e.radius;
    if (ok(opts.target)) return opts.target;
    if (opts.point) {
      const n = EV.Enemies.nearest(opts.point.x, opts.point.z, 7, (e) => !e.ally && !e.peaceful);
      if (ok(n)) return n;
    }
    return EV.Enemies.nearest(p.x, p.z, range * 0.6, (e) => !e.ally && !e.peaceful);
  }

  /* =========================================================
     ALANLAR (zone)
     ========================================================= */
  function spawnZone(game, z) {
    const zone = Object.assign({ tT: 0, t: z.dur, pull: 0, heal: 0, follow: false }, z);
    zone.mesh = EV.Decal.zoneMesh(z.x, z.z, z.r, z.color || 0x7fd9ff);
    zones.push(zone);
    return zone;
  }

  function updateZones(game, dt) {
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      z.t -= dt;
      z.tT += dt;
      z.mesh.pulse(0.2 + 0.12 * Math.sin(game.time * 6));
      if (z.pull > 0) {
        EV.Enemies.forEachNear(z.x, z.z, z.r + 3, (e) => {
          if (e.ally || e.peaceful) return;
          const dx = z.x - e.group.position.x, dz = z.z - e.group.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.6) return;
          const heavy = e.isAlpha || e.isApex || e.isMini ? 0.2 : 1;
          const s = Math.min(d, z.pull * heavy * dt);
          e.group.position.x += (dx / d) * s;
          e.group.position.z += (dz / d) * s;
        });
      }
      while (z.tT >= z.tick) {
        z.tT -= z.tick;
        let dealt = 0;
        EV.Enemies.forEachNear(z.x, z.z, z.r + 6, (e) => {
          if (e.ally || e.peaceful) return;
          if (EV.Creature.surfDist(e.group, z.x, z.z) <= z.r) {
            dealt += EV.Combat.hitEnemy(game, e, z.dmgAbs, {
              source: z.source === 'reaction' ? 'reaction' : z.source, st: z.st, pow: z.pow, noRage: true, cls: 'dot',
            });
          }
        });
        if (z.heal && dealt) game.healPlayer(dealt * z.heal);
      }
      if (z.t <= 0) {
        z.mesh.dispose();
        zones.splice(i, 1);
      }
    }
  }

  /* =========================================================
     YÖRÜNGELER ve TUZAKLAR
     ========================================================= */
  function updateOrbits(game, dt) {
    const p = P(game).group.position;
    for (let i = orbits.length - 1; i >= 0; i--) {
      const o = orbits[i];
      o.t -= dt;
      o.angle += o.speed * dt;
      o.hit.forEach((t, id) => { if (t > 0) o.hit.set(id, t - dt); });
      for (let k = 0; k < o.meshes.length; k++) {
        const a = o.angle + (k / o.meshes.length) * Math.PI * 2;
        const m = o.meshes[k];
        m.position.set(p.x + Math.sin(a) * o.r, p.y + P(game).group.userData.height * 0.5, p.z + Math.cos(a) * o.r);
        m.rotation.y += dt * 5;
        EV.Enemies.forEachNear(m.position.x, m.position.z, o.size + 6, (e) => {
          const hk = e.id * 16 + k;      // küre başına: kürenin sayısı artınca hasar da artsın
          if (e.ally || e.peaceful || (o.hit.get(hk) || 0) > 0) return;
          if (EV.Creature.surfDist(e.group, m.position.x, m.position.z) <= o.size) {
            o.hit.set(hk, o.hitCd);
            EV.Combat.hitEnemy(game, e, o.dmg, { source: o.src, st: o.st, pow: o.pow, knock: 5, from: p, noRage: true });
          }
        });
      }
      if (o.t <= 0) {
        o.meshes.forEach((m) => { scene.remove(m); m.material.dispose(); });
        orbits.splice(i, 1);
      }
    }
  }

  function updateTraps(game, dt) {
    for (let i = traps.length - 1; i >= 0; i--) {
      const t = traps[i];
      t.life -= dt;
      t.arm -= dt;
      t.mesh.rotation.y += dt * 2;
      let fire = false;              // süresi dolan tuzak patlamadan söner
      if (t.arm <= 0) {
        const n = EV.Enemies.nearest(t.x, t.z, t.r * 0.7 + 4, (e) => !e.ally && !e.peaceful &&
          EV.Creature.surfDist(e.group, t.x, t.z) <= t.r * 0.6);
        if (n) fire = true;
      }
      if (fire) {
        EV.Combat.hitArea(game, t.x, t.z, t.r, t.dmg, { source: t.src, st: t.st, pow: t.pow, knock: 6, from: t.mesh.position });
        EV.FX.ring(t.mesh.position, t.color, t.r, 0.35);
        EV.FX.burst(t.mesh.position, t.color, 10, 7);
      }
      if (fire || t.life <= 0) {
        scene.remove(t.mesh);
        t.mesh.material.dispose();
        traps.splice(i, 1);
      }
    }
  }

  /* =========================================================
     HAREKET: atılım / sıçrama / av (oyuncuyu yönetir)
     ========================================================= */
  function updateMotion(game, dt) {
    const pl = P(game);
    const pos = pl.group.position;

    if (pl.dash) {
      const d = pl.dash;
      const step = Math.min(d.left, d.speed * dt);
      pos.x += d.dir.x * step;
      pos.z += d.dir.z * step;
      d.left -= step;
      EV.World.resolveCollision(pos, pl.radius);
      if (d.dmg) {
        EV.Enemies.forEachNear(pos.x, pos.z, d.width + 6, (e) => {
          if (e.ally || e.peaceful || d.hitSet.has(e.id)) return;
          if (EV.Creature.surfDist(e.group, pos.x, pos.z) <= d.width) {
            d.hitSet.add(e.id);
            EV.Combat.hitEnemy(game, e, d.dmg, { source: d.src, st: d.st, pow: d.pow, forceCrit: d.crit, knock: 6, from: pos });
            if (d.chainOnHit) chainFrom(game, e, d.chainOnHit, d.dmg * 0.6, d.st, d.src, d.pow, 9);
          }
        });
      }
      if (d.left <= 0.01) pl.dash = null;
      return true;
    }

    if (pl.leap) {
      const L = pl.leap;
      L.t += dt;
      const k = U.clamp(L.t / L.dur, 0, 1);
      pos.x = U.lerp(L.fx, L.tx, k);
      pos.z = U.lerp(L.fz, L.tz, k);
      pl.leapY = Math.sin(k * Math.PI) * L.h;
      if (L.trail != null) {            // toprak altı ilerleyiş: yüzeyde toz izi
        L.fxT = (L.fxT || 0) - dt;
        if (L.fxT <= 0) {
          L.fxT = 0.05;
          EV.FX.burst(new THREE.Vector3(pos.x, EV.World.groundY(pos.x, pos.z) + 0.2, pos.z), L.trail, 2, 3);
        }
      }
      if (k >= 1) {
        pl.leap = null;
        pl.leapY = 0;
        EV.World.resolveCollision(pos, pl.radius);
        L.onLand();
      }
      return true;
    }

    if (pl.hunt) {
      const H = pl.hunt;
      H.t -= dt;
      if (H.t <= 0) {
        let e = null;
        while (H.i < H.targets.length && !e) {
          const c = H.targets[H.i++];
          if (c.alive) e = c;
        }
        if (!e) { pl.hunt = null; return false; }
        const ep = e.group.position;
        const from = pos.clone(); from.y += 1;
        const dir = new THREE.Vector3(ep.x - pos.x, 0, ep.z - pos.z).normalize();
        pos.x = ep.x - dir.x * (e.radius + 1);
        pos.z = ep.z - dir.z * (e.radius + 1);
        EV.World.resolveCollision(pos, pl.radius);
        pl.aimYaw = Math.atan2(dir.x, dir.z);
        pl.group.rotation.y = pl.aimYaw;
        EV.FX.beam(from, pos.clone().setY(pos.y + 1), 0xcfd8ff);
        EV.FX.slash(pos, pl.aimYaw, 3.5, 1.6, 0xcfd8ff);
        EV.Combat.hitEnemy(game, e, H.dmg, { source: H.src, st: H.st, pow: H.pow, forceCrit: true });
        H.t = 0.13;
      }
      return true;
    }
    return false;
  }

  /* =========================================================
     YENİ TÜRLER — ortak parçalar
     Geometriler paylaşılır; her nesne yalnızca kendi malzemesini atar.
     ========================================================= */
  const beams = [];
  const impacts = [];
  const totems = [];
  const waves = [];
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5); // +Z'ye uzanan birim tüp
  const rangGeo = new THREE.TorusGeometry(1, 0.28, 4, 12, Math.PI * 1.3).rotateX(Math.PI / 2);  // dönen hilal (simetrik değil: dönüşü görünür)
  const pillarGeo = new THREE.CylinderGeometry(0.2, 0.42, 1, 6).translate(0, 0.5, 0);
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const arcGeos = new Map();                                                     // yay açısı -> halka dilimi

  const hostile = (e) => !e.ally && !e.peaceful;
  const WHITE = new THREE.Color(0xffffff);
  let gameRef = null;          // clear() oyunu parametre almaz; ışının kendi yavaşlatmasını geri almak için

  function fxMat(color, opacity) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  }
  function drop(m) { if (m) { scene.remove(m); m.material.dispose(); } }

  /** Birim yarıçaplı, +Z'ye bakan yay dilimi (ölçekle büyür). Açıya göre önbellekli. */
  function arcGeo(a) {
    const k = Math.max(4, Math.round(a * 20));
    let g = arcGeos.get(k);
    if (!g) {
      const aa = k / 20;
      g = new THREE.RingGeometry(0.8, 1, Math.max(8, Math.round(aa * 8)), 1, -Math.PI / 2 - aa / 2, aa).rotateX(-Math.PI / 2);
      arcGeos.set(k, g);
    }
    return g;
  }

  function cross2(ax, az, bx, bz) { return ax * bz - az * bx; }
  /** İki doğru parçasının (XZ) kare uzaklığı. */
  function segSegDist2(ax, az, bx, bz, cx, cz, dx, dz) {
    const d1 = cross2(bx - ax, bz - az, cx - ax, cz - az), d2 = cross2(bx - ax, bz - az, dx - ax, dz - az);
    const d3 = cross2(dx - cx, dz - cz, ax - cx, az - cz), d4 = cross2(dx - cx, dz - cz, bx - cx, bz - cz);
    if ((d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0)) return 0;
    return Math.min(U.segDist2(ax, az, bx, bz, cx, cz), U.segDist2(ax, az, bx, bz, dx, dz),
      U.segDist2(cx, cz, dx, dz, ax, az), U.segDist2(cx, cz, dx, dz, bx, bz));
  }

  /* ---------------------------------------------------------
     IŞIN (beam): oyuncunun göğsünden nişana; nişanı her kare izler
     (dönüş hızı sınırlı: süpürür, ışınlanmaz). tick'te vurur.
     pierce: hattaki herkes · değilse ilk hedefte durur (ramp: aynı
     hedefte kaldıkça ısınır). Yankı ve otomatik atış (G) hedefi izler.
     --------------------------------------------------------- */
  const _bh = [];   // tarama sonucu: [düşman, uzaklık, düşman, uzaklık …]
  function beamScan(ox, oz, dx, dz, L, hw) {
    _bh.length = 0;
    EV.Enemies.forEachNear(ox + dx * L * 0.5, oz + dz * L * 0.5, L * 0.5 + hw, (e) => {
      if (!hostile(e)) return;
      const s = EV.Creature.capsule(e.group);
      const rr = hw + s.r;
      if (segSegDist2(ox, oz, ox + dx * L, oz + dz * L, s.ax, s.az, s.bx, s.bz) > rr * rr) return;
      const along = Math.min((s.ax - ox) * dx + (s.az - oz) * dz, (s.bx - ox) * dx + (s.bz - oz) * dz) - s.r;
      _bh.push(e, Math.max(0, along));
    });
    return _bh;
  }

  function castBeam(game, def, p, c) {
    const pl = P(game);
    const id = (c.echo ? 'echo:' : '') + def.id;
    for (let i = beams.length - 1; i >= 0; i--) if (beams[i].id === id) { endBeam(game, beams[i]); beams.splice(i, 1); }
    // yankı ve otomatik atış (G) hedefi izler; elle atılan ışın nişangahı izler (süpürülebilir)
    const fixed = c.echo || !!(pl.autoCast && c.target);
    const tg = c.echo ? pickTarget(game, c, p.range) : fixed ? c.target : null;
    const aim = tg ? tg.group.position : c.point;
    const dir = flatDir(game, aim);
    const dur = p.dur * (c.echo ? 0.6 : 1);
    const b = {
      id, t: dur, dur, tick: p.tick || 0.25, tT: (p.tick || 0.25) * 0.6, range: p.range || 16, hw: p.width * 0.5 * Math.sqrt(pl.stats.area),
      dmg: c.base * p.dmg, st: p.st, pow: c.pow, pierce: !!p.pierce, ramp: p.ramp || 0, critEvery: p.critEvery || 0,
      knock: p.knock || 0, turn: p.turn || 5, n: 0, focus: -1, focusN: 0, fxT: 0,
      src: c.src, echo: c.echo, fixed, target: tg, tx: aim.x, tz: aim.z, yaw: Math.atan2(dir.x, dir.z), color: c.color,
      outer: new THREE.Mesh(beamGeo, fxMat(c.color, 0)), core: new THREE.Mesh(beamGeo, fxMat(new THREE.Color(c.color).lerp(WHITE, 0.65).getHex(), 0)),
      tip: new THREE.Mesh(projGeo, fxMat(c.color, 0)), buffId: null,
    };
    scene.add(b.outer); scene.add(b.core); scene.add(b.tip);
    if (!c.echo) {
      pl.aimYaw = b.yaw;
      if (p.selfSlow) { b.buffId = 'beam:' + def.id; game.addBuff({ id: b.buffId, t: dur, mods: { speed: -p.selfSlow } }); }
    }
    beams.push(b);
    U.audio.blip(170, 0.3, 'sawtooth', 0.04, 340);
  }

  function endBeam(game, b) {
    drop(b.outer); drop(b.core); drop(b.tip);
    if (b.buffId && game) {
      const bf = P(game).buffs.find((x) => x.id === b.buffId);
      if (bf) bf.t = 0;
    }
  }

  const _o = new THREE.Vector3(), _e = new THREE.Vector3();
  function updateBeams(game, dt) {
    const pl = P(game);
    const pos = pl.group.position;
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.t -= dt;
      if (b.t <= 0 || !pl.alive || (!b.echo && EV.Status.stunned(pl))) { endBeam(game, b); beams.splice(i, 1); continue; }

      if (b.fixed && b.target && b.target.alive) { b.tx = b.target.group.position.x; b.tz = b.target.group.position.z; }
      const tx = b.fixed ? b.tx : pl.aimPoint.x, tz = b.fixed ? b.tz : pl.aimPoint.z;
      if ((tx - pos.x) * (tx - pos.x) + (tz - pos.z) * (tz - pos.z) > 0.25) {
        b.yaw = U.approachAngle(b.yaw, Math.atan2(tx - pos.x, tz - pos.z), b.turn * dt);
      }
      if (!b.echo) { pl.aimYaw = b.yaw; pl.faceT = Math.max(pl.faceT, 0.12); }

      const dx = Math.sin(b.yaw), dz = Math.cos(b.yaw);
      const ox = pos.x + dx * (pl.radius + 0.3), oz = pos.z + dz * (pl.radius + 0.3);
      const list = beamScan(ox, oz, dx, dz, b.range, b.hw);
      let len = b.range, first = null;
      if (!b.pierce) {
        for (let k = 0; k < list.length; k += 2) if (list[k + 1] < len) { len = list[k + 1]; first = list[k]; }
        len = Math.max(0.6, len + 0.3);
      }

      b.tT += dt;
      while (b.tT >= b.tick) {
        b.tT -= b.tick;
        b.n++;
        const crit = b.critEvery > 0 && b.n % b.critEvery === 0;
        const opt = { source: b.src, st: b.st, pow: b.pow, noRage: true, cls: 'dot', forceCrit: crit, knock: b.knock, from: { x: ox, z: oz } };
        if (b.pierce) {
          for (let k = 0; k < list.length; k += 2) EV.Combat.hitEnemy(game, list[k], b.dmg, opt);
        } else if (first) {
          if (b.focus === first.id) b.focusN++;
          else { b.focus = first.id; b.focusN = 0; }
          EV.Combat.hitEnemy(game, first, b.dmg * (1 + b.ramp * Math.min(b.focusN, 8)), opt);
        }
      }

      // görsel: dış parıltı + beyaz çekirdek + uçta dönen kıvılcım; araziyi izler
      const y0 = pos.y + pl.group.userData.height * 0.55;
      const ex = ox + dx * len, ez = oz + dz * len;
      const y1 = U.clamp(EV.World.groundY(ex, ez) + pl.group.userData.height * 0.55, y0 - 2.5, y0 + 2.5);
      _o.set(ox, y0, oz);
      _e.set(ex, y1, ez);
      const L3 = _o.distanceTo(_e);
      const fade = Math.min(1, (b.dur - b.t) / 0.12, b.t / 0.2);
      const pulse = 1 + 0.2 * Math.sin(game.time * 32 + i);
      b.outer.position.copy(_o); b.outer.lookAt(_e);
      b.outer.scale.set(b.hw * 0.75 * pulse, b.hw * 0.75 * pulse, L3);
      b.core.position.copy(_o); b.core.lookAt(_e);
      b.core.scale.set(b.hw * 0.3, b.hw * 0.3, L3);
      b.tip.position.copy(_e);
      b.tip.scale.setScalar(b.hw * 1.1 * pulse);
      b.tip.rotation.y += dt * 9;
      b.outer.material.opacity = 0.5 * fade;
      b.core.material.opacity = 0.9 * fade;
      b.tip.material.opacity = 0.9 * fade;
      b.fxT -= dt;
      if (b.fxT <= 0) { b.fxT = 0.09; EV.FX.burst(_e, b.color, 1, 3); }
    }
  }

  /* ---------------------------------------------------------
     YAĞMUR (barrage): nişan bölgesine sırayla düşen darbeler.
     Her darbenin yeri önce yerde işaretlenir (kaçılabilir).
     from 'sky': gökten düşer · 'self': senden fırlayıp kavis çizer
     seek: bölgedeki düşmanların üstüne sırayla düşer
     --------------------------------------------------------- */
  function castBarrage(game, def, p, c) {
    const pl = P(game), S = pl.stats;
    const ctr = clampPoint(game, c.point, p.castRange || 20);
    const area = p.r * S.area;
    const blast = p.blast * Math.sqrt(S.area);
    const n = c.echo ? Math.max(2, Math.ceil(p.count / 2)) : p.count;
    const prey = [];
    if (p.seek) {
      EV.Enemies.forEachNear(ctr.x, ctr.z, area, (e) => {
        if (hostile(e) && EV.Creature.surfDist(e.group, ctr.x, ctr.z) <= area) prey.push(e);
      });
      const d2 = (e) => (e.group.position.x - ctr.x) ** 2 + (e.group.position.z - ctr.z) ** 2;
      prey.sort((a, b) => d2(a) - d2(b));
    }
    const rot = Math.random() * Math.PI * 2;
    const wind = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const v = { x: ctr.x, z: ctr.z };
      if (prey.length) {
        const e = prey[i % prey.length];
        const j = i >= prey.length ? 0.9 : 0;           // aynı hedefe ikinci darbe biraz kayar
        v.x = e.group.position.x + U.rand(-j, j);
        v.z = e.group.position.z + U.rand(-j, j);
      } else if (i > 0) {                                // ilki merkeze, kalanlar ayçiçeği deseninde
        const rr = area * 0.92 * Math.sqrt(i / Math.max(1, n - 1));
        const a = rot + i * 2.39996;
        v.x += Math.sin(a) * rr;
        v.z += Math.cos(a) * rr;
      }
      EV.World.clampToPlay(v);
      const marker = EV.Decal.zoneMesh(v.x, v.z, blast, c.color);
      marker.pulse(0.14);
      impacts.push({
        x: v.x, z: v.z, r: blast, fireT: (p.delay || 0.6) + i * (p.gap || 0.1), flight: Math.min(p.delay || 0.6, 0.55), age: 0,
        dmg: c.base * p.dmg, st: p.st, pow: c.pow, knock: p.knock || 3, src: c.src, color: c.color,
        self: p.from === 'self', marker, mesh: null, sx: 0, sy: 0, sz: 0, fxT: 0,
        driftX: Math.sin(wind) * 5, driftZ: Math.cos(wind) * 5, size: p.size || 0.5,
      });
    }
    U.audio.shoot();
  }

  function dropImpact(m) {
    m.marker.dispose();
    drop(m.mesh);
  }

  function updateImpacts(game, dt) {
    for (let i = impacts.length - 1; i >= 0; i--) {
      const m = impacts[i];
      m.age += dt;
      m.marker.pulse(0.14 + 0.4 * U.clamp(m.age / m.fireT, 0, 1));
      const t0 = m.fireT - m.flight;
      if (!m.mesh && m.age >= t0) {
        m.mesh = new THREE.Mesh(projGeo, fxMat(m.color, 0.95));
        m.mesh.scale.set(m.size, m.size * 1.4, m.size);
        scene.add(m.mesh);
        const c = chest(game, 0.4);
        m.sx = c.x; m.sy = c.y; m.sz = c.z;
      }
      const gy = EV.World.groundY(m.x, m.z);
      if (m.mesh) {
        const f = U.clamp((m.age - t0) / m.flight, 0, 1);
        if (m.self) {
          m.mesh.position.set(U.lerp(m.sx, m.x, f), U.lerp(m.sy, gy, f) + Math.sin(f * Math.PI) * 4, U.lerp(m.sz, m.z, f));
        } else {
          m.mesh.position.set(m.x + (1 - f) * m.driftX, gy + (1 - f * f) * 16, m.z + (1 - f) * m.driftZ);
        }
        m.mesh.rotation.y += dt * 8;
        m.mesh.rotation.x += dt * 5;
        m.fxT -= dt;
        if (m.fxT <= 0) { m.fxT = 0.1; EV.FX.burst(m.mesh.position, m.color, 1, 1.2); }
      }
      if (m.age >= m.fireT) {
        const g = new THREE.Vector3(m.x, gy, m.z);
        EV.Combat.hitArea(game, m.x, m.z, m.r, m.dmg, { source: m.src, st: m.st, pow: m.pow, knock: m.knock, from: g });
        EV.FX.ring(g, m.color, m.r * 1.1, 0.35);
        EV.FX.burst(g.setY(gy + 0.4), m.color, 5, 7);
        dropImpact(m);
        impacts.splice(i, 1);
      }
    }
  }

  /* ---------------------------------------------------------
     BUMERANG: yavaşlayarak menzile gider, oyuncuya hızlanarak döner.
     Her yönde bir kez vurur. grow: her isabette büyür (en çok ×2);
     pullBack: dönüşte vurduklarını sana doğru çeker.
     --------------------------------------------------------- */
  function castBoomerang(game, def, p, c) {
    const pl = P(game);
    const o = chest(game, 0.9);
    const tg = c.target && c.target.alive && !c.target.ally ? c.target : null;
    const d0 = flatDir(game, tg ? tg.group.position : c.point);
    const flat = Math.atan2(d0.x, d0.z);
    const size = p.size * Math.sqrt(pl.stats.area);
    for (let i = 0; i < p.count; i++) {
      const a = p.radial ? flat + (i / p.count) * Math.PI * 2
        : flat + (p.count > 1 ? -(p.spread || 0.4) / 2 + ((p.spread || 0.4) * i) / (p.count - 1) : 0);
      const m = new THREE.Mesh(rangGeo, fxMat(c.color, 0.95));
      m.scale.setScalar(size);
      m.rotation.z = (i % 2 ? -1 : 1) * 0.35;           // hafif yatık: yerdeki halka gibi değil, uçan disk gibi
      m.position.copy(o);
      scene.add(m);
      projs.push({
        mesh: m, rang: true, dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), speed: p.speed, range: p.range,
        size, dmg: c.base * p.dmg, st: p.st, pow: c.pow, grow: p.grow || 0, mul: 1, pullBack: !!p.pullBack,
        knock: p.knock || 2, color: c.color, src: c.src, traveled: 0, back: false, backT: 0, age: 0,
        maxAge: (p.range / p.speed) * 3 + 2, hitSet: new Set(), tickMap: new Map(), dead: false, fxT: 0, fxGap: 0.08 * Math.max(1, p.count / 3),
      });
    }
    if (!c.echo) pl.aimYaw = flat;
    EV.Creature.attack(pl.group, 0.2);
    U.audio.shoot();
  }

  function updateRang(game, pr, dt) {
    const pl = P(game);
    const p = pr.mesh.position;
    pr.age += dt;
    if (pr.age > pr.maxAge || !pl.alive) { pr.dead = true; return; }
    if (!pr.back) {
      const k = pr.traveled / pr.range;
      const v = pr.speed * (1 - 0.6 * k * k);
      p.x += pr.dir.x * v * dt;
      p.z += pr.dir.z * v * dt;
      pr.traveled += v * dt;
      if (pr.traveled >= pr.range) { pr.back = true; pr.hitSet.clear(); }
    } else {
      pr.backT += dt;
      const c = pl.group.position;
      const dx = c.x - p.x, dz = c.z - p.z;
      const d = Math.hypot(dx, dz);
      const v = pr.speed * Math.min(1.4, 0.35 + pr.backT * 1.8);
      if (d <= Math.max(1.2, v * dt)) { pr.dead = true; return; }
      p.x += (dx / d) * v * dt;
      p.z += (dz / d) * v * dt;
    }
    p.y = EV.World.groundY(p.x, p.z) + Math.max(0.7, pl.group.userData.height * 0.5);
    pr.mesh.rotation.y += dt * 18;
    pr.fxT -= dt;
    if (pr.fxT <= 0) { pr.fxT = pr.fxGap; EV.FX.burst(p, pr.color, 1, 1); }

    const hitR = pr.mesh.scale.x * 1.15;
    EV.Enemies.forEachNear(p.x, p.z, hitR + 6, (e) => {
      if (pr.dead || !hostile(e) || pr.hitSet.has(e.id)) return;
      if (EV.Creature.surfDist(e.group, p.x, p.z) > hitR) return;
      pr.hitSet.add(e.id);
      const pull = pr.back && pr.pullBack;
      const from = pull ? pl.group.position : p;
      const knock = pull ? Math.min(24, e.group.position.distanceTo(from) * 2.2) : pr.knock;
      EV.Combat.hitEnemy(game, e, pr.dmg * pr.mul, { source: pr.src, st: pr.st, pow: pr.pow, from, knock, pull });
      if (pr.grow) {
        pr.mul = Math.min(2, pr.mul * (1 + pr.grow));
        pr.mesh.scale.setScalar(pr.size * (1 + (pr.mul - 1) * 0.6));
      }
    });
  }

  /* ---------------------------------------------------------
     TOTEM: nişan noktasına dikilir, ömrü boyunca her `rate` sn'de:
       shot  en yakın düşmana mermi   · zap  yıldırım (sekebilir)
       pulse çevresine nabız (alanı yerde görünür)
     Aynı yetenekten en fazla `max` totem; fazlası en eskisini söker.
     --------------------------------------------------------- */
  function castTotem(game, def, p, c) {
    const pl = P(game);
    const at = p.castRange ? clampPoint(game, c.point, p.castRange) : { x: pl.group.position.x, z: pl.group.position.z };
    const id = (c.echo ? 'echo:' : '') + def.id;
    const mine = totems.filter((t) => t.id === id);
    if (mine.length >= (p.max || 1)) {
      const old = mine[0];
      dropTotem(old);
      totems.splice(totems.indexOf(old), 1);
    }
    const y = EV.World.groundY(at.x, at.z);
    const h = p.height || 1.8;
    const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c.color).multiplyScalar(0.5) }));
    pillar.position.set(at.x, y, at.z);
    pillar.scale.set(1, 0.01, 1);
    const head = new THREE.Mesh(projGeo, fxMat(c.color, 0.95));
    head.scale.setScalar(0.42);
    head.position.set(at.x, y + 0.35, at.z);
    scene.add(pillar);
    scene.add(head);
    const pulse = p.mode === 'pulse';
    const r = p.r * (pulse ? pl.stats.area : 1);
    const t = {
      id, x: at.x, z: at.z, y, h, life: p.dur * (c.echo ? 0.6 : 1), age: 0, cdT: 0.3, rate: p.rate || 1, mode: p.mode || 'shot',
      r, dmg: c.base * p.dmg, st: p.st, pow: c.pow, bounces: p.bounces || 0, speed: p.speed || 26,
      explode: p.explode ? p.explode * pl.stats.area : 0, knock: p.knock || 0, src: c.src, color: c.color,
      pillar, head, flash: 0, aura: pulse ? EV.Decal.zoneMesh(at.x, at.z, r, c.color) : null,
    };
    if (t.aura) t.aura.pulse(0.08);
    totems.push(t);
    const g = new THREE.Vector3(at.x, y, at.z);
    EV.FX.ring(g, c.color, 2.5, 0.4);
    EV.FX.burst(g.setY(y + 0.5), c.color, 8, 5);
  }

  function dropTotem(t) {
    drop(t.pillar);
    drop(t.head);
    if (t.aura) t.aura.dispose();
  }

  function fireTotem(game, t) {
    const hp = t.head.position;
    if (t.mode === 'pulse') {
      EV.Combat.hitArea(game, t.x, t.z, t.r, t.dmg, { source: t.src, st: t.st, pow: t.pow, noRage: true, knock: t.knock, from: hp });
      EV.FX.ring(new THREE.Vector3(t.x, t.y, t.z), t.color, t.r, 0.45);
      t.flash = 0.3;
      return true;
    }
    const e = EV.Enemies.nearest(t.x, t.z, t.r, hostile);
    if (!e) return false;
    const to = e.group.position.clone();
    to.y += e.group.userData.height * 0.55;
    if (t.mode === 'zap') {
      EV.FX.beam(hp, to, t.color);
      EV.Combat.hitEnemy(game, e, t.dmg, { source: t.src, st: t.st, pow: t.pow, noRage: true, cls: 'shock' });
      if (t.bounces) chainFrom(game, e, t.bounces, t.dmg * 0.7, t.st, t.src, t.pow, 7);
    } else {
      const dir = new THREE.Vector3().subVectors(to, hp);
      const fl = Math.max(0.5, Math.hypot(dir.x, dir.z));
      dir.y = U.clamp(dir.y / fl, -0.5, 0.3) * fl;
      dir.normalize();
      spawnProj(game, {
        pos: hp.clone(), dir, speed: t.speed, range: t.r + 4, size: 0.34, dmg: t.dmg, st: t.st, pow: t.pow,
        pierce: 0, explode: t.explode, tick: 0, knock: 1.5, chainOnHit: 0, color: t.color, src: t.src, noRage: true,
      });
    }
    t.flash = 0.2;
    return true;
  }

  function updateTotems(game, dt) {
    for (let i = totems.length - 1; i >= 0; i--) {
      const t = totems[i];
      t.life -= dt;
      t.age += dt;
      t.cdT -= dt;
      t.flash = Math.max(0, t.flash - dt);
      const rise = Math.min(1, t.age / 0.25);
      t.pillar.scale.y = t.h * rise;
      t.head.position.y = t.y + t.h * rise + 0.35 + Math.sin(t.age * 3) * 0.12;
      t.head.rotation.y += dt * 3;
      t.head.scale.setScalar(0.42 * (1 + t.flash * 1.5));
      if (t.aura) t.aura.pulse(0.07 + t.flash * 0.9);
      if (t.cdT <= 0 && rise >= 1) t.cdT = fireTotem(game, t) ? Math.max(t.cdT + t.rate, t.rate * 0.5) : 0.2;
      if (t.life <= 0) {
        EV.FX.burst(t.head.position, t.color, 8, 5);
        dropTotem(t);
        totems.splice(i, 1);
      }
    }
  }

  /* ---------------------------------------------------------
     IŞINLANMA (blink): nişana anında geçer; çıkışta ve varışta patlar.
     behind: hedefin ARKASINA geçip ona vurur (crit: hep kritik)
     burrow: toprağın altından gider (sıçrama hareketi, eksi yükseklik)
     zone:   çıkış noktasında bir alan bırakır
     Yankı oyuncuyu taşımaz: hedefte hayali bir patlama yapar.
     --------------------------------------------------------- */
  function castBlink(game, def, p, c) {
    const pl = P(game), S = pl.stats;
    const r = p.r * S.area;
    const dmg = c.base * p.dmg;
    const opt = { source: c.src, st: p.st, pow: c.pow, knock: p.knock || 6 };
    if (c.echo) {
      const g = new THREE.Vector3(c.point.x, EV.World.groundY(c.point.x, c.point.z), c.point.z);
      EV.Combat.hitArea(game, g.x, g.z, r, dmg, Object.assign({ from: g }, opt));
      EV.FX.ring(g, c.color, r, 0.4);
      EV.FX.burst(g.setY(g.y + 0.6), c.color, 8, 6);
      return;
    }
    const pos = pl.group.position;
    const from = pos.clone();
    let prey = null, tx = null, tz = null;
    if (p.behind) {
      prey = pickTarget(game, c, p.dist);
      if (prey) {
        const ep = prey.group.position;
        const l = Math.max(0.01, Math.hypot(ep.x - pos.x, ep.z - pos.z));
        const off = prey.radius + prey.group.userData.cap.hl + pl.radius + 0.6;
        tx = ep.x + ((ep.x - pos.x) / l) * off;
        tz = ep.z + ((ep.z - pos.z) / l) * off;
      }
    }
    if (tx == null) {
      const dir = flatDir(game, c.point);
      const d = U.clamp(Math.hypot(c.point.x - pos.x, c.point.z - pos.z), p.minDist || 3, p.castRange || p.dist);
      tx = pos.x + dir.x * d;
      tz = pos.z + dir.z * d;
    }
    const dest = { x: tx, z: tz };
    EV.World.clampToPlay(dest);
    tx = dest.x;
    tz = dest.z;

    if (p.dmgStart) EV.Combat.hitArea(game, from.x, from.z, r, c.base * p.dmgStart, Object.assign({ from }, opt));
    if (p.zone) {
      spawnZone(game, { x: from.x, z: from.z, r: p.zone.r * S.area, dur: p.zone.dur, tick: p.zone.tick || 0.5,
        dmgAbs: c.base * p.zone.dmg, st: p.zone.st, pow: c.pow, color: c.color, source: c.src });
    }
    EV.FX.ring(from, c.color, r * 0.8, 0.35);
    EV.FX.burst(from.clone().setY(from.y + 0.8), c.color, 10, 6);

    const arrive = () => {
      const l = pl.group.position;
      if (prey && prey.alive) {
        const ep = prey.group.position;
        pl.aimYaw = Math.atan2(ep.x - l.x, ep.z - l.z);
        pl.group.rotation.y = pl.aimYaw;
        EV.FX.slash(l, pl.aimYaw, 3.5, 1.8, c.color);
        EV.Creature.attack(pl.group, 0.22);
        EV.Combat.hitEnemy(game, prey, dmg, Object.assign({ forceCrit: !!p.crit, from: l }, opt));
      }
      const splash = prey ? dmg * (p.splash || 0.5) : dmg;
      EV.Enemies.forEachNear(l.x, l.z, r + 6, (e) => {
        if (e === prey || !hostile(e)) return;
        if (EV.Creature.surfDist(e.group, l.x, l.z) <= r) EV.Combat.hitEnemy(game, e, splash, Object.assign({ from: l }, opt));
      });
      EV.FX.ring(l, c.color, r, 0.45);
      EV.FX.burst(l.clone().setY(l.y + 0.6), c.color, 12, 8);
    };

    pl.aimYaw = Math.atan2(tx - pos.x, tz - pos.z);
    pl.group.rotation.y = pl.aimYaw;
    if (p.burrow) {
      const dur = 0.3 + Math.hypot(tx - pos.x, tz - pos.z) * 0.018;
      pl.leap = { fx: pos.x, fz: pos.z, tx, tz, t: 0, dur, h: -2.4, trail: c.color, onLand: arrive };
      pl.iframe = Math.max(pl.iframe, dur + 0.25);
    } else {
      pos.x = tx;
      pos.z = tz;
      EV.World.resolveCollision(pos, pl.radius);
      pos.y = EV.World.groundY(pos.x, pos.z);
      pl.vel.set(0, 0, 0);
      pl.impulse.set(0, 0, 0);
      pl.iframe = Math.max(pl.iframe, p.iframe || 0.3);
      EV.FX.beam(from.clone().setY(from.y + 1), pos.clone().setY(pos.y + 1), c.color);
      arrive();
    }
    EV.Build.onDash(game);
    U.audio.blip(900, 0.12, 'sine', 0.04, 300);
  }

  /* ---------------------------------------------------------
     DALGA (wave): oyuncudan nişana doğru ilerleyen cephe.
     shape 'arc': genişleyen yay (arc radyan) · 'line': düz duvar (width)
     Her düşmana bir kez vurur. carry: cephe düşmanı önüne katıp
     sürükler (ağır olanlar hariç). count+spread: yelpaze; waves: art arda.
     --------------------------------------------------------- */
  function castWave(game, def, p, c) {
    const pl = P(game);
    const tg = c.target && c.target.alive && !c.target.ally ? c.target : null;
    const d0 = flatDir(game, tg ? tg.group.position : c.point);
    const yaw0 = Math.atan2(d0.x, d0.z);
    if (!c.echo) pl.aimYaw = yaw0;
    const count = p.count || 1;
    for (let w = 0; w < (p.waves || 1); w++) {
      later(w * (p.gap || 0.4), () => {
        const volley = new Set();          // yelpazedeki dalgalar tek saldırı: hedef başına bir vuruş
        for (let i = 0; i < count; i++) {
          spawnWave(game, p, c, yaw0 + (count > 1 ? -(p.spread || 0.6) / 2 + ((p.spread || 0.6) * i) / (count - 1) : 0), volley);
        }
        U.audio.roar();
      });
    }
    EV.Creature.attack(pl.group, 0.25);
  }

  function spawnWave(game, p, c, yaw, hit) {
    const pl = P(game), S = pl.stats;
    const pos = pl.group.position;
    const line = p.shape === 'line';
    const mesh = new THREE.Mesh(line ? wallGeo : arcGeo(p.arc || 1.5), fxMat(c.color, 0));
    scene.add(mesh);
    waves.push({
      ox: pos.x, oz: pos.z, oy: pos.y, dx: Math.sin(yaw), dz: Math.cos(yaw), yaw, R: 0.5,
      range: (p.range || 12) * (1 + (S.area - 1) * 0.5), speed: p.speed || 18, line, arc: p.arc || 1.5,
      hw: line ? p.width * 0.5 * (1 + (S.area - 1) * 0.5) : 0, hgt: p.height || 1.2,
      dmg: c.base * p.dmg, st: p.st, pow: c.pow, knock: p.knock || 3, carry: !!p.carry,
      hit, mesh, color: c.color, src: c.src, fxT: 0,
    });
  }

  function waveTouch(game, w, e) {
    if (!hostile(e)) return;
    const ep = e.group.position;
    const rx = ep.x - w.ox, rz = ep.z - w.oz;
    const er = e.radius;
    const heavy = e.isAlpha || e.isApex || e.isMini;
    let push = 0, px = 0, pz = 0;
    if (w.line) {
      const fwd = rx * w.dx + rz * w.dz;
      const lat = rx * w.dz - rz * w.dx;
      if (Math.abs(lat) > w.hw + er || fwd < -er - 0.5 || fwd - er > w.R) return;
      if (fwd > w.R - 3) { push = w.R + er * 0.6 - fwd; px = w.dx; pz = w.dz; }
    } else {
      if (EV.Creature.surfDist(e.group, w.ox, w.oz) > w.R) return;
      const d = Math.hypot(rx, rz);
      if (d > 1.2 && Math.abs(U.wrapAngle(Math.atan2(rx, rz) - w.yaw)) > w.arc / 2 + Math.atan2(er, d)) return;
      if (d > 0.01 && d > w.R - 3) { push = w.R + er * 0.6 - d; px = rx / d; pz = rz / d; }
    }
    if (w.carry && !heavy && push > 0) {
      ep.x += px * push;
      ep.z += pz * push;
      EV.World.resolveCollision(ep, er);
    }
    if (!w.hit.has(e.id)) {
      w.hit.add(e.id);
      EV.Combat.hitEnemy(game, e, w.dmg, { source: w.src, st: w.st, pow: w.pow, knock: w.knock, from: { x: w.ox, z: w.oz } });
    }
  }

  function updateWaves(game, dt) {
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.R = Math.min(w.range, w.R + w.speed * dt);
      const fx = w.ox + w.dx * w.R, fz = w.oz + w.dz * w.R;
      if (w.line) EV.Enemies.forEachNear(w.ox + w.dx * w.R * 0.5, w.oz + w.dz * w.R * 0.5, Math.hypot(w.R * 0.5, w.hw) + 1, (e) => waveTouch(game, w, e));
      else EV.Enemies.forEachNear(w.ox, w.oz, w.R + 1, (e) => waveTouch(game, w, e));

      const k = w.R / w.range;
      w.mesh.material.opacity = 0.7 * Math.min(1, (1 - k * k * k) * 1.4);
      w.mesh.rotation.y = w.yaw;
      if (w.line) {
        w.mesh.position.set(fx, EV.World.groundY(fx, fz) + w.hgt * 0.5, fz);
        w.mesh.scale.set(w.hw * 2, w.hgt, 0.7);
      } else {
        w.mesh.position.set(w.ox, Math.max(w.oy, EV.World.groundY(fx, fz)) + 0.45, w.oz);
        w.mesh.scale.set(w.R, 1, w.R);
      }
      w.fxT -= dt;
      if (w.fxT <= 0) {                     // cephe boyunca toz / kıvılcım
        w.fxT = 0.06;
        const s = U.rand(-1, 1);
        let x, z;
        if (w.line) { x = fx + w.dz * s * w.hw; z = fz - w.dx * s * w.hw; }
        else { const a = w.yaw + s * w.arc * 0.5; x = w.ox + Math.sin(a) * w.R; z = w.oz + Math.cos(a) * w.R; }
        EV.FX.burst(new THREE.Vector3(x, EV.World.groundY(x, z) + 0.3, z), w.color, 2, 4);
      }
      if (w.R >= w.range) { drop(w.mesh); waves.splice(i, 1); }
    }
  }

  /* =========================================================
     CAST
     ========================================================= */
  function cast(game, def, rank, opts) {
    const pl = P(game);
    const S = pl.stats;
    const p = DATA.params(def, rank);
    const src = opts.source || 'player';
    const echo = src === 'echo';
    const base = S.dmg * (opts.dmgMul || 1);
    const pow = S.dmg * S.statusPower;
    const color = tagColor(def);
    const point = opts.point || chest(game, 10);
    const pos = pl.group.position;

    // yankı hareket yeteneklerini oyuncuyu taşımadan, hedefte hayali darbe olarak yapar
    if (echo && (def.kind === 'dash' || def.kind === 'leap' || def.kind === 'hunt')) {
      EV.Combat.hitArea(game, point.x, point.z, 3, base * (p.dmg || 1), { source: src, st: p.st, pow });
      EV.FX.ring(new THREE.Vector3(point.x, EV.World.groundY(point.x, point.z), point.z), color, 3, 0.35);
      return true;
    }

    switch (def.kind) {
      case 'bolt': {
        const o = chest(game, 1.2);
        const tg = opts.target && opts.target.alive && !opts.target.ally ? opts.target : null;
        const aimAt = tg ? tg.group.position.clone().setY(tg.group.position.y + tg.group.userData.hipY) : point;
        const dir = new THREE.Vector3().subVectors(aimAt, o);
        dir.y = U.clamp(dir.y / Math.max(1, Math.hypot(dir.x, dir.z)), -0.35, 0.25);
        const flat = Math.hypot(dir.x, dir.z) > 0.01 ? Math.atan2(dir.x, dir.z) : pl.aimYaw;
        const n = p.count;
        for (let i = 0; i < n; i++) {
          let a;
          if (p.radial) a = flat + (i / n) * Math.PI * 2;
          else a = flat + (n > 1 ? -p.spread / 2 + (p.spread * i) / (n - 1) : 0);
          const d = new THREE.Vector3(Math.sin(a), p.radial ? 0 : dir.y, Math.cos(a)).normalize();
          spawnProj(game, {
            pos: o.clone(), dir: d, speed: p.speed, range: p.range, size: p.size * (p.tick ? Math.sqrt(S.area) : 1),
            dmg: base * p.dmg, st: p.st, pow, pierce: p.pierce || 0, explode: p.explode ? p.explode * S.area : 0,
            pull: p.pull, tick: p.tick || 0, knock: p.knock || 0, chainOnHit: p.chainOnHit || 0, color, src,
          });
        }
        U.audio.shoot();
        break;
      }

      case 'cone': {
        const dir = flatDir(game, point);
        const yaw = Math.atan2(dir.x, dir.z);
        pl.aimYaw = yaw;
        if (p.lunge && !echo) pl.impulse.addScaledVector(dir, p.lunge * 4.5);
        const hits = p.hits || 1;
        const range = p.range * (1 + (S.area - 1) * 0.5);
        for (let h = 0; h < hits; h++) {
          later(h * 0.16 + (p.lunge ? 0.08 : 0), () => {
            const c = pl.group.position;
            EV.FX.slash(c, yaw + (h % 2 ? 0.25 : -0.25), range, p.angle, color);
            EV.Creature.attack(pl.group, 0.22);
            EV.Enemies.forEachNear(c.x, c.z, range + 6, (e) => {
              if (e.ally || e.peaceful) return;
              if (EV.Creature.surfDist(e.group, c.x, c.z) > range) return;
              EV.Creature.closestPoint(e.group, c.x, c.z, _c);
              const dx = _c.x - c.x, dz = _c.z - c.z;
              const d = Math.hypot(dx, dz);
              if (d > 1.2 && Math.abs(U.wrapAngle(Math.atan2(dx, dz) - yaw)) > p.angle / 2 + Math.atan2(e.radius, d)) return;
              EV.Combat.hitEnemy(game, e, base * p.dmg, { source: src, st: p.st, pow, knock: p.knock, from: c });
            });
          });
        }
        break;
      }

      case 'nova': {
        const r = p.r * S.area;
        const pulses = p.pulses || 1;
        for (let k = 0; k < pulses; k++) {
          later(k * (p.pulseGap || 0.4), () => {
            const c = pl.group.position.clone();
            EV.Combat.hitArea(game, c.x, c.z, r, base * p.dmg, { source: src, st: p.st, pow, knock: p.knock, from: c });
            EV.FX.ring(c, color, r, 0.45);
            EV.FX.burst(c.clone().setY(c.y + 1), color, 10, 9);
          });
        }
        if (p.shards) {
          const o = chest(game, 0.5);
          for (let i = 0; i < p.shards.count; i++) {
            const a = (i / p.shards.count) * Math.PI * 2;
            spawnProj(game, { pos: o.clone(), dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), speed: 30, range: 16,
              size: 0.3, dmg: base * p.shards.dmg, st: p.st, pow, pierce: 1, color, src });
          }
        }
        if (p.summon) spawnSummons(game, p.summon, echo);
        U.audio.roar();
        break;
      }

      case 'zone': {
        const c = p.castRange ? clampPoint(game, point, p.castRange) : { x: pos.x, z: pos.z };
        spawnZone(game, { x: c.x, z: c.z, r: p.r * S.area, dur: p.dur * (echo ? 0.6 : 1), tick: p.tick,
          dmgAbs: base * p.dmg, st: p.st, pow, pull: p.pull || 0, heal: p.heal || 0, color, source: src });
        break;
      }

      case 'dash': {
        const dir = flatDir(game, point);
        pl.aimYaw = Math.atan2(dir.x, dir.z);
        pl.dash = { dir, speed: p.speed, left: p.dist, dmg: base * p.dmg, width: p.width, st: p.st, pow,
          crit: !!p.crit, chainOnHit: p.chainOnHit || 0, hitSet: new Set(), src };
        pl.iframe = Math.max(pl.iframe, p.iframe + p.dist / p.speed);
        EV.FX.burst(pos.clone().setY(pos.y + 1), color, 8, 5);
        EV.Build.onDash(game);
        break;
      }

      case 'leap': {
        const c = clampPoint(game, point, p.castRange);
        const dist = Math.hypot(c.x - pos.x, c.z - pos.z);
        pl.aimYaw = Math.atan2(c.x - pos.x, c.z - pos.z);
        pl.leap = {
          fx: pos.x, fz: pos.z, tx: c.x, tz: c.z, t: 0, dur: 0.38 + dist * 0.012, h: 3 + dist * 0.18,
          onLand: () => {
            const l = pl.group.position.clone();
            const r = p.r * S.area;
            EV.Combat.hitArea(game, l.x, l.z, r, base * p.dmg, { source: src, st: p.st, pow, knock: p.knock, from: l });
            EV.FX.ring(l, color, r, 0.5);
            EV.FX.burst(l.clone().setY(l.y + 0.5), color, 16, 10);
            if (p.summon) spawnSummons(game, p.summon, false);
            U.audio.roar();
          },
        };
        pl.iframe = Math.max(pl.iframe, pl.leap.dur + 0.1);
        break;
      }

      case 'chain': {
        const first = pickTarget(game, opts, p.range);
        if (!first) return false;
        const from = chest(game, 0.6);
        const to = first.group.position.clone(); to.y += first.group.userData.height * 0.6;
        EV.FX.beam(from, to, color);
        EV.Combat.hitEnemy(game, first, base * p.dmg, { source: src, st: p.st, pow, cls: 'shock' });
        if (p.bounces) chainFrom(game, first, p.bounces, base * p.dmg * p.falloff, p.st, src, pow, p.bounceRange);
        U.audio.shoot();
        break;
      }

      case 'buff': {
        const mods = Object.assign({}, p.mods);
        const shield = mods.shield || 0;
        delete mods.shield;
        game.addBuff({ id: (echo ? 'echo:' : '') + def.id, t: p.dur * (echo ? 0.5 : 1), mods, onHitSt: p.onHitSt || null });
        if (shield) {
          pl.shield = Math.max(pl.shield, S.maxHp * shield * (echo ? 0.5 : 1));
          pl.shieldT = p.dur;
        }
        EV.FX.ring(pos, color, 4, 0.5);
        break;
      }

      case 'summon': {
        spawnSummons(game, p, echo);
        if (p.healFrac && !echo) game.healPlayer(S.maxHp * p.healFrac);
        break;
      }

      case 'orbit': {
        const oid = (echo ? 'echo:' : '') + def.id;
        for (let i = orbits.length - 1; i >= 0; i--) {
          if (orbits[i].id === oid) {
            orbits[i].meshes.forEach((m) => { scene.remove(m); m.material.dispose(); });
            orbits.splice(i, 1);
          }
        }
        const meshes = [];
        const count = echo ? Math.max(1, Math.floor(p.count / 2)) : p.count;
        for (let i = 0; i < count; i++) {
          const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color }));
          m.scale.setScalar(p.size);
          scene.add(m);
          meshes.push(m);
        }
        orbits.push({ id: oid, t: p.dur, r: p.r * Math.sqrt(S.area), dmg: base * p.dmg, st: p.st, pow,
          speed: p.speed, size: p.size + 0.35, hitCd: p.hitCd, meshes, angle: 0, hit: new Map(), src });
        break;
      }

      case 'trap': {
        const tid = (echo ? 'echo:' : '') + def.id;
        const mine = traps.filter((t) => t.id === tid);
        if (mine.length >= p.max) {
          const old = mine[0];
          scene.remove(old.mesh); old.mesh.material.dispose();
          traps.splice(traps.indexOf(old), 1);
        }
        const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color }));
        m.scale.set(0.45, 0.25, 0.45);
        m.position.set(pos.x, EV.World.groundY(pos.x, pos.z) + 0.3, pos.z);
        scene.add(m);
        traps.push({ id: tid, x: pos.x, z: pos.z, r: p.r * S.area, dmg: base * p.dmg, st: p.st, pow,
          arm: p.arm, life: p.life, mesh: m, color, src });
        break;
      }

      case 'hunt': {
        const list = [];
        EV.Enemies.forEachNear(pos.x, pos.z, p.range, (e) => { if (!e.ally && !e.peaceful) list.push(e); });
        if (!list.length) return false;
        list.sort((a, b) => a.group.position.distanceToSquared(pos) - b.group.position.distanceToSquared(pos));
        pl.hunt = { targets: list.slice(0, p.count), i: 0, t: 0, dmg: base * p.dmg, st: p.st, pow, src };
        pl.iframe = Math.max(pl.iframe, p.count * 0.14 + 0.3);
        break;
      }

      case 'beam':      castBeam(game, def, p, ctx(opts, src, echo, base, pow, color, point)); break;
      case 'barrage':   castBarrage(game, def, p, ctx(opts, src, echo, base, pow, color, point)); break;
      case 'boomerang': castBoomerang(game, def, p, ctx(opts, src, echo, base, pow, color, point)); break;
      case 'totem':     castTotem(game, def, p, ctx(opts, src, echo, base, pow, color, point)); break;
      case 'blink':     castBlink(game, def, p, ctx(opts, src, echo, base, pow, color, point)); break;
      case 'wave':      castWave(game, def, p, ctx(opts, src, echo, base, pow, color, point)); break;

      default: return false;
    }
    return true;
  }

  /** Yeni türlerin ortak atış bağlamı. */
  function ctx(opts, src, echo, base, pow, color, point) {
    const t = opts.target;
    return { src, echo, base, pow, color, point, target: t && t.alive && !t.ally && !t.peaceful ? t : null };
  }

  function spawnSummons(game, p, echo) {
    const S = P(game).stats;
    const count = echo ? 1 : p.count + (S.summonCount || 0);
    for (let i = 0; i < count; i++) {
      EV.Enemies.spawnSummon(game, {
        dur: p.dur * (echo ? 0.6 : 1),
        hp: S.maxHp * p.hpFrac * S.summonPower,
        dmg: S.dmg * p.dmgFrac * S.summonPower,
      });
    }
  }

  /* =========================================================
     güncelle / temizle
     ========================================================= */
  function update(game, dt) {
    gameRef = game;
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i].t -= dt;
      if (timers[i].t <= 0) {
        const fn = timers[i].fn;
        timers.splice(i, 1);
        fn();
      }
    }
    updateProjs(game, dt);
    updateZones(game, dt);
    updateOrbits(game, dt);
    updateTraps(game, dt);
    updateBeams(game, dt);
    updateImpacts(game, dt);
    updateTotems(game, dt);
    updateWaves(game, dt);
  }

  function clear() {
    projs.forEach((p) => { scene.remove(p.mesh); p.mesh.material.dispose(); });
    zones.forEach((z) => z.mesh.dispose());
    orbits.forEach((o) => o.meshes.forEach((m) => { scene.remove(m); m.material.dispose(); }));
    traps.forEach((t) => { scene.remove(t.mesh); t.mesh.material.dispose(); });
    beams.forEach((b) => endBeam(gameRef, b));
    impacts.forEach(dropImpact);
    totems.forEach(dropTotem);
    waves.forEach((w) => drop(w.mesh));
    projs.length = zones.length = orbits.length = traps.length = timers.length = 0;
    beams.length = impacts.length = totems.length = waves.length = 0;
  }

  return {
    init, cast, update, updateMotion, clear, spawnZone, tagColor, basicShot,
    get counts() {
      return { projs: projs.length, zones: zones.length, orbits: orbits.length, traps: traps.length,
        beams: beams.length, impacts: impacts.length, totems: totems.length, waves: waves.length };
    },
  };
})();
