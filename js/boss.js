/* ============================================================
   boss.js — Alfa ve Apex yetenek kitleri, türe özgü saldırılar,
   düşman mermileri

   KURAL: bossların HER saldırısı (temel vuruş dahil) önce yere
   kırmızı uyarı çizer; dolgu dolduğu an vuruş gerçekleşir. Oyuncu
   alanın dışındaysa, havadaysa (sıçrama) ya da atılımın
   dokunulmazlığındaysa hasar almaz. Öngörülebilir, öğrenilebilir.

   Faz: can %50 ve %25'in altına inince hızlanır, yeni yetenek açılır.
   Dehşet'te uyarılar kısalır, fazlar erken gelir.
   ============================================================ */
window.EV = window.EV || {};

EV.Boss = (function () {
  'use strict';

  const U = EV.U;
  let scene = null;
  const shots = [];
  const shotGeo = new THREE.IcosahedronGeometry(1, 0);

  function setup(sc) { scene = sc; }

  /* =========================================================
     Yardımcılar
     ========================================================= */
  const Wm = (game, e) => game.diff.windup * (e.boss && e.boss.phase >= 2 ? 0.88 : 1);
  const front = (e) => { const c = e.group.userData.cap; return c.cz + c.hl + c.r; };
  const yawTo = (e, x, z) => Math.atan2(x - e.group.position.x, z - e.group.position.z);

  function playerIn(game, t) {
    const P = game.player;
    if (!P.alive || P.leapY > 1.2) return false;
    return EV.Decal.contains(t, P.group.position.x, P.group.position.z, P.radius * 0.8);
  }

  function hurt(game, e, mult, st, knock, from) {
    const P = game.player;
    const done = EV.Combat.hitPlayer(game, e.dmg * mult, { st, attacker: e, melee: false });
    if (done && knock) {
      const f = from || e.group.position;
      const dx = P.group.position.x - f.x, dz = P.group.position.z - f.z, l = Math.hypot(dx, dz) || 1;
      P.impulse.x += (dx / l) * knock;
      P.impulse.z += (dz / l) * knock;
    }
  }

  function circle(game, e, x, z, r, windup, mult, st, delay, knock) {
    return EV.Decal.tele({
      shape: 'circle', x, z, r, windup, delay, owner: e,
      onFire: (t) => {
        if (!e.alive) return;
        EV.FX.ring(new THREE.Vector3(x, EV.World.groundY(x, z), z), 0xff5a3d, r, 0.3);
        if (playerIn(game, t)) hurt(game, e, mult, st, knock, { x, z });
      },
    });
  }

  function cone(game, e, yaw, r, angle, windup, mult, st, knock) {
    const p = e.group.position;
    return EV.Decal.tele({
      shape: 'cone', x: p.x, z: p.z, yaw, r, angle, windup, owner: e,
      onFire: (t) => {
        if (!e.alive) return;
        EV.Creature.attack(e.group, 0.3);
        EV.FX.slash(p, yaw, r, angle, 0xff6b4d);
        if (playerIn(game, t)) hurt(game, e, mult, st, knock);
      },
    });
  }

  function ring(game, e, r2, r, windup, mult, st) {
    const p = e.group.position;
    return EV.Decal.tele({
      shape: 'ring', x: p.x, z: p.z, r, r2, windup, owner: e,
      onFire: (t) => {
        if (!e.alive) return;
        EV.FX.ring(p, 0xff5a3d, r, 0.35);
        if (playerIn(game, t)) hurt(game, e, mult, st, 6);
      },
    });
  }

  /** Çizgi uyarısı + bitince boss o çizgi boyunca atılır. */
  function charge(game, e, len, w, windup, mult, st, dur) {
    const p = e.group.position;
    const yaw = yawTo(e, game.player.group.position.x, game.player.group.position.z);
    e.group.rotation.y = yaw;
    return EV.Decal.tele({
      shape: 'rect', x: p.x, z: p.z, yaw, len, w, windup, owner: e,
      onFire: (t) => {
        if (!e.alive) return;
        const d = dur || 0.35;
        const dist = Math.max(1, len - front(e) * 0.5);   // kısa çizgide geri geri gitmesin
        e.lunge = { vx: Math.sin(yaw) * dist / d, vz: Math.cos(yaw) * dist / d, t: d };
        EV.Creature.attack(e.group, d);
        if (playerIn(game, t)) hurt(game, e, mult, st, 12);
      },
    });
  }

  /* ---------------- düşman mermileri ---------------- */
  function shoot(game, e, from, dir, speed, dmg, st, size, color, range) {
    const m = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ color: color || 0xff5a3d }));
    m.scale.setScalar(size || 0.45);
    m.position.copy(from);
    scene.add(m);
    shots.push({ mesh: m, dir: dir.clone().normalize(), speed, dmg, st, size: size || 0.45, left: range || 30, attacker: e });
  }

  function updateShots(game, dt) {
    const P = game.player;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const step = s.speed * dt;
      s.mesh.position.addScaledVector(s.dir, step);
      s.left -= step;
      const p = s.mesh.position;
      let dead = s.left <= 0 || p.y < EV.World.height(p.x, p.z);
      if (!dead && P.alive && P.leapY < 1.2) {
        const pp = P.group.position;
        const dx = p.x - pp.x, dz = p.z - pp.z;
        const dy = p.y - pp.y;
        if (dx * dx + dz * dz < (P.radius + s.size) * (P.radius + s.size) && dy > -1 && dy < P.group.userData.height + 1) {
          EV.Combat.hitPlayer(game, s.dmg, { st: s.st, attacker: s.attacker && s.attacker.alive ? s.attacker : null });
          EV.FX.burst(p, 0xff5a3d, 6, 4);
          dead = true;
        }
      }
      if (dead) {
        scene.remove(s.mesh);
        s.mesh.material.dispose();
        shots.splice(i, 1);
      }
    }
  }

  function clear() {
    shots.forEach((s) => { scene.remove(s.mesh); s.mesh.material.dispose(); });
    shots.length = 0;
  }

  /* =========================================================
     TÜRE ÖZGÜ YETENEKLER (normal yaratıklar)
     surf: oyuncuya yüzey mesafesi. Başlatırsa true.
     ========================================================= */
  function species(game, e, surf) {
    const a = e.def.ability;
    const P = game.player;
    const pos = e.group.position;
    const pp = P.group.position;
    const d = pos.distanceTo(pp);
    const W = game.diff.windup;

    switch (a.kind) {
      case 'spikes':
        if (surf > a.r - 0.6) return false;
        circle(game, e, pos.x, pos.z, a.r + e.radius * 0.5, a.windup * W, a.mult);
        e.busyT = a.windup * W + 0.25;
        break;
      case 'spit': {
        if (d > a.range || d < 4) return false;
        const from = pos.clone(); from.y += e.group.userData.height * 0.6;
        const lead = pp.clone().addScaledVector(P.vel, d / a.speed * 0.5);
        const dir = new THREE.Vector3(lead.x - from.x, 0, lead.z - from.z);
        e.group.rotation.y = Math.atan2(dir.x, dir.z);
        EV.Creature.attack(e.group, 0.3);
        shoot(game, e, from, dir, a.speed, e.dmg * a.mult, a.st, 0.4, a.color || 0xb56cff, a.range + 4);
        e.busyT = 0.4;
        break;
      }
      case 'volley': {
        if (d > a.range || d < 3) return false;
        const from = pos.clone(); from.y += e.group.userData.height * 0.6;
        const yaw0 = Math.atan2(pp.x - from.x, pp.z - from.z);
        e.group.rotation.y = yaw0;
        EV.Creature.attack(e.group, 0.3);
        for (let i = 0; i < a.count; i++) {
          const yaw = yaw0 + (a.count > 1 ? -a.spread / 2 + (a.spread * i) / (a.count - 1) : 0);
          shoot(game, e, from.clone(), new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), a.speed, e.dmg * a.mult, a.st, 0.32, a.color || 0xffc06a, a.range + 4);
        }
        e.busyT = 0.45;
        break;
      }
      case 'pounce':
      case 'charge':
        if (d > a.len + 2 || d < 3) return false;
        charge(game, e, a.len, a.w, a.windup * W, a.mult, null, a.kind === 'charge' ? 0.4 : 0.28);
        e.busyT = a.windup * W + 0.45;
        break;
      default: return false;
    }
    e.abilityCd = a.cd;
    return true;
  }

  /* =========================================================
     KİTLER
     run(game, e, b) → boss'un meşgul kalacağı süre (sn)
     ========================================================= */
  function spawnAdds(game, e, n, tierIdx) {
    const pool = EV.MOBS.ENEMIES[game.stageIndex];
    const def = pool[Math.min(tierIdx, pool.length - 1)];
    const sc = EV.Enemies.statScale(game, 'normal');
    for (let i = 0; i < n; i++) {
      const s = EV.World.randomSpawn(e.group.position, 4, 9, 1);
      const a = EV.Enemies.make(game, def, { pos: s, hp: def.hp * sc.hp, dmg: def.dmg * sc.dmg });
      a.aggroT = 30;
      EV.FX.burst(a.group.position.clone().setY(a.group.position.y + 1), 0xff8a8a, 8, 5);
    }
  }

  const KITS = {
    /* ---------- Hücre Alfası ---------- */
    devourer: {
      basic: { mult: 1.0, cd: 2.2 },
      phases: [0.5, 0.25],
      abilities: [
        { id: 'acidrain', name: 'Asit Yağmuru', cd: 7, min: 0, max: 32, weight: 1.2, run: (g, e, b) => {
          const n = b.phase >= 3 ? 7 : b.phase >= 2 ? 5 : 3;
          const pp = g.player.group.position;
          for (let i = 0; i < n; i++) {
            const a = U.rand(0, Math.PI * 2), r = i === 0 ? 0 : U.rand(2.5, 6.5);
            circle(g, e, pp.x + Math.cos(a) * r, pp.z + Math.sin(a) * r, 3.2, 1.2 * Wm(g, e), 0.9, [['poison', 3]], i * 0.15);
          }
          return 0.7;
        } },
        { id: 'engulf', name: 'Yutma Hamlesi', cd: 9, min: 5, max: 26, run: (g, e) => {
          const d = e.group.position.distanceTo(g.player.group.position);
          const w = 1.0 * Wm(g, e);
          charge(g, e, Math.min(26, d + 5), 3.6, w, 1.6, null, 0.35);
          return w + 0.45;
        } },
        { id: 'ring', name: 'Zehir Halkası', cd: 11, min: 0, max: 9, run: (g, e) => {
          const w = 1.4 * Wm(g, e);
          circle(g, e, e.group.position.x, e.group.position.z, 8, w, 1.4, [['poison', 4]], 0, 8);
          return w + 0.2;
        } },
        { id: 'bud', name: 'Tomurcuklanma', cd: 18, min: 0, max: 40, phase: 2, run: (g, e) => { spawnAdds(g, e, 3, 2); return 0.8; } },
      ],
    },

    /* ---------- Sürüngen Alfası ---------- */
    varanus: {
      basic: { mult: 1.0, cd: 2.0 },
      phases: [0.5, 0.25],
      abilities: [
        { id: 'tailsweep', name: 'Kuyruk Süpürmesi', cd: 6, min: 0, max: 10, run: (g, e) => {
          const w = 1.0 * Wm(g, e);
          cone(g, e, yawTo(e, g.player.group.position.x, g.player.group.position.z), 10, 2.2, w, 1.4, [['slow', 2]], 10);
          return w + 0.2;
        } },
        { id: 'sandline', name: 'Kum Patlaması', cd: 8, min: 4, max: 28, run: (g, e) => {
          const yaw = yawTo(e, g.player.group.position.x, g.player.group.position.z);
          const p = e.group.position;
          for (let i = 0; i < 6; i++) {
            const d = 3 + i * 3.4;
            circle(g, e, p.x + Math.sin(yaw) * d, p.z + Math.cos(yaw) * d, 2.6, 0.9 * Wm(g, e), 1.0, [['slow', 1]], i * 0.14);
          }
          return 0.9;
        } },
        { id: 'volley', name: 'Zehirli Salya', cd: 7, min: 6, max: 30, run: (g, e) => {
          const yaw0 = yawTo(e, g.player.group.position.x, g.player.group.position.z);
          const w = 0.8 * Wm(g, e);
          const p = e.group.position;
          for (let i = 0; i < 5; i++) {
            const yaw = yaw0 + (i - 2) * 0.25;
            EV.Decal.tele({ shape: 'rect', x: p.x, z: p.z, yaw, len: 26, w: 0.9, windup: w, owner: e,
              onFire: () => {
                if (!e.alive) return;
                const from = p.clone(); from.y += e.group.userData.height * 0.6;
                shoot(g, e, from, new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), 32, e.dmg * 0.6, [['poison', 2]], 0.5, 0x9cff6a, 28);
              } });
          }
          return w + 0.3;
        } },
        { id: 'quake', name: 'Toprak Sarsıntısı', cd: 12, min: 0, max: 16, phase: 2, run: (g, e) => {
          const w = Wm(g, e);
          ring(g, e, 2, 6, 1.0 * w, 1.2);
          ring(g, e, 6, 10, 1.35 * w, 1.2);
          ring(g, e, 10, 14, 1.7 * w, 1.2);
          return 1.8 * w;
        } },
      ],
    },

    /* ---------- Memeli Alfası ---------- */
    saberking: {
      basic: { mult: 1.0, cd: 1.8 },
      phases: [0.5, 0.25],
      abilities: [
        { id: 'pounce', name: 'Sıçrama', cd: 6, min: 5, max: 26, run: (g, e, b) => {
          const w = 1.1 * Wm(g, e);
          const leap = (delay) => {
            const pp = g.player.group.position.clone();
            EV.Decal.tele({ shape: 'circle', x: pp.x, z: pp.z, r: 4, windup: w, delay, owner: e,
              onFire: (t) => {
                if (!e.alive) return;
                const p = e.group.position;
                e.lunge = { vx: (pp.x - p.x) / 0.25, vz: (pp.z - p.z) / 0.25, t: 0.25 };
                EV.Creature.attack(e.group, 0.3);
                EV.FX.ring(pp, 0xff5a3d, 4, 0.3);
                if (playerIn(g, t)) hurt(g, e, 1.6, [['stun', 0.6]], 8, pp);
              } });
          };
          leap(0);
          if (b.phase >= 3) { leap(w + 0.7); return w * 2 + 1.1; }
          return w + 0.4;
        } },
        { id: 'clawcombo', name: 'Pençe Kombosu', cd: 7, min: 0, max: 9, run: (g, e) => {
          const yaw = yawTo(e, g.player.group.position.x, g.player.group.position.z);
          const w = Wm(g, e);
          [[-0.3, 0.7], [0.3, 0.95], [0, 1.2]].forEach(([o, t]) => cone(g, e, yaw + o, 7, 1.3, t * w, 0.9, [['bleed', 2]], 4));
          return 1.3 * w;
        } },
        { id: 'roar', name: 'Kükreme', cd: 12, min: 0, max: 10, run: (g, e) => {
          const w = 1.5 * Wm(g, e);
          circle(g, e, e.group.position.x, e.group.position.z, 11, w, 0.7, [['stun', 0.9], ['vuln', 2]], 0, 6);
          return w + 0.3;
        } },
        { id: 'pack', name: 'Sürü Çağrısı', cd: 16, min: 0, max: 40, phase: 2, run: (g, e) => { spawnAdds(g, e, 2, 4); return 0.8; } },
      ],
    },

    /* ---------- Apex avcılar ---------- */
    apexCell: {
      basic: { mult: 1.0, cd: 2.0 }, phases: [],
      abilities: [
        { id: 'lunge', name: 'Hamle', cd: 6, min: 6, max: 24, run: (g, e) => {
          const w = 0.9 * Wm(g, e);
          charge(g, e, Math.min(18, e.group.position.distanceTo(g.player.group.position) + 4), 3.2, w, 1.3, null, 0.4);
          return w + 0.5;
        } },
        { id: 'maw', name: 'Dev Ağız', cd: 7, min: 0, max: 8, run: (g, e) => {
          const w = 1.0 * Wm(g, e);
          const yaw = yawTo(e, g.player.group.position.x, g.player.group.position.z);
          const f = front(e) * 0.8, p = e.group.position;
          circle(g, e, p.x + Math.sin(yaw) * f, p.z + Math.cos(yaw) * f, 5, w, 1.5, [['poison', 3]]);
          return w + 0.2;
        } },
      ],
    },
    apexBird: {
      basic: { mult: 1.0, cd: 1.8 }, phases: [],
      abilities: [
        { id: 'lunge', name: 'Hamle', cd: 5, min: 6, max: 24, run: (g, e) => {
          const w = 0.85 * Wm(g, e);
          charge(g, e, Math.min(18, e.group.position.distanceTo(g.player.group.position) + 4), 3, w, 1.3, null, 0.35);
          return w + 0.45;
        } },
        { id: 'peck', name: 'Gaga Darbesi', cd: 5, min: 0, max: 8, run: (g, e) => {
          const w = 0.8 * Wm(g, e);
          cone(g, e, yawTo(e, g.player.group.position.x, g.player.group.position.z), 7, 1.0, w, 1.4, [['bleed', 2]], 6);
          return w + 0.2;
        } },
      ],
    },
    apexBear: {
      basic: { mult: 1.0, cd: 2.0 }, phases: [],
      abilities: [
        { id: 'lunge', name: 'Hamle', cd: 7, min: 6, max: 24, run: (g, e) => {
          const w = 0.95 * Wm(g, e);
          charge(g, e, Math.min(18, e.group.position.distanceTo(g.player.group.position) + 4), 3.6, w, 1.4, null, 0.4);
          return w + 0.5;
        } },
        { id: 'slam', name: 'Yer Sarsma', cd: 8, min: 0, max: 7, run: (g, e) => {
          const w = 1.1 * Wm(g, e);
          circle(g, e, e.group.position.x, e.group.position.z, 6.5, w, 1.7, [['stun', 0.6]], 0, 10);
          return w + 0.2;
        } },
      ],
    },
  };

  /* =========================================================
     Boss beyni
     ========================================================= */
  function init(game, e, kitId) {
    const kit = KITS[kitId];
    const b = { kit, cds: {}, gcd: 2.2, busyT: 0, phase: 1, basicCd: 1.2, speedMul: 1, cdMul: 1 };
    kit.abilities.forEach((a) => { b.cds[a.id] = U.rand(1, a.cd * 0.6); });
    e.boss = b;
  }

  function onPhase(game, e) {
    const b = e.boss;
    b.speedMul *= 1.12;
    b.cdMul *= 0.85;
    b.busyT = 0.8;
    EV.FX.ring(e.group.position, 0xff3d3d, 18, 0.9);
    U.audio.roar();
    if (e.isAlpha) game.toast(e.name.toLocaleUpperCase('tr-TR') + ' ÖFKELENDİ<br><span class="sub">Faz ' + b.phase + '</span>', '#ff6b6b');
  }

  /** Boss'un bu karedeki kararı; hareket ettiyse true. */
  function update(game, e, dt, smul) {
    const b = e.boss;
    const P = game.player;
    const pos = e.group.position;
    const pp = P.group.position;

    const shift = game.diff.id === 'dehset' ? 0.1 : 0;
    const th = b.kit.phases;
    while (b.phase - 1 < th.length && e.hp / e.maxHp < th[b.phase - 1] + shift) {
      b.phase++;
      onPhase(game, e);
    }

    for (const k in b.cds) b.cds[k] -= dt;
    b.gcd -= dt;
    b.basicCd -= dt;
    if (b.busyT > 0) { b.busyT -= dt; return false; }
    if (!P.alive) return false;

    const d = pos.distanceTo(pp);
    const surf = EV.Creature.surfDist(e.group, pp.x, pp.z) - P.radius;

    if (b.gcd <= 0) {
      const ready = b.kit.abilities.filter((a) => (b.cds[a.id] || 0) <= 0 && b.phase >= (a.phase || 1) && d >= a.min && d <= a.max);
      if (ready.length) {
        const a = U.weightedPick(ready, (x) => x.weight || 1);
        b.cds[a.id] = a.cd * b.cdMul;
        b.gcd = 1.3 * b.cdMul;
        e.group.rotation.y = yawTo(e, pp.x, pp.z);
        b.busyT = a.run(game, e, b) || 1;
        EV.UI.bossCast(e, a.name);
        U.audio.tele();
        return false;
      }
    }

    if (surf <= 2.4 && b.basicCd <= 0) {
      const w = 0.65 * Wm(game, e);
      cone(game, e, yawTo(e, pp.x, pp.z), front(e) + 2.4, 1.4, w, b.kit.basic.mult, null, 5);
      b.basicCd = b.kit.basic.cd * b.cdMul;
      b.busyT = w + 0.2;
      return false;
    }

    return EV.Enemies.steer(game, e, pp.x, pp.z, e.speed * smul * b.speedMul, dt, front(e) + P.radius + 0.4);
  }

  return { setup, init, update, species, shoot, updateShots, clear, KITS };
})();
