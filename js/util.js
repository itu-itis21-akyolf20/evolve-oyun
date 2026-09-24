/* ============================================================
   util.js — matematik, rastgelelik, ses, geometri birleştirme
   ============================================================ */
window.EV = window.EV || {};

// Test modu: link ?test ile açılır (devtools.js). Kayıt ayrı, liderliğe/buluta gönderim yok.
EV.TEST = /(^|[?&#])test(?![a-z0-9])/i.test(location.search + location.hash);

EV.U = (function () {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const wrapAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  const approachAngle = (cur, target, maxStep) => {
    const d = wrapAngle(target - cur);
    return cur + clamp(d, -maxStep, maxStep);
  };

  const hash2 = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  const fmt = (n) => {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
    if (n >= 1e4) return Math.floor(n / 1e3) + 'K';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
    return String(n);
  };

  const pct = (v) => Math.round(v * 100) + '%';

  /** Ağırlıklı tek seçim. w(x) <= 0 olanlar seçilmez. */
  function weightedPick(arr, w) {
    let total = 0;
    for (let i = 0; i < arr.length; i++) total += Math.max(0, w(arr[i]));
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= Math.max(0, w(arr[i]));
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  }

  /** Ağırlıklı, tekrarsız n seçim. */
  function sampleWeighted(arr, n, w) {
    const pool = arr.slice();
    const out = [];
    while (out.length < n && pool.length) {
      const it = weightedPick(pool, w);
      if (!it) break;
      out.push(it);
      pool.splice(pool.indexOf(it), 1);
    }
    return out;
  }

  /** Noktanın doğru parçasına (XZ düzleminde) kare uzaklığı. */
  function segDist2(ax, az, bx, bz, px, pz) {
    const vx = bx - ax, vz = bz - az;
    const wx = px - ax, wz = pz - az;
    const l2 = vx * vx + vz * vz;
    let t = l2 > 1e-9 ? (wx * vx + wz * vz) / l2 : 0;
    t = clamp(t, 0, 1);
    const dx = ax + vx * t - px, dz = az + vz * t - pz;
    return dx * dx + dz * dz;
  }

  /* ---------------- ses: dosyasız, WebAudio ---------------- */
  let ac = null;
  let lastBlip = 0;
  const audio = {
    enabled: true,
    ensure() {
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { audio.enabled = false; }
      }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac;
    },
    blip(freq, dur, type, gain, slideTo) {
      if (!audio.enabled || !ac) return;
      // çok sayıda yaratık aynı karede ses çıkarınca kulak tırmalamasın
      const now = ac.currentTime;
      if (now - lastBlip < 0.012) return;
      lastBlip = now;
      try {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, now);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(gain == null ? 0.06 : gain, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g);
        g.connect(ac.destination);
        o.start();
        o.stop(now + dur + 0.02);
      } catch (e) { /* ses kritik değil */ }
    },
    hit() { audio.blip(220, 0.08, 'square', 0.035, 90); },
    crit() { audio.blip(520, 0.14, 'sawtooth', 0.05, 140); },
    hurt() { audio.blip(150, 0.18, 'sawtooth', 0.06, 60); },
    eat() { audio.blip(660, 0.07, 'sine', 0.035, 900); },
    levelUp() { [520, 660, 880].forEach((f, i) => setTimeout(() => audio.blip(f, 0.16, 'triangle', 0.06), i * 90)); },
    evolve() { [330, 440, 550, 660, 880].forEach((f, i) => setTimeout(() => audio.blip(f, 0.3, 'triangle', 0.07), i * 130)); },
    shoot() { audio.blip(420, 0.08, 'triangle', 0.035, 180); },
    roar() { audio.blip(110, 0.45, 'sawtooth', 0.08, 55); },
    die() { audio.blip(300, 0.3, 'square', 0.04, 40); },
    tele() { audio.blip(880, 0.12, 'sine', 0.035, 440); },
    react() { audio.blip(740, 0.22, 'triangle', 0.06, 1480); },
    ult() { [220, 330, 440, 660].forEach((f, i) => setTimeout(() => audio.blip(f, 0.25, 'sawtooth', 0.06), i * 60)); },
    card() { audio.blip(700, 0.12, 'triangle', 0.05, 1000); },
  };

  return {
    clamp, lerp, rand, randInt, pick, wrapAngle, approachAngle, hash2, fmt, pct,
    weightedPick, sampleWeighted, segDist2, audio,
  };
})();

/* ============================================================
   EV.Geo — çok sayıda küçük parçayı tek geometride birleştirir.
   Renk vertex'e yazılır; tek materyal = tek çizim çağrısı.
   Dünya dekoru ve yaratık gövdeleri bunu kullanır.
   ============================================================ */
EV.Geo = (function () {
  'use strict';

  function Collector() {
    this.pieces = [];
    this.verts = 0;
  }

  Collector.prototype.add = function (geo, matrix, color) {
    let g = geo;
    if (geo.index) {
      g = geo.toNonIndexed();
      geo.dispose();
    }
    this.pieces.push({ geo: g, matrix, color });
    this.verts += g.attributes.position.count;
  };

  Collector.prototype.bake = function () {
    if (!this.verts) return null;
    const pos = new Float32Array(this.verts * 3);
    const nor = new Float32Array(this.verts * 3);
    const col = new Float32Array(this.verts * 3);
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    const c = new THREE.Color();
    let o = 0;

    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      const gp = p.geo.attributes.position;
      const gn = p.geo.attributes.normal;
      nm.getNormalMatrix(p.matrix);
      c.setHex(p.color);
      for (let k = 0; k < gp.count; k++) {
        v.fromBufferAttribute(gp, k).applyMatrix4(p.matrix);
        pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
        if (gn) {
          n.fromBufferAttribute(gn, k).applyMatrix3(nm).normalize();
          nor[o] = n.x; nor[o + 1] = n.y; nor[o + 2] = n.z;
        }
        col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
        o += 3;
      }
      p.geo.dispose();
    }

    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    this.pieces.length = 0;
    this.verts = 0;
    return out;
  };

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();

  /** Konum/dönüş/ölçekten dönüşüm matrisi. */
  function xform(px, py, pz, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0);
    _q.setFromEuler(_e);
    _p.set(px, py, pz);
    _s.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz);
    return new THREE.Matrix4().compose(_p, _q, _s);
  }

  return { Collector, xform };
})();
