/* ============================================================
   skills2.js — ETKİLEŞİMLİ yetenek mekanikleri (skills.js'in devamı)

   skills.js'deki türler "bas → bir şekilde hasar" iken buradakiler
   farklı OYNANIR; her biri gerçek bir hayvan davranışından:
     grab     Yakala-Fırlat  (bukalemun dili, timsah ölüm yuvarlanışı)
              bas: kap · basılı tut: taşı + nişan al · bırak: fırlat
              roll: kilitlenip yuvarlanır (her dönüş hasar), sonra fırlatır
     engulf   Yut (amip fagositozu): bas: küçük avı yut, içinde sindir
              (hasar + can) · tekrar bas: tükür (mermi olur)
     tether   Bağ (yapışkan iplik, vampir ısırığı): ava bağlanır, emer;
              çok uzaklaşırsan kopar, süre dolarsa patlar
     mark     İşaretle-Patlat (komodo zehri, avcı işareti): işaretler;
              her vuruşun işareti büyütür · tekrar bas: hepsi patlar
     parry    Savuştur (zar gerilimi, kirpi dikeni): kısa pencere; o an
              vurulursan hasar yok, saldıran karşı darbe yer
     stealth  Pusu (bukalemun): gizlenirsin; ilk saldırın avın üstüne
              atılan kritik + sersemletici bir pusu olur
     burrow   Kazı (kum balığı): toprak altında görünmez/dokunulmaz, hızlı;
              tekrar bas / saldır: altındakileri fırlatarak çık
     stance   Duruş (aç/kapa, enerji yakar) ya da Dönüşüm (ulti, süreli):
              TEMEL SALDIRINI değiştirir
     rush     Hıza göre hasar (bizon hücumu): basılı tut → hızlan, nişanla
              yönlendir; çiğner; bırakınca hızla orantılı darbe
     charge   Basılı tut → güçlen → bırak (kirpik fırtınası, çene kası)
     command  Sürüye emir (kurt uluması): yardımcılar hedefe atılır, güçlenir

   Girdi sözleşmesi (player.js):
     cast(... c.hold = tuş kodu)  basılı tutulanlar tuşu kendileri izler;
                                  tuş yoksa (otomatik / yankı / test) p.autoHold
     pending(def) / recast(def)   iki aşamalılar: ikinci basış tryCast'te
                                  bekleme kontrolünden ÖNCE yakalanır; asıl
                                  bekleme ikinci aşamada başlar (finish)
     basicMod(game)               temel saldırıyı değiştirir / yutar
     hidden(game)                 gizlilik ve toprak altı düşmanın gözünden sakla
   Hasar kancası: EV.Combat.hitPlayer sarılır (savuşturma, toprak altı,
   gizliliğin bozulması); hitEnemy/hitArea sarılır (işaret yükleri).
   Yankı (echo) hiçbir türde oyuncuyu taşımaz/gizlemez: hedefte darbe olur.
   ============================================================ */
window.EV = window.EV || {};

EV.Skills2 = (function () {
  'use strict';

  const U = EV.U;
  const hostile = (e) => !!e && e.alive && !e.ally && !e.peaceful;
  const isBoss = (e) => !!(e.isAlpha || e.isApex || e.isMini || e.isNemesis || e.behavior === 'boss');
  const SLOT_CODE = { 0: 'KeyQ', 1: 'KeyE', 2: 'KeyF', R: 'KeyR' };
  const OWN_BUFF = /^(grab:|stance:|stealth$|burrow$|rush$|charge$)/;

  let game = null;
  const holds = [];      // tutulan / yutulan avlar
  const flights = [];    // fırlatılan / tükürülen avlar
  const tethers = [];
  const markSets = [];
  const cmds = [];       // sürü emri hedef işaretleri
  const timers = [];
  let parry = null, stance = null, stealth = null, burrow = null, rush = null, charge = null;
  const hintN = Object.create(null);
  const glowIds = new Map();
  let glowT = 0;

  const GEO = {
    ball: new THREE.IcosahedronGeometry(1, 1),
    ring: new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2),
    tube: new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    halo: new THREE.TorusGeometry(0.5, 0.09, 6, 18).rotateX(Math.PI / 2),
  };
  const arcs = new Map();
  function arcGeo(a) {
    const k = Math.round(a * 10);
    if (!arcs.has(k)) arcs.set(k, new THREE.RingGeometry(0.82, 1, 16, 1, -Math.PI / 2 - k / 20, k / 10).rotateX(-Math.PI / 2));
    return arcs.get(k);
  }
  function mesh(geo, color, op, wire) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, wireframe: !!wire,
    }));
    game.scene.add(m);
    return m;
  }
  function drop(m) { if (m) { if (m.parent) m.parent.remove(m); m.material.dispose(); } }

  /* ---------------- küçük yardımcılar ---------------- */
  const PL = () => game.player;
  function later(t, fn) { timers.push({ t, fn }); }
  function chestOf(g) { const p = g.position; return new THREE.Vector3(p.x, p.y + g.userData.height * 0.55, p.z); }
  function groundAt(x, z) { return new THREE.Vector3(x, EV.World.groundY(x, z), z); }
  function yawTo(x, z) { const p = PL().group.position; return Math.atan2(x - p.x, z - p.z); }
  function surf(e) { const p = PL().group.position; return EV.Creature.surfDist(e.group, p.x, p.z); }
  function floatAt(e, text, color) {
    const p = e.group.position;
    EV.UI.floatText(new THREE.Vector3(p.x, p.y + e.group.userData.height + 1, p.z), text, color);
  }
  function floatPlayer(text, color) { floatAt({ group: PL().group }, text, color); }
  function hint(key, html, color) {
    hintN[key] = (hintN[key] || 0) + 1;
    if (hintN[key] <= 3) game.toast(html, color || '#9de89d', 1300);
  }
  function killBuff(id) { const b = PL().buffs.find((x) => x.id === id); if (b) b.t = 0; }
  function colorRgb(hex, k) { const c = new THREE.Color(hex); return { r: c.r * k, g: c.g * k, b: c.b * k }; }
  /** İki aşamalının asıl beklemesi (ikinci aşamada / süre dolunca başlar). */
  function finish(ref, p) {
    if (!ref) return;
    ref.cd = p.cd * (1 - (PL().stats.cdr || 0));
    ref.cdMax = ref.cd;
  }
  function areaHit(x, z, r, dmg, o, skip) {
    EV.Enemies.forEachNear(x, z, r + 6, (e) => {
      if (e === skip || !hostile(e)) return;
      if (EV.Creature.surfDist(e.group, x, z) <= r) EV.Combat.hitEnemy(game, e, dmg, o);
    });
  }
  /** Yankı ve "hareket ettiren" türlerin güvenli karşılığı: hedefte darbe. */
  function echoBurst(c, r, mult, st, crit) {
    const pt = c.target ? c.target.group.position : c.point;
    const g = groundAt(pt.x, pt.z);
    EV.Combat.hitArea(game, g.x, g.z, r, c.base * mult, { source: c.src, st, pow: c.pow, knock: 4, from: g, forceCrit: !!crit });
    EV.FX.ring(g, c.color, r, 0.4);
    EV.FX.burst(g.clone().setY(g.y + 0.6), c.color, 8, 6);
    return true;
  }

  /** Av seçimi: kilitli > nişana yakın > oyuncuya yakın (menzil içinde). */
  function pickPrey(c, range) {
    const pos = PL().group.position;
    const ok = (e) => hostile(e) && !e.held && surf(e) <= range;
    if (ok(c.target)) return c.target;
    const ax = c.point ? c.point.x : pos.x, az = c.point ? c.point.z : pos.z;
    let best = null, bs = Infinity;
    EV.Enemies.forEachNear(pos.x, pos.z, range, (e) => {
      if (!ok(e)) return;
      const s = Math.hypot(e.group.position.x - ax, e.group.position.z - az) + surf(e) * 0.5;
      if (s < bs) { bs = s; best = e; }
    });
    return best;
  }

  /* ---------------- tuşa bağlı yetenek yuvası parlaması (masaüstü + telefon) ---------------- */
  function slotEls(id) {
    const b = game && game.build;
    if (!b || typeof document === 'undefined') return [];
    const i = b.skills.findIndex((s) => s.id === id);
    const ult = !!(b.ult && b.ult.id === id);
    const out = [];
    const bar = document.querySelectorAll('#skillbar .sl');
    if (i >= 0 && bar[i + 1]) out.push(bar[i + 1]);
    if (ult && bar[4]) out.push(bar[4]);
    const mob = (i >= 0 || ult) && document.querySelector(ult ? '.m-ult' : '.m-skill' + (i + 1));
    if (mob) out.push(mob);
    return out;
  }
  function slotGlow(id, color) {
    const on = color != null;
    if (on) glowIds.set(id, color); else glowIds.delete(id);
    const css = on ? '0 0 0 3px #' + new THREE.Color(color).getHexString() + ', 0 0 16px #' + new THREE.Color(color).getHexString() : '';
    slotEls(id).forEach((el) => { el.style.boxShadow = css; });
  }

  /* =========================================================
     TUTMA: yakalanan / yutulan / fırlatılan av
     ========================================================= */
  function seize(e) { e.held = true; e.lunge = null; e.atkT = 0; e.atkTarget = null; e.knock.set(0, 0, 0); }
  function keep(e, x, y, z) {
    e.group.position.set(x, y, z);
    e.stun = Math.max(e.stun || 0, 0.15);
    e.atkT = 0; e.atkTarget = null; e.lunge = null;
    e.knock.set(0, 0, 0);
  }
  function unseize(e) {
    e.held = false;
    e.group.rotation.x = 0;
    e.group.rotation.z = 0;
    e.group.scale.setScalar(1);
  }
  function settle(e) {
    const p = e.group.position;
    const v = { x: p.x, z: p.z };
    EV.World.resolveCollision(v, e.radius);
    p.set(v.x, EV.World.groundY(v.x, v.z), v.z);
  }
  function tooBig(e, p) { return isBoss(e) ? !p.boss : e.radius > PL().radius * (p.maxSize || 1.5); }

  /** Fırlatma yönü: elle → nişan (kilit tutulan avdaysa kameranın önündeki ilk düşman / kamera yönü);
   *  otomatik → en yakın başka düşman; yoksa baktığın yön. */
  function throwDir(h, dist) {
    const pl = PL(), pp = pl.group.position;
    const other = (o) => hostile(o) && o !== h.e && !o.held;
    let tx = null, tz = null;
    if (h.c.hold && !(pl.lockTarget && pl.lockTarget.held)) { tx = pl.aimPoint.x; tz = pl.aimPoint.z; } else if (h.c.hold) {
      const n = EV.Enemies.nearest(pp.x, pp.z, dist, (o) => other(o) &&
        Math.abs(U.wrapAngle(yawTo(o.group.position.x, o.group.position.z) - pl.yaw)) < 0.6);
      if (n) { tx = n.group.position.x; tz = n.group.position.z; } else return pl.yaw;
    } else {
      const n = EV.Enemies.nearest(pp.x, pp.z, dist, other);
      if (n) { tx = n.group.position.x; tz = n.group.position.z; }
    }
    let yaw = pl.group.rotation.y;
    if (tx != null && Math.hypot(tx - pp.x, tz - pp.z) > 0.5) yaw = Math.atan2(tx - pp.x, tz - pp.z);
    return yaw;
  }

  function launch(h, dmg, splash, splashR, dist, speed) {
    const pl = PL(), e = h.e;
    const yaw = throwDir(h, dist);
    e.group.scale.setScalar(1);
    e.group.rotation.z = 0;
    const pos = e.group.position;
    flights.push({
      e, dx: Math.sin(yaw), dz: Math.cos(yaw), speed, dist, left: dist, y0: pos.y,
      dmg, splash, splashR: splashR * Math.sqrt(pl.stats.area), st: h.p.st, src: h.c.src, pow: h.c.pow, color: h.c.color,
    });
    pl.aimYaw = yaw;
    pl.group.rotation.y = yaw;
    pl.faceT = Math.max(pl.faceT, 0.3);
    EV.Creature.attack(pl.group, 0.25);
    U.audio.shoot();
  }

  function updFlight(f, dt) {
    const e = f.e;
    if (!e.alive) { unseize(e); return true; }
    const pos = e.group.position;
    const step = Math.min(f.left, f.speed * dt);
    const bx = pos.x + f.dx * step, bz = pos.z + f.dz * step;
    const v = { x: bx, z: bz };
    EV.World.resolveCollision(v, e.radius * 0.7);
    const wall = Math.hypot(v.x - bx, v.z - bz) > 0.05;
    f.left -= step;
    const k = 1 - f.left / f.dist;
    pos.set(v.x, EV.World.groundY(v.x, v.z) + 0.4 + Math.sin(k * Math.PI) * Math.min(3, f.dist * 0.18), v.z);
    e.group.rotation.x += dt * 11;
    e.stun = Math.max(e.stun || 0, 0.15);
    e.knock.set(0, 0, 0);
    e.atkT = 0;
    let hit = null;
    EV.Enemies.forEachNear(v.x, v.z, e.radius + 2, (o) => {
      if (hit || o === e || !hostile(o) || o.held) return;
      if (EV.Creature.surfDist(o.group, v.x, v.z) <= e.radius * 0.9) hit = o;
    });
    if (!hit && !wall && f.left > 0.01) return false;
    // çarpma: fırlatılan ve çevresindekiler
    unseize(e);
    const g = groundAt(pos.x, pos.z);
    pos.y = g.y;
    EV.Combat.hitEnemy(game, e, f.dmg, { source: f.src, st: f.st, pow: f.pow, knock: 3, from: g });
    areaHit(g.x, g.z, f.splashR, f.splash, { source: f.src, st: f.st, pow: f.pow, knock: 9, from: g }, e);
    EV.FX.ring(g, f.color, f.splashR, 0.4);
    EV.FX.burst(g.clone().setY(g.y + 0.6), f.color, 12, 8);
    U.audio.hit();
    return true;
  }

  /* ---------------- grab ---------------- */
  function castGrab(def, p, c) {
    const pl = PL(), pos = pl.group.position;
    const e = pickPrey(c, p.range);
    if (!e) return false;
    EV.FX.beam(chestOf(pl.group), chestOf(e.group), c.color);
    const lash = c.base * (p.grabDmg + p.dmg * 0.5);
    if (c.echo || tooBig(e, p)) {      // yankı / ağır av: kamçılayıp sersemletir, tutmaz
      EV.Combat.hitEnemy(game, e, lash, { source: c.src, st: [['stun', 0.5]].concat(p.st || []), pow: c.pow, knock: 3, from: pos });
      if (!c.echo) floatAt(e, 'ÇOK AĞIR', '#ffd9a0');
      return true;
    }
    EV.Combat.hitEnemy(game, e, c.base * p.grabDmg, { source: c.src, pow: c.pow });
    if (!e.alive) return true;
    seize(e);
    const boss = isBoss(e);
    const h = {
      id: def.id, kind: 'grab', def, p, c, e, t: 0, done: false, roll: !!p.roll, boss, rollT: 0,
      snatch: boss ? 0 : 0.16, sx: e.group.position.x, sy: e.group.position.y, sz: e.group.position.z,
      max: boss ? p.carry * 0.5 : p.carry, yaw: yawTo(e.group.position.x, e.group.position.z),
    };
    if (h.roll) {
      pl.iframe = Math.max(pl.iframe, 0.3);
      if (boss) {                       // bossun yanına kilitlen
        const ep = e.group.position;
        const d = Math.max(0.01, Math.hypot(ep.x - pos.x, ep.z - pos.z));
        const off = surf(e) - 0.4;
        if (off > 0) { pos.x += (ep.x - pos.x) / d * off; pos.z += (ep.z - pos.z) / d * off; EV.World.resolveCollision(pos, pl.radius); }
      }
      pl.aimYaw = h.yaw;
      pl.group.rotation.y = h.yaw;
    }
    holds.push(h);
    U.audio.blip(520, 0.1, 'triangle', 0.05, 240);
    hint('grab' + (h.roll ? 'r' : ''), h.roll ? '🐊 Ölüm yuvarlanışı!' : '👅 Yakaladın — <b>basılı tut: taşı · bırak: FIRLAT</b>', '#ffd23d');
    return true;
  }

  function updGrab(h, dt) {
    const pl = PL(), pp = pl.group.position, e = h.e, p = h.p;
    if (EV.Status.stunned(pl)) { unseize(e); settle(e); return true; }
    if (!h.boss) {
      const yaw = h.roll ? h.yaw : pl.group.rotation.y;
      const reach = pl.radius + e.radius * 0.7 + 0.3;
      const hx = pp.x + Math.sin(yaw) * reach, hz = pp.z + Math.cos(yaw) * reach;
      const hy = EV.World.groundY(hx, hz) + (h.roll ? 0.3 : 0.9);
      const k = h.snatch > 0 ? U.clamp(h.t / h.snatch, 0, 1) : 1;
      keep(e, U.lerp(h.sx, hx, k), U.lerp(h.sy, hy, k), U.lerp(h.sz, hz, k));
    } else {
      const ep = e.group.position;
      keep(e, ep.x, ep.y, ep.z);
    }
    if (h.roll) {
      e.group.rotation.z += dt * 13;
      pl.iframe = Math.max(pl.iframe, 0.12);
      h.rollT += dt;
      while (h.rollT >= p.rollTick && e.alive) {
        h.rollT -= p.rollTick;
        const d = EV.Combat.hitEnemy(game, e, h.c.base * p.rollDmg, { source: h.c.src, pow: h.c.pow, noRage: true, st: p.rollSt });
        if (p.heal) game.healPlayer(d * p.heal);
        EV.FX.burst(chestOf(e.group), 0xd8344a, 3, 4);
      }
      if (!e.alive) return true;
    } else {
      e.group.rotation.z = Math.sin(h.t * 11) * 0.3;                         // çırpınma
      game.addBuff({ id: 'grab:' + h.id, t: 0.15, mods: { speed: -(p.carrySlow || 0.2) } });
    }
    let go = h.t >= h.max;
    if (!go && !h.roll && h.t >= h.snatch + 0.03) go = h.c.hold ? !EV.Input.down(h.c.hold) : h.t >= h.snatch + (p.autoHold || 0.3);
    if (!go) return false;
    if (h.boss) {                         // boss fırlatılmaz: yere çarpılır
      unseize(e);
      const g = groundAt(e.group.position.x, e.group.position.z);
      EV.Combat.hitEnemy(game, e, h.c.base * p.dmg, { source: h.c.src, st: p.st, pow: h.c.pow });
      areaHit(g.x, g.z, p.splashR, h.c.base * p.splash, { source: h.c.src, st: p.st, pow: h.c.pow, knock: 8, from: g }, e);
      EV.FX.ring(g, h.c.color, p.splashR, 0.45);
      EV.FX.burst(g.clone().setY(g.y + 0.8), h.c.color, 14, 9);
      U.audio.roar();
      return true;
    }
    launch(h, h.c.base * p.dmg, h.c.base * p.splash, p.splashR, p.throwDist, 30);
    return true;
  }

  /* ---------------- engulf ---------------- */
  function castEngulf(def, p, c) {
    const pl = PL();
    const e = pickPrey(c, p.range);
    if (!e) return false;
    EV.FX.beam(chestOf(pl.group), chestOf(e.group), c.color);
    if (c.echo || tooBig(e, p)) {       // yankı / iri av: asitli tokat
      EV.Combat.hitEnemy(game, e, c.base * p.spit * 0.6, { source: c.src, st: p.st, pow: c.pow, knock: 5, from: pl.group.position });
      if (!c.echo) floatAt(e, 'ÇOK İRİ', '#ffd9a0');
      return true;
    }
    seize(e);
    holds.push({
      id: def.id, kind: 'engulf', def, p, c, e, t: 0, done: false, snatch: 0.28, tickT: 0, ref: c.slotRef,
      sx: e.group.position.x, sy: e.group.position.y, sz: e.group.position.z,
    });
    slotGlow(def.id, c.color);
    U.audio.eat();
    hint('engulf', '🦠 Yuttun, sindiriyorsun — <b>tekrar bas: TÜKÜR</b>');
    return true;
  }

  function updEngulf(h, dt) {
    const pl = PL(), pp = pl.group.position, e = h.e, p = h.p;
    const k = U.clamp(h.t / h.snatch, 0, 1);
    const cy = pp.y + pl.group.userData.height * 0.45;
    keep(e, U.lerp(h.sx, pp.x, k), U.lerp(h.sy, cy, k), U.lerp(h.sz, pp.z, k));
    e.group.scale.setScalar(U.lerp(1, 0.45, k));
    e.group.rotation.y += dt * 1.6;
    if (k >= 1) {
      h.tickT += dt;
      while (h.tickT >= p.tick) {
        h.tickT -= p.tick;
        const d = EV.Combat.hitEnemy(game, e, h.c.base * p.dmg, { source: h.c.src, pow: h.c.pow, noRage: true, cls: 'dot' });
        if (p.heal) game.healPlayer(d * p.heal);
        if (!e.alive) {
          game.healPlayer(pl.stats.maxHp * 0.04);
          floatPlayer('SİNDİRİLDİ', '#9de89d');
          EV.FX.burst(chestOf(pl.group), h.c.color, 10, 5);
          endEngulf(h);
          return true;
        }
      }
    }
    if (h.t >= p.digest + h.snatch) { spit(h); return true; }
    return false;
  }

  function endEngulf(h) {
    h.done = true;
    unseize(h.e);
    finish(h.ref, h.p);
    slotGlow(h.id, null);
  }

  function spit(h) {
    if (!h || h.done) return;
    endEngulf(h);
    h.e.held = true;                      // uçuş bitene kadar tutulu say
    launch(h, h.c.base * h.p.spit, h.c.base * h.p.splash, h.p.splashR, h.p.spitRange || 18, 34);
  }

  /* =========================================================
     BAĞ (tether)
     ========================================================= */
  function castTether(def, p, c) {
    const e = pickPrey(c, p.range);
    if (!e) return false;
    const id = (c.echo ? 'echo:' : '') + def.id;
    for (let i = tethers.length - 1; i >= 0; i--) if (tethers[i].id === id) { drop(tethers[i].m); tethers.splice(i, 1); }
    tethers.push({ id, p, c, e, left: p.dur * (c.echo ? 0.6 : 1), tickT: p.tick * 0.5, jumps: p.jump || 0,
      lx: e.group.position.x, lz: e.group.position.z, m: mesh(GEO.tube, c.color, 0.8) });
    EV.FX.burst(chestOf(e.group), c.color, 8, 4);
    U.audio.blip(300, 0.2, 'sine', 0.05, 600);
    if (!c.echo) hint('tether', '🕸️ Bağlandın — <b>yakın kal</b>, uzaklaşırsan kopar');
    return true;
  }

  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function updTether(t, dt) {
    const pl = PL(), pp = pl.group.position, p = t.p;
    if (!pl.alive) return true;
    if (!t.e.alive) {
      const n = t.jumps > 0 && EV.Enemies.nearest(t.lx, t.lz, p.range, (o) => hostile(o) && !o.held);
      if (!n) return true;
      t.jumps--;
      t.e = n;
      EV.FX.beam(new THREE.Vector3(t.lx, pp.y + 1, t.lz), chestOf(n.group), t.c.color);
    }
    const e = t.e, ep = e.group.position;
    t.lx = ep.x; t.lz = ep.z;
    const d = surf(e);
    if (d > p.breakR) {
      _a.copy(chestOf(pl.group)).lerp(chestOf(e.group), 0.5);
      EV.UI.floatText(_a, 'BAĞ KOPTU', '#cfc6b8');
      EV.FX.burst(_a, t.c.color, 8, 5);
      return true;
    }
    t.left -= dt;
    t.tickT += dt;
    while (t.tickT >= p.tick && e.alive) {
      t.tickT -= p.tick;
      const dealt = EV.Combat.hitEnemy(game, e, t.c.base * p.dmg, { source: t.c.src, st: p.st, pow: t.c.pow, noRage: true, cls: 'dot' });
      if (p.heal) game.healPlayer(dealt * p.heal);
    }
    if (e.alive && p.pull && !isBoss(e) && d > 2.5) {
      const dx = pp.x - ep.x, dz = pp.z - ep.z, l = Math.hypot(dx, dz) || 1;
      const s = Math.min(d - 2.5, p.pull * dt);
      ep.x += dx / l * s; ep.z += dz / l * s;
    }
    if (t.left <= 0) {
      if (e.alive) {
        EV.Combat.hitEnemy(game, e, t.c.base * p.end, { source: t.c.src, st: p.endSt, pow: t.c.pow, knock: 6, from: pp });
        EV.FX.ring(ep, t.c.color, 3, 0.4);
        EV.FX.burst(chestOf(e.group), t.c.color, 12, 7);
      }
      return true;
    }
    // görsel: gerildikçe incelir, kopmaya yakın kızarır
    const k = U.clamp(d / p.breakR, 0, 1);
    _a.copy(chestOf(pl.group));
    _b.copy(chestOf(e.group));
    t.m.position.copy(_a);
    t.m.lookAt(_b);
    const w = (0.16 - 0.1 * k) * (1 + 0.25 * Math.sin(game.time * 18));
    t.m.scale.set(w, w, _a.distanceTo(_b));
    t.m.material.color.set(t.c.color).lerp(_red, k > 0.75 ? (k - 0.75) * 4 : 0);
    return false;
  }
  const _red = new THREE.Color(0xff3030);

  /* =========================================================
     İŞARETLE-PATLAT (mark)
     ========================================================= */
  function castMark(def, p, c) {
    const pl = PL(), S = pl.stats, pos = pl.group.position;
    const id = (c.echo ? 'echo:' : '') + def.id;
    const set = { id, def, p, c, marks: new Map(), left: c.echo ? 1.4 : p.win, frac: c.echo ? 1 : p.autoFrac, ref: c.echo ? null : c.slotRef };
    const opt = { source: c.src, st: p.st, pow: c.pow, knock: p.knock || 2, from: pos };
    const tag = (e) => { EV.Combat.hitEnemy(game, e, c.base * p.dmg, opt); if (e.alive) addMark(set, e); };
    if (p.shape === 'area') {
      const pt = c.echo && c.target ? c.target.group.position : c.point;
      const v = { x: pt.x, z: pt.z };
      const dx = v.x - pos.x, dz = v.z - pos.z, l = Math.hypot(dx, dz);
      if (l > p.castRange) { v.x = pos.x + dx / l * p.castRange; v.z = pos.z + dz / l * p.castRange; }
      EV.World.clampToPlay(v);
      const r = p.r * S.area;
      EV.Enemies.forEachNear(v.x, v.z, r + 6, (e) => { if (hostile(e) && EV.Creature.surfDist(e.group, v.x, v.z) <= r) tag(e); });
      const g = groundAt(v.x, v.z);
      EV.FX.ring(g, c.color, r, 0.5);
      EV.FX.burst(g.clone().setY(g.y + 0.5), c.color, 8, 5);
    } else {
      const tp = c.target ? c.target.group.position : c.point;
      const yaw = yawTo(tp.x, tp.z);
      const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      if (!c.echo) { pl.aimYaw = yaw; pl.group.rotation.y = yaw; pl.impulse.addScaledVector(dir, (p.lunge || 0) * 4.5); }
      const range = (p.range + (p.lunge || 0) * 0.6) * (1 + (S.area - 1) * 0.5);
      const _c = { x: 0, z: 0 };
      EV.Enemies.forEachNear(pos.x, pos.z, range + 6, (e) => {
        if (!hostile(e) || EV.Creature.surfDist(e.group, pos.x, pos.z) > range) return;
        EV.Creature.closestPoint(e.group, pos.x, pos.z, _c);
        const ex = _c.x - pos.x, ez = _c.z - pos.z, d = Math.hypot(ex, ez);
        if (d > 1.2 && Math.abs(U.wrapAngle(Math.atan2(ex, ez) - yaw)) > p.angle / 2 + Math.atan2(e.radius, d)) return;
        tag(e);
      });
      EV.FX.slash(pos, yaw, range, p.angle, c.color);
      EV.Creature.attack(pl.group, 0.22);
    }
    U.audio.hit();
    if (!set.marks.size) return true;                 // ıska: normal bekleme
    markSets.push(set);
    if (!c.echo) {
      slotGlow(def.id, c.color);
      hint('mark', '🎯 ' + set.marks.size + ' av işaretlendi — vurdukça büyür · <b>tekrar bas: PATLAT</b>', '#ffd23d');
    }
    return true;
  }

  function addMark(set, e) {
    if (set.marks.has(e.id)) return;
    set.marks.set(e.id, { e, n: 1, growT: 0, lastT: -1, pop: 0.6, m: mesh(GEO.halo, set.c.color, 0.9) });
  }
  function stackUp(mk, max) { if (mk.n < max) { mk.n++; mk.pop = 0.6; } }

  /** Oyuncunun (ve yankının) her vuruşu işaretli hedefin yükünü artırır. */
  function onEnemyHit(e, o) {
    if (!e || (o && o.markBoom)) return;
    const src = (o && o.source) || 'player';
    if (src !== 'player' && src !== 'echo') return;
    for (let i = 0; i < markSets.length; i++) {
      const mk = markSets[i].marks.get(e.id);
      if (mk && game.time - mk.lastT >= 0.12) { mk.lastT = game.time; stackUp(mk, markSets[i].p.max); }
    }
  }

  function updMarks(set, dt) {
    set.left -= dt;
    set.marks.forEach((mk, id) => {
      const e = mk.e;
      if (!e.alive) { drop(mk.m); set.marks.delete(id); return; }
      if (set.p.grow) {
        mk.growT += dt;
        if (mk.growT >= set.p.grow) { mk.growT -= set.p.grow; stackUp(mk, set.p.max); }
      }
      mk.pop = Math.max(0, mk.pop - dt * 3);
      const ep = e.group.position;
      mk.m.position.set(ep.x, ep.y + e.group.userData.height + 0.7 + Math.sin(game.time * 4 + id) * 0.12, ep.z);
      mk.m.scale.setScalar(0.7 + 0.22 * mk.n + mk.pop);
      mk.m.rotation.y += dt * (2 + mk.n);
      mk.m.material.opacity = Math.min(1, 0.45 + 0.11 * mk.n + (set.left < 1.2 ? 0.3 * Math.sin(game.time * 25) : 0));
    });
    if (!set.marks.size) { endMarks(set); return true; }
    if (set.left <= 0) { detonate(set, set.frac); return true; }
    return false;
  }

  function endMarks(set) {
    set.marks.forEach((mk) => drop(mk.m));
    set.marks.clear();
    set.done = true;
    if (set.ref) finish(set.ref, set.p);
    if (!set.c.echo) slotGlow(set.def.id, null);
  }

  function detonate(set, frac) {
    if (!set || set.done) return;
    const p = set.p, c = set.c, from = PL().group.position;
    const list = [];
    set.marks.forEach((mk) => { if (mk.e.alive) list.push(mk); });
    endMarks(set);
    list.forEach((mk) => {
      const e = mk.e;
      if (!e.alive) return;
      const ep = e.group.position.clone();
      const d = c.base * (p.boom + p.per * mk.n) * frac;
      EV.Combat.hitEnemy(game, e, d, { source: c.src, st: p.boomSt, pow: c.pow, knock: 5, from, markBoom: true });
      if (p.boomR) areaHit(ep.x, ep.z, p.boomR, d * 0.5, { source: c.src, st: p.boomSt, pow: c.pow, knock: 4, from: ep, markBoom: true }, e);
      const g = groundAt(ep.x, ep.z);
      EV.FX.ring(g, c.color, 1.5 + mk.n * 0.5 + (p.boomR || 0), 0.4);
      EV.FX.burst(ep.setY(ep.y + 1), c.color, 6 + mk.n * 2, 7);
    });
    if (list.length) U.audio.react();
  }

  /* =========================================================
     SAVUŞTURMA (parry)
     ========================================================= */
  function castParry(def, p, c) {
    if (c.echo) return echoBurst(c, p.counterR || 2.5, p.counter * 0.8, p.st, true);
    if (parry) drop(parry.m);
    parry = { id: def.id, p, c, t: p.win, ok: 0, hit: new Set(), ref: c.slotRef, m: mesh(GEO.ball, c.color, 0.4, true) };
    U.audio.blip(640, 0.1, 'triangle', 0.05, 900);
    hint('parry', '🛡️ Darbe gelmeden <b>hemen önce</b> bas: savuştur ve karşı vur', '#8fd0ff');
    return true;
  }

  function updParry(dt) {
    const pl = PL(), pp = pl.group.position;
    parry.t -= dt;
    const m = parry.m;
    m.position.set(pp.x, pp.y + pl.group.userData.height * 0.5, pp.z);
    m.scale.setScalar((pl.radius * 1.35 + 0.4) * (1 + 0.06 * Math.sin(game.time * 30)));
    m.rotation.y += dt * 4;
    m.material.opacity = 0.18 + 0.5 * U.clamp(parry.t / parry.p.win, 0, 1) + (parry.ok ? 0.3 : 0);
    if (parry.t <= 0 || !pl.alive) { drop(m); parry = null; }
  }

  function counter(a) {
    const pl = PL(), pp = pl.group.position, p = parry.p, c = parry.c;
    EV.FX.beam(chestOf(pl.group), chestOf(a.group), c.color);
    EV.Combat.hitEnemy(game, a, c.base * p.counter, { source: c.src, st: p.st, pow: c.pow, knock: p.knock || 8, from: pp });
    floatAt(a, 'KARŞI DARBE', '#ffe08a');
  }

  /** hitPlayer sarmalayıcısı: true = darbe yutuldu. */
  function intercept(g, amount, o) {
    game = g;
    const pl = g.player;
    if (burrow && !(o.dot && !o.by)) return true;           // toprak altı: yalnız üstündeki durum hasarı işler
    if (!parry || parry.t <= 0 || o.dot || !pl.alive) return false;
    const p = parry.p, c = parry.c;
    pl.iframe = Math.max(pl.iframe, 0.3);
    if (!parry.ok) {
      const pp = pl.group.position;
      floatPlayer('SAVUŞTURMA!', '#8fd0ff');
      EV.FX.ring(pp, c.color, 4, 0.35);
      EV.FX.burst(chestOf(pl.group), c.color, 14, 8);
      U.audio.crit();
      if (parry.ref && p.refund) { parry.ref.cd *= 1 - p.refund; }
      if (p.shield) { pl.shield = Math.max(pl.shield, pl.stats.maxHp * p.shield); pl.shieldT = 4; }
      if (p.counterR) {                                      // dikenler her yöne
        const r = p.counterR * pl.stats.area;
        areaHit(pp.x, pp.z, r, c.base * p.splash, { source: c.src, st: p.st, pow: c.pow, knock: 6, from: pp }, o.attacker);
        for (let i = 0; i < 4; i++) EV.FX.slash(pp, i * Math.PI / 2, r, 1.7, c.color);
      }
    }
    parry.ok++;
    const a = o.attacker;
    if (hostile(a) && !parry.hit.has(a.id)) { parry.hit.add(a.id); counter(a); }
    return true;
  }

  /** Otomatik mod: savuşturma penceresi içinde bize bir darbe inecek mi? */
  function threatSoon(g, win) {
    const pl = g.player, pos = pl.group.position;
    let soon = false;
    EV.Enemies.forEachNear(pos.x, pos.z, 14, (e) => {
      if (!soon && hostile(e) && e.atkT > 0 && e.atkTarget === pl && e.atkT <= win) soon = true;
    });
    if (!soon) {
      const t = EV.Decal.threat(pos.x, pos.z, pl.radius * 0.8);
      if (t && t.windup - t.t <= win) soon = true;
    }
    return soon;
  }

  /* =========================================================
     PUSU (stealth)
     ========================================================= */
  function camo(group) {
    const list = [];
    group.traverse((o) => {
      if (!o.isMesh || !o.material || o.isSprite || Array.isArray(o.material)) return;
      const m = o.material;
      list.push([m, m.opacity, m.transparent]);
      m.transparent = true;
      m.opacity = Math.min(m.opacity, 0.2);
    });
    return list;
  }
  function uncamo(list) { list.forEach(([m, op, tr]) => { m.opacity = op; m.transparent = tr; }); }

  function castStealth(def, p, c) {
    const pl = PL(), pos = pl.group.position;
    if (c.echo) {
      const e = c.target;
      if (!hostile(e)) return echoBurst(c, 2.5, p.mul * 0.6, p.st, true);
      EV.Combat.hitEnemy(game, e, c.base * p.mul, { source: c.src, st: p.st, pow: c.pow, forceCrit: true, knock: 6, from: pos });
      EV.FX.slash(e.group.position, yawTo(e.group.position.x, e.group.position.z), 3, 1.6, c.color);
      return true;
    }
    endStealth();
    stealth = { id: def.id, p, c, t: p.dur, mats: camo(pl.group), group: pl.group };
    if (p.speed) game.addBuff({ id: 'stealth', t: p.dur, mods: { speed: p.speed } });
    EV.Enemies.forEachNear(pos.x, pos.z, 45, (e) => { if (hostile(e) && surf(e) > 4 && !isBoss(e)) e.aggroT = 0; });
    EV.FX.ring(pos, c.color, 3.5, 0.5);
    EV.FX.burst(chestOf(pl.group), c.color, 10, 4);
    U.audio.blip(500, 0.3, 'sine', 0.04, 200);
    hint('stealth', '🦎 Gizlendin — <b>ilk saldırın PUSU</b> (atılır, kritik, sersemletir)');
    return true;
  }

  function endStealth() {
    if (!stealth) return;
    uncamo(stealth.mats);
    stealth = null;
    killBuff('stealth');
  }

  function updStealth(dt) {
    stealth.t -= dt;
    const pl = PL();
    if (stealth.group !== pl.group) { uncamo(stealth.mats); stealth.mats = camo(pl.group); stealth.group = pl.group; }
    if (stealth.t <= 0 || !pl.alive) { endStealth(); if (pl.alive) floatPlayer('görünür oldun', '#cfc6b8'); }
  }

  /** Gizliyken temel saldırı: avın üstüne atılan pusu. */
  function pounce() {
    const st = stealth, p = st.p;
    endStealth();
    const pl = PL(), pos = pl.group.position;
    const reach = p.pounce;
    const ok = (e) => hostile(e) && !e.held && surf(e) <= reach;
    let e = [pl.lockTarget, pl.hover].find(ok) || null;
    if (!e) {
      e = EV.Enemies.nearest(pos.x, pos.z, reach, (o) => ok(o) &&
        Math.abs(U.wrapAngle(yawTo(o.group.position.x, o.group.position.z) - pl.aimYaw)) < 1.1);
    }
    if (!e) return null;
    const strike = () => {
      if (!e.alive || !pl.alive) return;
      const yaw = yawTo(e.group.position.x, e.group.position.z);
      pl.aimYaw = yaw;
      pl.group.rotation.y = yaw;
      EV.FX.slash(pl.group.position, yaw, 3.8, 2.0, st.c.color);
      EV.Creature.attack(pl.group, 0.25);
      EV.Combat.hitEnemy(game, e, pl.stats.dmg * p.mul, {
        source: 'player', basic: true, forceCrit: true, st: p.st, pow: pl.stats.dmg * pl.stats.statusPower, knock: 8, from: pl.group.position,
      });
      floatAt(e, 'PUSU!', '#9de89d');
      pl.lastCombatT = game.time;
    };
    const d = surf(e);
    if (d > 2) {
      const ep = e.group.position;
      const l = Math.max(0.01, Math.hypot(ep.x - pos.x, ep.z - pos.z));
      const go = Math.max(0, d - 0.8);
      const dest = { x: pos.x + (ep.x - pos.x) / l * go, z: pos.z + (ep.z - pos.z) / l * go };
      EV.World.clampToPlay(dest);
      const dur = 0.2 + d * 0.012;
      pl.leap = { fx: pos.x, fz: pos.z, tx: dest.x, tz: dest.z, t: 0, dur, h: 1 + d * 0.08, onLand: strike };
      pl.iframe = Math.max(pl.iframe, dur + 0.05);
    } else strike();
    return { skip: true, cd: 0.45 };
  }

  /* =========================================================
     KAZI (burrow)
     ========================================================= */
  function castBurrow(def, p, c) {
    if (c.echo) return echoBurst(c, p.r, p.dmg * 1.2, p.st);
    const pl = PL(), pos = pl.group.position;
    endStealth();
    burrow = { id: def.id, def, p, c, t: 0, depth: 0, fxT: 0, ref: c.slotRef };
    pl.iframe = Math.max(pl.iframe, 0.3);
    const g = groundAt(pos.x, pos.z);
    EV.FX.ring(g, c.color, 2.5, 0.4);
    EV.FX.burst(g.setY(g.y + 0.3), c.color, 12, 6);
    U.audio.blip(160, 0.3, 'sawtooth', 0.05, 60);
    slotGlow(def.id, c.color);
    hint('burrow', '🕳️ Toprak altındasın — <b>tekrar bas ya da saldır: FIRLA</b>', '#e6c07a');
    return true;
  }

  function updBurrow(dt) {
    const pl = PL(), b = burrow, pos = pl.group.position;
    if (!pl.alive) { endBurrow(); return; }
    b.t += dt;
    b.depth = Math.min(1, b.depth + dt / 0.2);
    pl.leapY = -1.8 * b.depth * Math.sqrt(pl.sizeScale || 1);
    pl.iframe = Math.max(pl.iframe, 0.12);
    game.addBuff({ id: 'burrow', t: 0.2, mods: { speed: b.p.speed || 0 } });
    b.fxT -= dt;
    if (b.fxT <= 0) {
      b.fxT = pl.moving ? 0.05 : 0.16;
      EV.FX.burst(groundAt(pos.x, pos.z).setY(EV.World.groundY(pos.x, pos.z) + 0.2), b.c.color, 2, 3);
    }
    if (b.t >= b.p.dur) emerge();
  }

  function endBurrow() {
    if (!burrow) return;
    const pl = PL();
    if (pl) pl.leapY = 0;
    slotGlow(burrow.id, null);
    burrow = null;
    killBuff('burrow');
  }

  /** Yüzeye fırla: altındakileri havaya savurur; toprak altında geçen süreyle güçlenir. */
  function emerge() {
    const b = burrow;
    if (!b) return;
    endBurrow();
    const pl = PL(), pos = pl.group.position, p = b.p;
    const power = 1 + Math.min((p.grow || 0) * b.t, p.growMax || 0);
    const r = p.r * pl.stats.area;
    const g = groundAt(pos.x, pos.z);
    EV.Combat.hitArea(game, g.x, g.z, r, b.c.base * p.dmg * power, { source: b.c.src, st: p.st, pow: b.c.pow, knock: p.knock, from: g });
    EV.FX.ring(g, b.c.color, r, 0.45);
    EV.FX.ring(g, 0xffffff, r * 0.6, 0.3);
    EV.FX.burst(g.clone().setY(g.y + 0.5), b.c.color, 18, 10);
    if (power > 1.05) floatPlayer('FIRLA ×' + power.toFixed(1), '#e6c07a');
    pl.leap = { fx: pos.x, fz: pos.z, tx: pos.x, tz: pos.z, t: 0, dur: 0.3, h: 1.4, onLand: () => {} };
    pl.iframe = Math.max(pl.iframe, 0.35);
    finish(b.ref, p);
    U.audio.roar();
  }

  /* =========================================================
     DURUŞ / DÖNÜŞÜM (stance)
     ========================================================= */
  function glowOff(pl) {
    EV.Creature.setGlow(pl.group, null);
    const m = pl.group.userData.mats;
    if (m && m.solid && m.solid.emissive) m.solid.emissive.setRGB(0, 0, 0);
  }

  function castStance(def, p, c) {
    if (c.echo) return echoBurst(c, 3, p.echoDmg || 1.2, (p.basic && p.basic.st) || []);
    const pl = PL();
    if (stance) stanceOff('replace');
    const timed = def.slot === 'ult';
    stance = { id: def.id, def, p, c, left: p.dur, timed, fxT: 0, ref: timed ? null : c.slotRef, glow: colorRgb(c.color, 0.35) };
    EV.Creature.setGlow(pl.group, stance.glow);
    EV.FX.ring(pl.group.position, c.color, 5, 0.5);
    EV.FX.burst(chestOf(pl.group), c.color, 14, 7);
    U.audio.roar();
    if (!timed) {
      slotGlow(def.id, c.color);
      hint('stance', def.icon + ' Duruş açık: temel saldırın değişti, enerji yakar — <b>tekrar bas: kapat</b>', '#ffd23d');
    } else hint('form', def.icon + ' ' + def.name + ': temel saldırın dönüştü!', '#ff8a5a');
    return true;
  }

  function stanceOff(why) {
    const s = stance;
    if (!s) return;
    stance = null;
    const pl = PL();
    killBuff('stance:' + s.id);
    if (pl && pl.group) glowOff(pl);
    if (!s.timed) { finish(s.ref, s.p); slotGlow(s.id, null); }
    if (why === 'energy') game.toast('Enerji bitti — duruş kapandı', '#8fd0ff', 900);
    if (pl && pl.alive) EV.FX.ring(pl.group.position, s.c.color, 3, 0.3);
  }

  function updStance(dt) {
    const s = stance, pl = PL();
    if (!pl.alive) { stanceOff('dead'); return; }
    s.left -= dt;
    if (s.p.mods) game.addBuff({ id: 'stance:' + s.id, t: 0.2, mods: s.p.mods });
    if (!s.timed) {
      pl.energy -= s.p.drain * dt;
      if (pl.energy <= 0) { pl.energy = 0; stanceOff('energy'); return; }
    }
    EV.Creature.setGlow(pl.group, s.glow);
    s.fxT -= dt;
    if (s.fxT <= 0) { s.fxT = 0.3; EV.FX.burst(chestOf(pl.group), s.c.color, 2, 3); }
    if (s.left <= 0) stanceOff('time');
  }

  /* =========================================================
     HÜCUM (rush) — updateMotion'dan sürülür
     ========================================================= */
  function castRush(def, p, c) {
    if (c.echo) return echoBurst(c, p.r, p.dmg * 0.8, p.st);
    const pl = PL(), pos = pl.group.position;
    const tp = c.target ? c.target.group.position : c.point;
    const yaw = Math.hypot(tp.x - pos.x, tp.z - pos.z) > 0.5 ? yawTo(tp.x, tp.z) : pl.group.rotation.y;
    rush = { id: def.id, p, c, v: p.v0, t: 0, yaw, hit: new Set(), fxT: 0 };
    pl.aimYaw = yaw;
    pl.group.rotation.y = yaw;
    pl.iframe = Math.max(pl.iframe, 0.15);
    pl.dash = null;
    EV.FX.burst(groundAt(pos.x, pos.z).setY(pos.y + 0.4), c.color, 8, 5);
    U.audio.blip(120, 0.35, 'sawtooth', 0.06, 240);
    hint('rush', '🦬 Basılı tut: hızlan · <b>nişanla yönlendir</b> · bırak: DARBE', '#ffb35a');
    return true;
  }

  function motion(g, dt) {
    game = g;
    const pl = g.player;
    if (holds.some((h) => h.roll && !h.done)) { pl.vel.set(0, 0, 0); return true; }   // ölüm yuvarlanışında kilitli
    if (!rush) return false;
    const r = rush, p = r.p, pos = pl.group.position;
    if (!pl.alive || EV.Status.stunned(pl)) { rush = null; killBuff('rush'); return false; }
    r.t += dt;
    let tx = null, tz = null;
    if (r.c.hold) { tx = pl.aimPoint.x; tz = pl.aimPoint.z; } else if (r.c.target && r.c.target.alive) { tx = r.c.target.group.position.x; tz = r.c.target.group.position.z; }
    if (tx != null && (tx - pos.x) * (tx - pos.x) + (tz - pos.z) * (tz - pos.z) > 4) r.yaw = U.approachAngle(r.yaw, Math.atan2(tx - pos.x, tz - pos.z), p.turn * dt);
    r.v = Math.min(p.vmax, r.v + p.accel * dt);
    const dx = Math.sin(r.yaw), dz = Math.cos(r.yaw);
    const step = r.v * dt;
    const bx = pos.x + dx * step, bz = pos.z + dz * step;
    pos.x = bx; pos.z = bz;
    EV.World.resolveCollision(pos, pl.radius);
    pl.aimYaw = r.yaw;
    pl.group.rotation.y = r.yaw;
    pl.faceT = Math.max(pl.faceT, 0.2);
    g.addBuff({ id: 'rush', t: 0.2, mods: { armor: p.armor || 0 } });
    const k = r.v / p.vmax;
    const w = p.width * Math.sqrt(pl.stats.area);
    let ram = null;
    EV.Enemies.forEachNear(pos.x, pos.z, w + 6, (e) => {
      if (ram || !hostile(e) || e.held || r.hit.has(e.id)) return;
      if (EV.Creature.surfDist(e.group, pos.x, pos.z) > w) return;
      if (isBoss(e) || e.radius > pl.radius * 1.8) { ram = e; return; }
      r.hit.add(e.id);
      const ex = e.group.position.x - pos.x, ez = e.group.position.z - pos.z;
      const side = ex * dz - ez * dx >= 0 ? 1 : -1;                // sağdakini sağa, soldakini sola savur
      const from = { x: pos.x - dz * side * 3 - dx, z: pos.z + dx * side * 3 - dz };
      EV.Combat.hitEnemy(g, e, r.c.base * p.trample * Math.max(0.35, k), { source: r.c.src, st: p.st, pow: r.c.pow, knock: 6 + 10 * k, from });
    });
    r.fxT -= dt;
    if (r.fxT <= 0) { r.fxT = 0.05; EV.FX.burst(groundAt(pos.x - dx, pos.z - dz).setY(pos.y + 0.3), r.c.color, 2, 3 + 3 * k); }
    const crash = Math.hypot(pos.x - bx, pos.z - bz) > step * 0.5 && r.t > 0.1;
    let go = r.t >= p.maxT || crash || !!ram;
    if (!go && r.t >= 0.12) go = r.c.hold ? !EV.Input.down(r.c.hold) : r.t >= (p.autoHold || 0.6);
    if (go) rushImpact(ram, crash);
    return true;
  }

  function rushImpact(ram, crash) {
    const r = rush;
    rush = null;
    killBuff('rush');
    const pl = PL(), pos = pl.group.position, p = r.p;
    const k = Math.max(0.3, r.v / p.vmax);
    const dx = Math.sin(r.yaw), dz = Math.cos(r.yaw);
    const fx = pos.x + dx * (pl.radius + 1), fz = pos.z + dz * (pl.radius + 1);
    const g = groundAt(fx, fz);
    const dmg = r.c.base * p.dmg * k;
    const R = p.r * Math.sqrt(pl.stats.area);
    const o = { source: r.c.src, st: p.st, pow: r.c.pow, knock: p.knock * k, from: pos };
    if (ram) EV.Combat.hitEnemy(game, ram, dmg * 1.5, o);
    areaHit(g.x, g.z, R, dmg, o, ram);
    EV.FX.ring(g, r.c.color, R, 0.4);
    EV.FX.burst(g.clone().setY(g.y + 0.6), r.c.color, 10 + Math.round(10 * k), 6 + 6 * k);
    EV.FX.slash(pos, r.yaw, R + 1, 1.6, r.c.color);
    EV.Creature.attack(pl.group, 0.25);
    floatPlayer((ram ? 'TOSLAMA ' : '') + 'HIZ %' + Math.round(k * 100), '#ffb35a');
    if (crash || ram) pl.impulse.set(-dx * 5, 0, -dz * 5);
    else pl.impulse.set(dx * r.v * 0.25, 0, dz * r.v * 0.25);
    pl.iframe = Math.max(pl.iframe, 0.15);
    U.audio.roar();
  }

  /* =========================================================
     BASILI TUT → BIRAK (charge)
     ========================================================= */
  function castCharge(def, p, c) {
    if (c.echo) return echoBurst(c, p.shape === 'nova' ? p.r * 0.6 : 2.5, p.dmg * 0.7, p.st);
    if (charge) { drop(charge.ring); charge = null; }
    const pl = PL();
    const tp = c.target ? c.target.group.position : c.point;
    charge = {
      id: def.id, p, c, t: 0, full: false, yaw: yawTo(tp.x, tp.z),
      ring: mesh(p.shape === 'nova' ? GEO.ring : arcGeo(p.angle || 0.8), c.color, 0.3),
    };
    pl.aimYaw = charge.yaw;
    U.audio.blip(200, 0.25, 'triangle', 0.04, 420);
    hint('charge', '⏳ Basılı tut: güçlen · <b>bırak: saldır</b>', '#ffd23d');
    return true;
  }

  function updCharge(dt) {
    const ch = charge, p = ch.p, pl = PL(), pos = pl.group.position;
    if (!pl.alive || EV.Status.stunned(pl)) { drop(ch.ring); charge = null; killBuff('charge'); return; }
    ch.t += dt;
    const k = U.clamp(ch.t / p.full, 0, 1);
    if (k >= 1 && !ch.full) {
      ch.full = true;
      U.audio.blip(880, 0.08, 'triangle', 0.05);
      EV.FX.burst(chestOf(pl.group), ch.c.color, 8, 4);
    }
    game.addBuff({ id: 'charge', t: 0.2, mods: { speed: -(p.selfSlow || 0) } });
    if (ch.c.hold) ch.yaw = yawTo(pl.aimPoint.x, pl.aimPoint.z);
    else if (ch.c.target && ch.c.target.alive) ch.yaw = yawTo(ch.c.target.group.position.x, ch.c.target.group.position.z);
    if (p.shape !== 'nova') { pl.aimYaw = ch.yaw; pl.faceT = Math.max(pl.faceT, 0.15); }
    const reach = p.shape === 'nova' ? p.r * pl.stats.area * U.lerp(0.55, 1, k) : p.range + (p.lunge || 0) * k;
    ch.ring.position.set(pos.x, EV.World.groundY(pos.x, pos.z) + 0.3, pos.z);
    ch.ring.scale.set(reach, 1, reach);
    ch.ring.rotation.y = ch.yaw;
    ch.ring.material.opacity = ch.full ? 0.55 + 0.3 * Math.sin(game.time * 22) : 0.2 + 0.4 * k;
    let go = ch.t >= p.full + 1.5;
    if (!go && ch.t >= 0.05) go = ch.c.hold ? !EV.Input.down(ch.c.hold) : ch.t >= (p.autoHold || p.full);
    if (go) fireCharge(ch, k);
  }

  function fireCharge(ch, k) {
    charge = null;
    drop(ch.ring);
    killBuff('charge');
    const p = ch.p, c = ch.c, pl = PL(), S = pl.stats;
    const pw = U.lerp(p.min, 1, k);
    const st = (p.st || []).concat(k >= 1 && p.stFull ? p.stFull : []);
    if (p.shape === 'nova') {
      const ctr = pl.group.position.clone();
      const r = p.r * S.area * U.lerp(0.55, 1, k);
      EV.Combat.hitArea(game, ctr.x, ctr.z, r, c.base * p.dmg * pw, { source: c.src, st, pow: c.pow, knock: p.knock * pw, from: ctr });
      EV.FX.ring(ctr, c.color, r, 0.45);
      EV.FX.burst(ctr.clone().setY(ctr.y + 1), c.color, 8 + Math.round(10 * k), 6 + 5 * k);
      for (let i = 0; i < 3; i++) EV.FX.slash(ctr, i * 2.1 + game.time, r, 2.1, c.color);
      U.audio.roar();
    } else {
      const yaw = ch.yaw, dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      pl.aimYaw = yaw;
      pl.group.rotation.y = yaw;
      pl.faceT = Math.max(pl.faceT, 0.4);
      pl.impulse.addScaledVector(dir, (p.lunge || 0) * k * 4.5);
      later(0.1, () => {
        const c0 = pl.group.position;
        const range = p.range * (1 + (S.area - 1) * 0.5);
        const _c = { x: 0, z: 0 };
        EV.Enemies.forEachNear(c0.x, c0.z, range + 6, (e) => {
          if (!hostile(e) || EV.Creature.surfDist(e.group, c0.x, c0.z) > range) return;
          EV.Creature.closestPoint(e.group, c0.x, c0.z, _c);
          const ex = _c.x - c0.x, ez = _c.z - c0.z, d = Math.hypot(ex, ez);
          if (d > 1.2 && Math.abs(U.wrapAngle(Math.atan2(ex, ez) - yaw)) > p.angle / 2 + Math.atan2(e.radius, d)) return;
          EV.Combat.hitEnemy(game, e, c.base * p.dmg * pw, { source: c.src, st, pow: c.pow, knock: p.knock * pw, from: c0 });
        });
        EV.FX.slash(c0, yaw, range, p.angle, k >= 1 ? 0xffffff : c.color);
        EV.Creature.attack(pl.group, 0.25);
        (k >= 1 ? U.audio.crit : U.audio.hit)();
      });
    }
    if (k >= 1) floatPlayer('TAM GÜÇ', '#ffe08a');
  }

  /* =========================================================
     SÜRÜYE EMİR (command)
     ========================================================= */
  function castCommand(def, p, c) {
    const pl = PL(), S = pl.stats, pos = pl.group.position;
    const tg = pickPrey({ target: c.target, point: c.point }, 26);
    const fr = p.fearR * S.area;
    EV.Combat.hitArea(game, pos.x, pos.z, fr, c.base * p.dmg, { source: c.src, st: p.fear, pow: c.pow, knock: 3, from: pos });
    EV.FX.ring(pos, c.color, fr, 0.6);
    U.audio.roar();
    const pack = game.enemies.filter((e) => e.ally && e.alive && e.group.position.distanceTo(pos) <= p.r);
    if (!c.echo) {
      for (let i = pack.length; i < p.pack; i++) {
        const g = p.ghost;
        const e = EV.Enemies.spawnSummon(game, { dur: g.dur, hp: S.maxHp * g.hpFrac * S.summonPower, dmg: S.dmg * g.dmgFrac * S.summonPower });
        e.name = 'Hayalet ' + e.name;
        e.group.traverse((o) => { if (o.isMesh && o.material && !Array.isArray(o.material)) { o.material.transparent = true; o.material.opacity *= 0.6; } });
        pack.push(e);
      }
    }
    pack.forEach((a, i) => {
      a.dmg = a.baseDmg * p.buff;
      a.speed = a.baseSpeed * (p.spd || 1.3);
      a.buffT = p.dur;
      EV.FX.burst(chestOf(a.group), c.color, 4, 3);
      if (!tg) return;
      const ap = a.group.position, tp = tg.group.position;
      const dx = tp.x - ap.x, dz = tp.z - ap.z, l = Math.hypot(dx, dz) || 1;
      const go = Math.max(0, l - a.radius - tg.radius - 0.6);
      const v = Math.min(70, go / 0.28);
      a.lunge = { vx: dx / l * v, vz: dz / l * v, t: 0.28 };
      a.atkCd = Math.min(a.atkCd, 0.4);
      later(0.3 + i * 0.05, () => {
        if (!a.alive || !tg.alive) return;
        EV.FX.beam(chestOf(a.group), chestOf(tg.group), c.color);
        EV.Creature.attack(a.group, 0.25);
        EV.Combat.hitEnemy(game, tg, a.dmg * p.strike, { source: 'ally', knock: 3, from: a.group.position });
      });
    });
    if (tg) {
      (p.st || []).forEach(([id, n]) => EV.Status.apply(game, tg, id, n, c.pow, true));
      if (!c.echo) cmds.push({ e: tg, t: p.dur, m: mesh(GEO.halo, 0xff5a3d, 0.9) });
      floatAt(tg, 'AV!', '#ff8a5a');
    }
    if (!c.echo) hint('command', '🐺 Sürü ' + (tg ? tg.name + ' üstüne!' : 'güçlendi!'), '#ffb35a');
    return true;
  }

  function updCmd(m, dt) {
    m.t -= dt;
    if (m.t <= 0 || !m.e.alive) return true;
    const ep = m.e.group.position;
    m.m.position.set(ep.x, ep.y + m.e.group.userData.height + 1.1, ep.z);
    m.m.scale.setScalar(1.4 + 0.15 * Math.sin(game.time * 8));
    m.m.rotation.y += dt * 3;
    return false;
  }

  /* =========================================================
     Dış arayüz
     ========================================================= */
  function cast(g, def, rank, p, c) {
    game = g;
    switch (def.kind) {
      case 'grab': return castGrab(def, p, c);
      case 'engulf': return castEngulf(def, p, c);
      case 'tether': return castTether(def, p, c);
      case 'mark': return castMark(def, p, c);
      case 'parry': return castParry(def, p, c);
      case 'stealth': return castStealth(def, p, c);
      case 'burrow': return castBurrow(def, p, c);
      case 'stance': return castStance(def, p, c);
      case 'rush': return castRush(def, p, c);
      case 'charge': return castCharge(def, p, c);
      case 'command': return castCommand(def, p, c);
      default: return false;
    }
  }

  /** İki aşamalı yetenek ikinci basışı bekliyor mu? */
  function pending(g, def) {
    if (!def) return false;
    switch (def.kind) {
      case 'engulf': return holds.some((h) => h.id === def.id && h.kind === 'engulf' && !h.done);
      case 'mark': return markSets.some((m) => m.id === def.id && !m.done);
      case 'burrow': return !!burrow && burrow.id === def.id;
      case 'stance': return !!stance && stance.id === def.id && !stance.timed;
      default: return false;
    }
  }

  /** İkinci basış: tükür / patlat / fırla / kapat. Yakaladıysa true. */
  function recast(g, def) {
    game = g;
    if (!pending(g, def)) return false;
    switch (def.kind) {
      case 'engulf': spit(holds.find((h) => h.id === def.id && h.kind === 'engulf' && !h.done)); break;
      case 'mark': detonate(markSets.find((m) => m.id === def.id && !m.done), 1); break;
      case 'burrow': emerge(); break;
      case 'stance': stanceOff('toggle'); break;
      default: break;
    }
    return true;
  }

  /** Otomatik modda ikinci aşama ne zaman? */
  function autoRecast(g, def) {
    if (def.kind === 'mark') {
      const s = markSets.find((m) => m.id === def.id && !m.done);
      if (!s) return false;
      let top = 0;
      s.marks.forEach((mk) => { top = Math.max(top, mk.n); });
      return top >= 3 || s.left < 0.8;
    }
    if (def.kind === 'engulf') {
      const h = holds.find((x) => x.id === def.id && x.kind === 'engulf' && !x.done);
      return !!h && h.t >= h.p.digest * 0.75 && !!EV.Enemies.nearest(g.player.group.position.x, g.player.group.position.z, 12, (o) => hostile(o) && !o.held);
    }
    return false;
  }

  /** Başka bir yetenek atılmadan önce: toprak altındaysan çık. */
  function beforeCast(g, def) {
    game = g;
    if (burrow && def.id !== burrow.id) emerge();
  }

  /** Gizliyken atılan yetenek pusuyu bozar ama güçlenir. */
  function ambushSkill(g, def) {
    if (!stealth || def.kind === 'stealth') return 1;
    const m = stealth.p.skillMul || 1.3;
    endStealth();
    return m;
  }
  /** Gizliyken uzaktan atış: bozulur, kritik ve güçlü. */
  function ambushShot(g) {
    if (!stealth) return 1;
    endStealth();
    return 1.6;
  }

  /** Temel saldırı değişikliği. {skip} = saldırı yutuldu (pusu / fırlama / meşgul). */
  function basicMod(g) {
    game = g;
    if (burrow) { emerge(); return { skip: true, cd: 0.35 }; }
    if (busy(g)) return { skip: true, cd: 0.1 };
    if (stealth) return pounce();
    if (stance) return stance.p.basic || null;
    return null;
  }

  /** Şarj ya da ağızda av varken temel saldırı yapılamaz. */
  function busy() { return !!charge || holds.some((h) => h.kind === 'grab' && !h.done); }
  function hidden() { return !!stealth || !!burrow; }

  function onHurt() { if (stealth) { endStealth(); floatPlayer('gizlilik bozuldu', '#ffb35a'); } }

  function endAll() {
    endStealth();
    endBurrow();
    if (stance) stanceOff('dead');
    if (rush) { rush = null; killBuff('rush'); }
    if (charge) { drop(charge.ring); charge = null; killBuff('charge'); }
    if (parry) { drop(parry.m); parry = null; }
    holds.forEach((h) => { if (!h.done) { h.done = true; unseize(h.e); settle(h.e); if (h.kind === 'engulf') finish(h.ref, h.p); } });
    holds.length = 0;
  }

  function runList(list, fn, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      if (fn(list[i], dt)) list.splice(i, 1);
    }
  }

  function update(g, dt) {
    game = g;
    const pl = g.player;
    for (let i = timers.length - 1; i >= 0; i--) {
      timers[i].t -= dt;
      if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); }
    }
    runList(holds, (h, d) => {
      if (h.done) return true;
      h.t += d;
      if (!h.e.alive || !pl.alive) {
        h.done = true;
        unseize(h.e);
        if (h.kind === 'engulf') { finish(h.ref, h.p); slotGlow(h.id, null); }
        return true;
      }
      const end = h.kind === 'grab' ? updGrab(h, d) : updEngulf(h, d);
      if (end) h.done = true;
      return end;
    }, dt);
    runList(flights, updFlight, dt);
    runList(tethers, (t, d) => { const end = updTether(t, d); if (end) drop(t.m); return end; }, dt);
    runList(markSets, (s, d) => s.done || updMarks(s, d), dt);
    runList(cmds, (m, d) => { const end = updCmd(m, d); if (end) drop(m.m); return end; }, dt);
    if (parry) updParry(dt);
    if (stealth) updStealth(dt);
    if (burrow) updBurrow(dt);
    if (stance) updStance(dt);
    if (charge) updCharge(dt);
    if (!pl.alive) endAll();
    glowT -= dt;
    if (glowT <= 0 && glowIds.size) {            // yetenek çubuğu yeniden kurulduysa parlamayı geri koy
      glowT = 0.3;
      glowIds.forEach((col, id) => slotGlow(id, col));
    }
  }

  function clear() {
    const g = game || EV.Game;
    holds.forEach((h) => { unseize(h.e); if (h.e.alive) settle(h.e); });
    flights.forEach((f) => { unseize(f.e); if (f.e.alive) settle(f.e); });
    tethers.forEach((t) => drop(t.m));
    markSets.forEach((s) => s.marks.forEach((mk) => drop(mk.m)));
    cmds.forEach((m) => drop(m.m));
    if (parry) drop(parry.m);
    if (charge) drop(charge.ring);
    if (stealth) uncamo(stealth.mats);
    const pl = g && g.player;
    if (pl && pl.group) {
      if (burrow) pl.leapY = 0;
      if (stance) glowOff(pl);
      pl.buffs.forEach((b) => { if (OWN_BUFF.test(String(b.id))) b.t = 0; });
    }
    Array.from(glowIds.keys()).forEach((id) => slotGlow(id, null));
    holds.length = flights.length = tethers.length = markSets.length = cmds.length = timers.length = 0;
    parry = stance = stealth = burrow = rush = charge = null;
  }

  /* ---------------- hasar kancaları ---------------- */
  const baseHitPlayer = EV.Combat.hitPlayer;
  EV.Combat.hitPlayer = function (g, amount, o) {
    const oo = o || {};
    if (g && g.player && intercept(g, amount, oo)) return 0;
    const r = baseHitPlayer.apply(this, arguments);
    if (r > 0 && !oo.dot) onHurt();
    return r;
  };
  const baseHitEnemy = EV.Combat.hitEnemy;
  EV.Combat.hitEnemy = function (g, e, amount, o) {
    const r = baseHitEnemy.apply(this, arguments);
    if (r > 0 && markSets.length) onEnemyHit(e, o);
    return r;
  };
  const baseHitArea = EV.Combat.hitArea;
  EV.Combat.hitArea = function (g, x, z, r, amount, o) {
    if (!markSets.length) return baseHitArea.apply(this, arguments);
    let n = 0;                     // işaret varken her isabet sarmalanmış hitEnemy'den geçsin
    EV.Enemies.forEachNear(x, z, r + 6, (e) => {
      if (e.ally || e.peaceful) return;
      if (EV.Creature.surfDist(e.group, x, z) <= r) { EV.Combat.hitEnemy(g, e, amount, o); n++; }
    });
    return n;
  };

  return {
    cast, update, motion, clear, pending, recast, autoRecast, beforeCast, ambushSkill, ambushShot,
    basicMod, busy, hidden, threatSoon, SLOT_CODE,
    get state() { return { parry, stance, stealth, burrow, rush, charge, holds, flights, tethers, markSets, cmds }; },
    get counts() {
      return { holds: holds.length, flights: flights.length, tethers: tethers.length, marks: markSets.length, cmds: cmds.length,
        timers2: timers.length, parry: parry ? 1 : 0, stance: stance ? 1 : 0, stealth: stealth ? 1 : 0,
        burrow: burrow ? 1 : 0, rush: rush ? 1 : 0, charge: charge ? 1 : 0 };
    },
  };
})();
