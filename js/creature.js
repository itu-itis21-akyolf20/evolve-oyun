/* ============================================================
   creature.js — prosedürel yaratık inşası

   Her hareketli parça (gövde, baş, her bacak, her kuyruk boğumu)
   tek geometriye birleştirilir ve yaratığın TEK materyalini paylaşır:
   30+ yaratık sahnede olsa bile çizim çağrısı makul kalır.

   Hitbox: gövde boyunca uzanan kapsül (userData.cap). Büyük bossların
   başı merkezden metrelerce öndedir; eski tek-yarıçaplı hitbox yüzünden
   yakın dövüş bossa ulaşmıyordu.

   spec.extras: taşınan vücut parçaları (data/genes.js 'visual' alanı).
   İleri yön = +Z.
   ============================================================ */
window.EV = window.EV || {};

EV.Creature = (function () {
  'use strict';

  const U = EV.U;
  const G = EV.Geo;

  function Parts() { this.solid = new G.Collector(); this.glow = new G.Collector(); }

  const box = (c, w, h, d, color, x, y, z, rx, ry, rz) =>
    c.add(new THREE.BoxGeometry(w, h, d), G.xform(x, y, z, rx, ry, rz), color);
  const ico = (c, r, det, color, x, y, z, sx, sy, sz, rx, ry, rz) =>
    c.add(new THREE.IcosahedronGeometry(r, det), G.xform(x, y, z, rx, ry, rz, sx, sy, sz), color);
  const cone = (c, r, h, seg, color, x, y, z, rx, ry, rz) =>
    c.add(new THREE.ConeGeometry(r, h, seg), G.xform(x, y, z, rx, ry, rz), color);

  function bake(group, parts, mats) {
    const s = parts.solid.bake();
    if (s) group.add(new THREE.Mesh(s, mats.solid));
    const g = parts.glow.bake();
    if (g) group.add(new THREE.Mesh(g, mats.glow));
  }

  function makeMats() {
    return {
      solid: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0x000000 }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    };
  }

  const has = (spec, id) => (spec.extras || []).indexOf(id) >= 0;

  function lighten(hex, amt) {
    const c = new THREE.Color(hex);
    c.offsetHSL(0, -0.1, amt);
    return c.getHex();
  }

  /* ---------------------------------------------------------
     Taşınan parçalar — gövde (body) ve baş (head) üzerine.
     ctx: { body: Parts, head: Parts, S, topY, len, wid, headTop, headZ }
     --------------------------------------------------------- */
  function addExtras(spec, ctx) {
    const S = ctx.S, b = ctx.body, h = ctx.head;
    const top = ctx.topY, L = ctx.len, W = ctx.wid;

    if (has(spec, 'sacs')) {
      [-1, 1].forEach((s) => ico(b.glow, 0.28 * S, 0, 0x7dff5a, s * W * 0.42, top - 0.05 * S, -L * 0.12, 1, 1.2, 1));
      ico(b.glow, 0.22 * S, 0, 0x7dff5a, 0, top + 0.1 * S, -L * 0.3);
    }
    if (has(spec, 'stripes')) {
      [-1, 1].forEach((s) => box(b.glow, 0.06 * S, 0.08 * S, L * 0.8, 0x6fe8ff, s * W * 0.52, top - 0.35 * S, 0));
    }
    if (has(spec, 'glands')) {
      [-1, 1].forEach((s) => ico(h.glow, 0.14 * S, 0, 0xfff05a, s * 0.34 * S, -0.05 * S, ctx.headZ * 0.6));
    }
    if (has(spec, 'spikes') && !ctx.hasSpikes) {
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        box(b.solid, 0.12 * S, 0.5 * S * (1 - Math.abs(t - 0.5)), 0.18 * S, spec.accent, 0, top + 0.18 * S, (t - 0.5) * L * 0.85, -0.2);
      }
    }
    if (has(spec, 'bumps')) {
      for (let i = 0; i < 8; i++) {
        ico(b.solid, 0.12 * S, 0, lighten(spec.body, 0.12), U.rand(-0.45, 0.45) * W, top - U.rand(0, 0.25) * S, U.rand(-0.45, 0.45) * L);
      }
    }
    if (has(spec, 'buds')) {
      [-1, 1].forEach((s) => {
        ico(b.solid, 0.2 * S, 0, spec.belly, s * W * 0.55, top - 0.3 * S, L * 0.15);
        ico(b.solid, 0.15 * S, 0, spec.belly, s * W * 0.5, top - 0.4 * S, -L * 0.2);
      });
    }
    if (has(spec, 'crest')) {
      box(h.solid, 0.08 * S, 0.45 * S, 0.7 * S, lighten(spec.accent, 0.15), 0, ctx.headTop + 0.15 * S, ctx.headZ * 0.3);
    }
    if (has(spec, 'plates')) {
      for (let i = 0; i < 4; i++) {
        box(b.solid, W * 0.7, 0.1 * S, 0.34 * S, 0xe8dcc0, 0, top + 0.04 * S, (i / 3 - 0.5) * L * 0.8, 0.12);
      }
    }
    if (has(spec, 'sunCrest')) {
      for (let i = 0; i < 3; i++) box(h.glow, 0.07 * S, (0.35 - i * 0.08) * S, 0.14 * S, 0xffae3d, 0, ctx.headTop + 0.18 * S, ctx.headZ * 0.2 - i * 0.18 * S, -0.3);
    }
    if (has(spec, 'frills')) {
      [-1, 1].forEach((s) => box(h.solid, 0.06 * S, 0.5 * S, 0.5 * S, 0xd9b26a, s * 0.55 * S, ctx.headTop - 0.2 * S, 0, 0, 0, s * 0.5));
    }
    if (has(spec, 'horns') && !ctx.hasHorns) {
      [-1, 1].forEach((s) => cone(h.solid, 0.13 * S, 0.7 * S, 5, 0xe8dcc0, s * 0.35 * S, ctx.headTop + 0.25 * S, ctx.headZ * 0.3, -0.25, 0, -s * 0.42));
    }
    if (has(spec, 'scutes')) {
      for (let i = 0; i < 6; i++) box(b.solid, W * 0.5, 0.07 * S, 0.2 * S, 0x6fae8a, 0, top + 0.02 * S, (i / 5 - 0.5) * L * 0.9);
    }
    if (has(spec, 'redStripes')) {
      for (let i = 0; i < 3; i++) box(b.solid, W * 1.02, 0.08 * S, 0.1 * S, 0xb0202e, 0, top - 0.2 * S, (i / 2 - 0.5) * L * 0.6);
    }
    if (has(spec, 'mane')) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * 2.4;
        box(b.solid, 0.3 * S, 0.35 * S, 0.25 * S, spec.accent, Math.sin(a) * W * 0.55, top - 0.05 * S + Math.cos(a) * 0.12 * S, L * 0.38);
      }
    }
    if (has(spec, 'tusks')) {
      [-1, 1].forEach((s) => cone(h.solid, 0.07 * S, 0.45 * S, 4, 0xf4efe0, s * 0.3 * S, -0.2 * S, ctx.headZ + 0.2 * S, 1.2, 0, 0));
    }
  }

  /* =========================================================
     TEK HÜCRELİ
     ========================================================= */
  function buildCell(spec) {
    const p = spec.parts || {};
    const S = spec.scale || 1;
    const mats = makeMats();
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);

    const R = 1.05 * S;
    const Y = R * 0.95;
    const body = new Parts();
    const head = new Parts();    // hücrede ayrı baş yok; göz/ağız da gövdeye

    ico(body.solid, R * 0.86, 1, spec.belly, 0, Y, 0, 1, 0.74, 1.22);
    ico(body.solid, R * 0.34, 0, spec.accent, 0, Y, -R * 0.15);
    body.solid.add(new THREE.TorusGeometry(R * 0.32, R * 0.11, 4, 9), G.xform(0, Y, R * 1.16), p.mouth || spec.eye);
    [-1, 1].forEach((s) => ico(body.glow, R * 0.15, 0, spec.eye, s * R * 0.38, Y + R * 0.4, R * 0.62));

    if (p.cilia) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        box(body.solid, 0.07 * S, 0.07 * S, R * 0.5, spec.accent,
          Math.sin(a) * R * 0.95, Y + Math.cos(a * 2) * R * 0.12, Math.cos(a) * R * 1.05, 0.3, a, 0);
      }
    }
    const spikes = p.spikes || has(spec, 'spikes');
    if (spikes) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        cone(body.solid, R * 0.11, R * 0.55, 4, spec.accent,
          Math.sin(a) * R * 1.0, Y + R * 0.45, Math.cos(a) * R * 1.1, Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
      }
    }
    addExtras(spec, { body, head, S, topY: Y + R * 0.7, len: R * 2.2, wid: R * 1.6, headTop: Y + R * 0.6, headZ: R * 1.0, hasSpikes: spikes, hasHorns: false });

    bake(rig, body, mats);
    bake(rig, head, mats);

    // saydam zar ayrı mesh (tek saydam materyal)
    const membrane = new THREE.Mesh(
      new THREE.IcosahedronGeometry(R, 1),
      new THREE.MeshPhongMaterial({ color: spec.body, flatShading: true, transparent: true, opacity: 0.55, shininess: 0, specular: 0x000000 })
    );
    membrane.scale.set(1, 0.78, 1.26);
    membrane.position.y = Y;
    rig.add(membrane);

    const cap = measure(root);

    /* --- kamçılar (hitbox'a dahil değil) --- */
    let tail = null;
    const segs = [];
    const count = p.flagella || 0;
    for (let f = 0; f < count; f++) {
      const g = new THREE.Group();
      const spread = count === 1 ? 0 : (f / (count - 1) - 0.5);
      g.position.set(spread * R * 0.7, Y + spread * R * 0.25, -R * 1.2);
      rig.add(g);
      if (!tail) tail = g;
      let parent = g, w = 0.17 * S, z = 0;
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Group();
        seg.position.set(0, 0, z);
        parent.add(seg);
        const len = 0.62 * S;
        const pp = new Parts();
        box(pp.solid, w, w, len, f % 2 ? spec.accent : spec.body, 0, 0, -len * 0.5);
        bake(seg, pp, mats);
        segs.push(seg);
        parent = seg;
        z = -len;
        w *= 0.82;
      }
    }
    if (tail) tail.userData.segments = segs;

    addBlob(root, R * 1.1);
    root.userData = {
      rig, neck: null, legs: [], tail, mats, membrane,
      hipY: Y, height: Y + R * 0.8, scale: S, cap,
      radius: cap.r, flash: 0, atk: 0, atkDur: 0.3, isCell: true,
    };
    return root;
  }

  /* =========================================================
     KARA YARATIĞI
     ========================================================= */
  function buildLand(spec) {
    const p = spec.parts || {};
    const S = spec.scale || 1;
    const mats = makeMats();
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);

    const bodyCol = has(spec, 'silver') ? lighten(spec.body, 0.18) : spec.body;
    const isBiped = p.legs === 2;
    const isBug = p.legs === 6;
    const legLen = (isBiped ? 1.5 : 1.0) * S;
    const hipY = legLen + 0.45 * S;
    const W = 1.15 * S, H = 1.0 * S, D = 2.0 * S;

    /* --- gövde --- */
    const body = new Parts();
    box(body.solid, W, H, D, bodyCol, 0, hipY, 0);
    box(body.solid, W * 0.86, H * 0.3, D * 0.9, spec.belly, 0, hipY - H * 0.42, 0);
    box(body.solid, W * 1.12, H * 0.9, D * 0.42, spec.accent, 0, hipY + 0.1 * S, D * 0.26);

    const spikes = !!p.spikes;
    if (spikes) {
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const sz = (0.36 - Math.abs(t - 0.45) * 0.4) * S;
        box(body.solid, 0.13 * S, sz * 1.9, 0.2 * S, spec.accent, 0, hipY + H * 0.5 + sz * 0.8, (t - 0.5) * D * 0.88, -0.2);
      }
    }
    if (p.fur) {
      for (let i = 0; i < 9; i++) {
        box(body.solid, 0.3 * S, 0.24 * S, 0.3 * S, spec.accent,
          U.rand(-0.5, 0.5) * W, hipY + H * 0.5 + 0.08 * S, U.rand(-0.48, 0.48) * D, 0, U.rand(0, 3), 0);
      }
      box(body.solid, W * 1.2, 0.5 * S, 0.45 * S, spec.accent, 0, hipY + H * 0.5, D * 0.3);
    }
    if (isBiped) {
      [-1, 1].forEach((s) => box(body.solid, 0.18 * S, 0.5 * S, 0.18 * S, spec.accent, s * W * 0.55, hipY + 0.05 * S, D * 0.3, 0.5));
    }

    /* --- baş --- */
    const neck = new THREE.Group();
    const neckY = hipY + (isBiped ? 0.55 : 0.28) * S;
    neck.position.set(0, neckY, D * 0.5);
    rig.add(neck);
    const head = new Parts();
    const hw = 0.92 * S, hh = 0.82 * S, hd = 1.0 * S;
    box(head.solid, hw, hh, hd, bodyCol, 0, 0.18 * S, hd * 0.38);
    box(head.solid, hw * 0.72, hh * 0.5, hd * 0.66, spec.accent, 0, -0.02 * S, hd * 0.92);
    box(head.solid, hw * 0.62, hh * 0.22, hd * 0.6, spec.belly, 0, -0.22 * S, hd * 0.9);
    [-1, 1].forEach((s) => box(head.glow, 0.16 * S, 0.16 * S, 0.1 * S, spec.eye, s * hw * 0.34, 0.3 * S, hd * 0.9));
    if (p.fangs) [-1, 1].forEach((s) => box(head.solid, 0.1 * S, 0.38 * S, 0.1 * S, 0xf4efe0, s * hw * 0.24, -0.3 * S, hd * 1.08));
    if (p.ears) [-1, 1].forEach((s) => box(head.solid, 0.22 * S, 0.44 * S, 0.12 * S, spec.accent, s * hw * 0.4, 0.62 * S, hd * 0.2, 0, 0, s * 0.22));
    const horns = !!p.horns;
    if (horns) [-1, 1].forEach((s) => cone(head.solid, 0.15 * S, 0.8 * S, 5, 0xe8dcc0, s * hw * 0.42, 0.72 * S, hd * 0.34, -0.25, 0, -s * 0.42));

    addExtras(spec, {
      body, head, S, topY: hipY + H * 0.5, len: D, wid: W,
      headTop: 0.6 * S, headZ: hd, hasSpikes: spikes, hasHorns: horns,
    });
    bake(rig, body, mats);
    bake(neck, head, mats);

    /* --- bacaklar --- */
    const legs = [];
    const claws = has(spec, 'claws');
    function leg(x, z, phase) {
      const pivot = new THREE.Group();
      pivot.position.set(x, hipY - H * 0.35, z);
      rig.add(pivot);
      const lp = new Parts();
      box(lp.solid, 0.28 * S, legLen * 0.62, 0.3 * S, spec.accent, 0, -legLen * 0.3, 0);
      box(lp.solid, 0.34 * S, 0.22 * S, 0.5 * S, bodyCol, 0, -legLen * 0.68, 0.1 * S);
      if (claws) [-1, 0, 1].forEach((c) => cone(lp.solid, 0.05 * S, 0.22 * S, 4, 0xf4efe0, c * 0.1 * S, -legLen * 0.72, 0.38 * S, 1.5, 0, 0));
      bake(pivot, lp, mats);
      pivot.userData.phase = phase;
      legs.push(pivot);
    }
    const hx = W * 0.52;
    if (isBiped) { leg(-hx, -0.1 * S, 0); leg(hx, -0.1 * S, Math.PI); }
    else if (isBug) {
      for (let i = 0; i < 3; i++) { const z = (i - 1) * D * 0.32; leg(-hx, z, i * 1.05); leg(hx, z, i * 1.05 + Math.PI); }
    } else {
      leg(-hx, D * 0.3, 0); leg(hx, D * 0.3, Math.PI); leg(-hx, -D * 0.3, Math.PI); leg(hx, -D * 0.3, 0);
    }

    const cap = measure(root);

    /* --- kuyruk (hitbox'a dahil değil) --- */
    let tail = null;
    if (p.tail && p.tail !== 'none') {
      tail = new THREE.Group();
      tail.position.set(0, hipY - 0.05 * S, -D * 0.5);
      rig.add(tail);
      const cfg = { long: { n: 4, len: 0.62, taper: 0.8, w: 0.5 }, short: { n: 2, len: 0.34, taper: 0.75, w: 0.42 },
        bushy: { n: 3, len: 0.52, taper: 0.94, w: 0.62 } }[p.tail] || { n: 3, len: 0.5, taper: 0.85, w: 0.5 };
      let parent = tail, w = cfg.w * S, z = 0;
      const segs = [];
      const tuft = has(spec, 'tuft');
      for (let i = 0; i < cfg.n; i++) {
        const g = new THREE.Group();
        g.position.set(0, 0, z);
        parent.add(g);
        const len = cfg.len * S;
        const tp = new Parts();
        box(tp.solid, w, w * 0.85, len, i % 2 ? spec.accent : bodyCol, 0, 0, -len * 0.5);
        if (p.tail === 'bushy') box(tp.solid, w * 1.5, w * 1.3, len * 0.8, spec.accent, 0, 0, -len * 0.5, 0, 0, 0.5);
        if (tuft && i === cfg.n - 1) ico(tp.solid, w * 1.2, 0, 0xf2f2f2, 0, 0, -len);
        bake(g, tp, mats);
        segs.push(g);
        parent = g;
        z = -len;
        w *= cfg.taper;
      }
      tail.userData.segments = segs;
    }

    addBlob(root, D * 0.55);
    root.userData = {
      rig, neck, legs, tail, mats, membrane: null,
      hipY, height: hipY + H, scale: S, cap,
      radius: cap.r, flash: 0, atk: 0, atkDur: 0.3, isCell: false,
    };
    return root;
  }

  /** Dinlenme pozunda gövde+baş+bacaklardan kapsül çıkarır (ileri eksen boyunca). */
  const _box = new THREE.Box3();
  function measure(root) {
    root.updateMatrixWorld(true);
    _box.setFromObject(root);
    const xHalf = Math.max(Math.abs(_box.min.x), Math.abs(_box.max.x));
    const r = Math.max(0.3, xHalf * 0.95);
    const cz = (_box.max.z + _box.min.z) / 2;
    const hl = Math.max(0, (_box.max.z - _box.min.z) / 2 - r * 0.8);
    return { cz, hl, r, top: _box.max.y };
  }

  function addBlob(root, r) {
    const g = new THREE.CircleGeometry(r, 12);
    g.rotateX(-Math.PI / 2);
    const blob = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
    blob.position.y = 0.06;
    root.add(blob);
  }

  function build(spec) {
    return spec.kind === 'cell' ? buildCell(spec) : buildLand(spec);
  }

  /* =========================================================
     Animasyon
     ========================================================= */
  function animate(root, dt, speed01, time) {
    const d = root.userData;
    if (!d || !d.rig) return;
    const amp = 0.18 + speed01 * 0.72;
    const rate = 5 + speed01 * 9;

    for (let i = 0; i < d.legs.length; i++) {
      d.legs[i].rotation.x = Math.sin(time * rate + d.legs[i].userData.phase) * amp;
    }

    let thrust = 0;
    if (d.atk > 0) {
      d.atk = Math.max(0, d.atk - dt / d.atkDur);
      thrust = Math.sin(Math.PI * (1 - d.atk));
    }

    if (d.isCell) {
      d.rig.position.y = Math.sin(time * 1.7) * 0.11 * d.scale;
      d.rig.position.z = thrust * 0.45 * d.scale;
      d.rig.rotation.z = Math.sin(time * 1.1) * 0.07;
      d.rig.rotation.x = Math.sin(time * 1.4 + 0.6) * 0.05 + speed01 * 0.12;
      if (d.membrane) {
        const pulse = 1 + Math.sin(time * 2.6) * 0.045;
        d.membrane.scale.set(pulse * (1 - thrust * 0.12), 0.78 * pulse, 1.26 * pulse * (1 + thrust * 0.25));
      }
    } else {
      d.rig.position.y = Math.abs(Math.sin(time * rate)) * 0.09 * speed01 * d.scale;
      d.rig.position.z = thrust * 0.35 * d.scale;
      d.rig.rotation.z = Math.sin(time * rate * 0.5) * 0.05 * speed01;
      d.rig.rotation.x = thrust * 0.12;
    }

    if (d.neck) {
      d.neck.rotation.x = Math.sin(time * rate * 0.5 + 1) * 0.09 * (0.3 + speed01) + thrust * 0.55;
      d.neck.rotation.y = Math.sin(time * 1.3) * 0.06;
    }

    if (d.tail && d.tail.userData.segments) {
      const segs = d.tail.userData.segments;
      if (d.isCell) {
        const w = 9 + speed01 * 11, a = 0.3 + speed01 * 0.24;
        for (let i = 0; i < segs.length; i++) {
          segs[i].rotation.y = Math.sin(time * w - i * 0.9) * a;
          segs[i].rotation.x = Math.cos(time * w * 0.7 - i * 0.7) * a * 0.45;
        }
      } else {
        for (let i = 0; i < segs.length; i++) {
          segs[i].rotation.y = Math.sin(time * (2.2 + speed01 * 4) - i * 0.6) * (0.12 + speed01 * 0.14);
          segs[i].rotation.x = Math.sin(time * 1.6 - i * 0.4) * 0.05;
        }
      }
    }

    if (d.flash > 0) {
      d.flash = Math.max(0, d.flash - dt * 4);
      d.mats.solid.emissive.setRGB(d.flash * 0.9, d.flash * 0.12, d.flash * 0.12);
    }
  }

  function flash(root) { if (root.userData) root.userData.flash = 1; }

  /** Saldırı animasyonu: baş öne-aşağı dalar, gövde ileri atılır. */
  function attack(root, dur) {
    const d = root.userData;
    if (!d) return;
    d.atk = 1;
    d.atkDur = dur || 0.3;
  }

  /* =========================================================
     Kapsül sorguları
     ========================================================= */
  const _seg = { ax: 0, az: 0, bx: 0, bz: 0, r: 0 };
  function capsule(group) {
    const c = group.userData.cap;
    const yaw = group.rotation.y;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const mx = group.position.x + fx * c.cz, mz = group.position.z + fz * c.cz;
    _seg.ax = mx - fx * c.hl; _seg.az = mz - fz * c.hl;
    _seg.bx = mx + fx * c.hl; _seg.bz = mz + fz * c.hl;
    _seg.r = c.r;
    return _seg;
  }

  /** (px,pz) noktasının yaratık yüzeyine yatay uzaklığı (içerideyse negatif). */
  function surfDist(group, px, pz) {
    const s = capsule(group);
    return Math.sqrt(U.segDist2(s.ax, s.az, s.bx, s.bz, px, pz)) - s.r;
  }

  /** Kapsülün (px,pz)'ye en yakın ekseni noktası — nişan ve efekt konumu için. */
  function closestPoint(group, px, pz, out) {
    const s = capsule(group);
    const vx = s.bx - s.ax, vz = s.bz - s.az;
    const l2 = vx * vx + vz * vz;
    let t = l2 > 1e-9 ? ((px - s.ax) * vx + (pz - s.az) * vz) / l2 : 0;
    t = U.clamp(t, 0, 1);
    out.x = s.ax + vx * t;
    out.z = s.az + vz * t;
    return out;
  }

  function dispose(root) {
    root.traverse((o) => {
      // Sprite'lar paylaşılan tek geometriyi kullanır: dispose edilmemeli.
      if (o.geometry && !o.isSprite) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }

  return { build, animate, flash, attack, capsule, surfDist, closestPoint, dispose };
})();
