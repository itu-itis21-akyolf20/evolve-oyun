/* ============================================================
   skills.js — yetenek motoru

   Veriyi (data/*.js) okur, türüne göre çalıştırır:
     bolt  cone  nova  zone  dash  leap  chain  buff  summon  orbit  trap  hunt
   Ayrıca kalıcı nesneleri yönetir: mermiler, alanlar, yörüngeler,
   tuzaklar, zamanlanmış darbeler ve oyuncunun atılım/sıçrama hareketi.

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
    EV.Combat.hitEnemy(game, e, pr.dmg, { source: pr.src, st: pr.st, pow: pr.pow, knock, from, pull: !!pr.pull });
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

      default: return false;
    }
    return true;
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
  }

  function clear() {
    projs.forEach((p) => { scene.remove(p.mesh); p.mesh.material.dispose(); });
    zones.forEach((z) => z.mesh.dispose());
    orbits.forEach((o) => o.meshes.forEach((m) => { scene.remove(m); m.material.dispose(); }));
    traps.forEach((t) => { scene.remove(t.mesh); t.mesh.material.dispose(); });
    projs.length = zones.length = orbits.length = traps.length = timers.length = 0;
  }

  return {
    init, cast, update, updateMotion, clear, spawnZone, tagColor,
    get counts() { return { projs: projs.length, zones: zones.length, orbits: orbits.length, traps: traps.length }; },
  };
})();
