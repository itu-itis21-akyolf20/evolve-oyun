/* ============================================================
   decals.js — yere çizilen alanlar

   1) UYARILAR (telegraph): boss ve özel yaratık saldırıları vurmadan
      önce yere kırmızı alan çizer; dolgu windup boyunca büyür, dolunca
      vuruş gerçekleşir. Öngörülebilir oynanış bunun üstüne kurulu.
   2) NİŞAN GÖSTERGESİ: basılı tutulan yer hedefli yeteneklerde
      menzil halkası + hedef dairesi (mavi).

   Şekiller araziye oturtulur (her vertex'in y'si arazi yüksekliği),
   yoksa yokuşta toprağın içinde kaybolurlardı.
   ============================================================ */
window.EV = window.EV || {};

EV.Decal = (function () {
  'use strict';

  const U = EV.U;
  const LIFT = 0.2;
  let scene = null;
  const teles = [];

  function init(sc) { scene = sc; }

  /* ---------------- geometri ---------------- */
  function makeGeo(shape, p) {
    let g;
    switch (shape) {
      case 'circle': g = new THREE.RingGeometry(0.001, p.r, 40, 6); break;
      case 'ring':   g = new THREE.RingGeometry(p.r2, p.r, 40, 3); break;
      case 'cone': {
        // RingGeometry XY düzleminde; rotateX sonrası θ=-π/2 yerel +Z'yi gösterir
        const a = p.angle;
        g = new THREE.RingGeometry(0.001, p.r, 20, 6, -Math.PI / 2 - a / 2, a);
        break;
      }
      case 'rect': {
        g = new THREE.PlaneGeometry(p.w, p.len, 2, Math.max(4, Math.ceil(p.len / 1.5)));
        g.translate(0, p.len / 2, 0);   // başlangıç noktası orijinde, +Z'ye uzanır
        break;
      }
      default: g = new THREE.RingGeometry(0.001, 1, 16, 2);
    }
    g.rotateX(-Math.PI / 2);
    if (shape === 'rect') g.scale(1, 1, -1);  // rotateX PlaneGeometry'nin +Y'sini -Z'ye çevirir; +Z'ye çevir
    return g;
  }

  function makeMesh(shape, p, color, opacity) {
    const geo = makeGeo(shape, p);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 5;
    m.userData.base = Float32Array.from(geo.attributes.position.array);
    return m;
  }

  /** Mesh'in vertex'lerini (sx,sz ölçekli) araziye oturtur. */
  function conform(m, sx, sz) {
    const pos = m.geometry.attributes.position;
    const base = m.userData.base;
    const yaw = m.rotation.y;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const px = m.position.x, pz = m.position.z;
    for (let i = 0; i < pos.count; i++) {
      const lx = base[i * 3] * sx, lz = base[i * 3 + 2] * sz;
      const wx = px + lx * c + lz * s;
      const wz = pz - lx * s + lz * c;
      pos.setXYZ(i, lx, EV.World.height(wx, wz) + LIFT, lz);
    }
    pos.needsUpdate = true;
    m.geometry.computeBoundingSphere();
  }

  function place(m, x, z, yaw) {
    m.position.set(x, 0, z);
    m.rotation.y = yaw || 0;
    scene.add(m);
  }

  function disposeMesh(m) {
    if (!m) return;
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  }

  /* =========================================================
     UYARILAR
     opts: { shape, x, z, yaw, r, r2, angle, w, len, windup,
             color, onFire(tele), owner, delay }
     ========================================================= */
  function tele(opts) {
    const color = opts.color == null ? 0xff3030 : opts.color;
    const t = {
      shape: opts.shape, x: opts.x, z: opts.z, yaw: opts.yaw || 0,
      p: { r: opts.r, r2: opts.r2, angle: opts.angle, w: opts.w, len: opts.len },
      windup: Math.max(0.15, opts.windup), t: -(opts.delay || 0),
      onFire: opts.onFire, owner: opts.owner || null,
      fired: false, flashT: 0, dead: false,
      outline: null, fill: null,
    };
    t.outline = makeMesh(t.shape, t.p, color, 0.34);
    t.fill = makeMesh(t.shape, t.p, color, 0.55);
    place(t.outline, t.x, t.z, t.yaw);
    place(t.fill, t.x, t.z, t.yaw);
    conform(t.outline, 1, 1);
    conform(t.fill, 0.01, 0.01);
    t.outline.visible = t.fill.visible = t.t >= 0;
    teles.push(t);
    return t;
  }

  /** Bir noktanın uyarı alanında olup olmadığı. pad: hedefin yarıçapı. */
  function contains(t, px, pz, pad) {
    pad = pad || 0;
    const dx = px - t.x, dz = pz - t.z;
    const d = Math.hypot(dx, dz);
    switch (t.shape) {
      case 'circle': return d <= t.p.r + pad;
      case 'ring': return d <= t.p.r + pad && d >= t.p.r2 - pad;
      case 'cone': {
        if (d > t.p.r + pad) return false;
        if (d < pad + 0.5) return true;
        const ang = Math.atan2(dx, dz);
        return Math.abs(U.wrapAngle(ang - t.yaw)) <= t.p.angle / 2 + Math.atan2(pad, d);
      }
      case 'rect': {
        const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
        const lx = dx * c - dz * s;          // yerel x (dünya->yerel ters dönüş)
        const lz = dx * s + dz * c;          // yerel z (ileri)
        return Math.abs(lx) <= t.p.w / 2 + pad && lz >= -pad && lz <= t.p.len + pad;
      }
      default: return false;
    }
  }

  function removeTele(i) {
    const t = teles[i];
    disposeMesh(t.outline);
    disposeMesh(t.fill);
    teles.splice(i, 1);
  }

  function update(dt) {
    for (let i = teles.length - 1; i >= 0; i--) {
      const t = teles[i];
      if (t.dead) { removeTele(i); continue; }
      t.t += dt;
      if (t.t < 0) continue;
      t.outline.visible = t.fill.visible = true;

      if (!t.fired) {
        const k = U.clamp(t.t / t.windup, 0.01, 1);
        if (t.shape === 'rect') conform(t.fill, 1, k);
        else conform(t.fill, k, k);
        if (k >= 1) {
          t.fired = true;
          t.flashT = 0.14;
          t.fill.material.opacity = 0.85;
          if (t.onFire) {
            try { t.onFire(t); } catch (e) { console.error('Uyarı tetiklenemedi:', e); }
          }
        }
      } else {
        t.flashT -= dt;
        if (t.flashT <= 0) removeTele(i);
      }
    }
  }

  /** Sahibi ölen/iptal edilen uyarıları sessizce kaldırır. */
  function cancelOwner(owner) {
    for (let i = 0; i < teles.length; i++) if (teles[i].owner === owner && !teles[i].fired) teles[i].dead = true;
  }

  function clear() { for (let i = teles.length - 1; i >= 0; i--) removeTele(i); }

  /** Nokta henüz vurmamış bir uyarının içinde mi? (otomatik oyuncu kaçınması için) */
  function threat(px, pz, pad) {
    for (let i = 0; i < teles.length; i++) {
      const t = teles[i];
      if (!t.fired && t.t >= 0 && !t.dead && contains(t, px, pz, pad)) return t;
    }
    return null;
  }

  /* =========================================================
     NİŞAN GÖSTERGESİ (oyuncu)
     ========================================================= */
  const ind = { range: null, area: null, key: '' };

  function showIndicator(cx, cz, range, tx, tz, r, color) {
    const key = range.toFixed(1) + '|' + r.toFixed(2);
    if (ind.key !== key) {
      hideIndicator();
      ind.range = makeMesh('ring', { r: range, r2: range - 0.45 }, 0x7fd9ff, 0.6);
      ind.area = makeMesh('circle', { r }, color || 0x7fd9ff, 0.42);
      scene.add(ind.range);
      scene.add(ind.area);
      ind.key = key;
    }
    ind.range.position.set(cx, 0, cz);
    ind.area.position.set(tx, 0, tz);
    conform(ind.range, 1, 1);
    conform(ind.area, 1, 1);
  }

  function hideIndicator() {
    disposeMesh(ind.range);
    disposeMesh(ind.area);
    ind.range = ind.area = null;
    ind.key = '';
  }

  /* =========================================================
     KALICI ALAN (oyuncunun zone yetenekleri için)
     ========================================================= */
  function zoneMesh(x, z, r, color) {
    const m = makeMesh('circle', { r }, color, 0.3);
    place(m, x, z, 0);
    conform(m, 1, 1);
    return {
      mesh: m,
      move(nx, nz) { m.position.x = nx; m.position.z = nz; conform(m, 1, 1); },
      pulse(o) { m.material.opacity = o; },
      dispose() { disposeMesh(m); },
    };
  }

  return { init, tele, contains, threat, update, cancelOwner, clear, showIndicator, hideIndicator, zoneMesh, get count() { return teles.length; } };
})();
