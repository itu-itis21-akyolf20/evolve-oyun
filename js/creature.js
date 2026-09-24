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

   Biçimler: hücre parts.form = (yok) | 'jelly' denizanası | 'virus' |
   'colony' koloni | 'spiral' sarmal bakteri. Kara: legs 0 = yılan,
   parts.wings = kanatlı (uçanlar). Uçma yüksekliği enemies.js'de.
   Animasyon: adımda bacak kaldırma, dönüşte yatma, nefes, saldırıdan
   önce geri çekilme, vurulunca sarsılma, ölüm pozu (deathPose).

   ÇİZİM: kurulan parça ağacı skinify() ile TEK bir iskeletli mesh'e
   (SkinnedMesh) çevrilir: her hareketli düğüm bir kemik olur, parçalar
   kemiklerine bağlanır. Animasyon kodu aynı kalır (kemikleri döndürür),
   ama yaratık başına 12-14 çizim çağrısı 1'e iner. Işıklı parçalar
   aynı mesh'te 'glow' niteliğiyle kendinden ışıklı çizilir.
   Yer gölgesi lekeleri gfx.js'te tek bir örneklenmiş mesh'tir.
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
      solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.72, metalness: 0.02 }),
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
    const form = p.form || 'blob';
    const Y = form === 'jelly' ? R * 1.6 : R * 0.95;     // denizanası gövdesi dokunaçların üstünde
    const body = new Parts();
    const head = new Parts();    // hücrede ayrı baş yok; göz/ağız da gövdeye

    if (form === 'virus') {
      // köşeli kapsid + ışıklı çekirdek + her yöne diken
      ico(body.solid, R * 0.82, 0, spec.body, 0, Y, 0);
      ico(body.glow, R * 0.36, 0, spec.eye, 0, Y, 0);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, b = (i % 3 - 1) * 0.7;
        const dx = Math.cos(b) * Math.sin(a), dy = Math.sin(b), dz = Math.cos(b) * Math.cos(a);
        // koninin +Y ekseni (dx,dy,dz)'ye: XYZ Euler'de rx=atan2(dz,dy), rz=-asin(dx)
        cone(body.solid, R * 0.1, R * 0.62, 4, spec.accent, dx * R * 1.0, Y + dy * R * 1.0, dz * R * 1.0,
          Math.atan2(dz, dy), 0, -Math.asin(U.clamp(dx, -1, 1)));
        ico(body.glow, R * 0.08, 0, spec.eye, dx * R * 1.35, Y + dy * R * 1.35, dz * R * 1.35);
      }
    } else if (form === 'colony') {
      // birbirine yapışık 5 küçük hücre
      [[0, 0, 0, 0.62], [0.55, 0.1, 0.25, 0.46], [-0.55, 0.05, 0.2, 0.48], [0.2, 0.15, -0.55, 0.44], [-0.25, 0.3, -0.35, 0.4]].forEach(([x, y, z, r], i) => {
        ico(body.solid, R * r, 1, i % 2 ? spec.belly : spec.body, x * R, Y + y * R, z * R);
        ico(body.glow, R * r * 0.24, 0, spec.eye, x * R + R * r * 0.35, Y + y * R + R * r * 0.45, z * R + R * r * 0.6);
      });
    } else if (form === 'spiral') {
      // sarmal zincir
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        ico(body.solid, R * (0.36 - t * 0.12), 0, i % 2 ? spec.accent : spec.body,
          Math.sin(t * Math.PI * 3) * R * 0.35, Y + Math.cos(t * Math.PI * 3) * R * 0.25, (0.5 - t) * R * 2.6);
      }
      [-1, 1].forEach((s) => ico(body.glow, R * 0.1, 0, spec.eye, s * R * 0.16, Y + R * 0.2, R * 1.45));
    } else if (form === 'jelly') {
      // çan biçimli şemsiye; alt kenarda ışıklı noktalar
      ico(body.solid, R * 0.55, 0, spec.accent, 0, Y - R * 0.05, 0);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ico(body.glow, R * 0.09, 0, spec.eye, Math.sin(a) * R * 0.92, Y - R * 0.32, Math.cos(a) * R * 0.92);
      }
    } else {
      ico(body.solid, R * 0.86, 1, spec.belly, 0, Y, 0, 1, 0.74, 1.22);
      ico(body.solid, R * 0.34, 0, spec.accent, 0, Y, -R * 0.15);
      body.solid.add(new THREE.TorusGeometry(R * 0.32, R * 0.11, 4, 9), G.xform(0, Y, R * 1.16), p.mouth || spec.eye);
      [-1, 1].forEach((s) => ico(body.glow, R * 0.15, 0, spec.eye, s * R * 0.38, Y + R * 0.4, R * 0.62));
    }

    if (p.cilia && form === 'blob') {
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

    // saydam zar ayrı mesh (tek saydam materyal); virüs/koloni/sarmalda zar yok
    let membrane = null;
    if (form === 'blob' || form === 'jelly') {
      membrane = new THREE.Mesh(
        new THREE.IcosahedronGeometry(R, 1),
        new THREE.MeshPhongMaterial({ color: spec.body, flatShading: true, transparent: true, opacity: 0.55, shininess: 70, specular: 0x557777 })
      );
      if (form === 'jelly') membrane.scale.set(1.05, 0.62, 1.05);
      else membrane.scale.set(1, 0.78, 1.26);
      membrane.position.y = Y;
      rig.add(membrane);
    }
    membrane && (membrane.userData.base = membrane.scale.clone());

    // denizanası dokunaçları (hitbox'a dahil değil)
    const tentacles = [];
    if (form === 'jelly') {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const g = new THREE.Group();
        g.position.set(Math.sin(a) * R * 0.6, Y - R * 0.35, Math.cos(a) * R * 0.6);
        rig.add(g);
        let parent = g;
        const segs = [];
        for (let i = 0; i < 4; i++) {
          const seg = new THREE.Group();
          seg.position.y = i ? -0.34 * S : 0;
          parent.add(seg);
          const tp = new Parts();
          box(tp.solid, 0.08 * S, 0.34 * S, 0.08 * S, k % 2 ? spec.accent : spec.body, 0, -0.17 * S, 0);
          bake(seg, tp, mats);
          segs.push(seg);
          parent = seg;
        }
        tentacles.push({ segs, phase: k * 1.1 });
      }
    }

    const cap = measure(root);
    if (form === 'jelly') cap.top = Y + R * 0.7;

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

    const blob = addBlob(root, R * 1.1);
    root.userData = {
      rig, neck: null, legs: [], tail, mats, membrane, blob, tentacles, wings: [], form,
      hipY: Y, height: Y + R * 0.8, scale: S, cap,
      radius: cap.r, flash: 0, atk: 0, atkDur: 0.3, isCell: true, hurt: 0, lean: 0, prevYaw: null,
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
    const isSnake = p.legs === 0;
    const legLen = (isBiped ? 1.5 : isSnake ? 0 : 1.0) * S;
    const hipY = isSnake ? 0.42 * S : legLen + 0.45 * S;
    const W = (isSnake ? 0.7 : 1.15) * S, H = (isSnake ? 0.62 : 1.0) * S, D = (isSnake ? 1.5 : 2.0) * S;

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
      pivot.userData.baseY = pivot.position.y;
      legs.push(pivot);
    }
    const hx = W * 0.52;
    if (isSnake) { /* bacak yok */ }
    else if (isBiped) { leg(-hx, -0.1 * S, 0); leg(hx, -0.1 * S, Math.PI); }
    else if (isBug) {
      for (let i = 0; i < 3; i++) { const z = (i - 1) * D * 0.32; leg(-hx, z, i * 1.05); leg(hx, z, i * 1.05 + Math.PI); }
    } else {
      leg(-hx, D * 0.3, 0); leg(hx, D * 0.3, Math.PI); leg(-hx, -D * 0.3, Math.PI); leg(hx, -D * 0.3, 0);
    }

    /* --- kanatlar (uçanlar): omuzda pivot, çırpma animate() içinde --- */
    const wings = [];
    if (p.wings) {
      const span = (p.wingSpan || 2.0) * S;
      [-1, 1].forEach((s) => {
        const wp = new THREE.Group();
        wp.position.set(s * W * 0.45, hipY + H * 0.35, D * 0.08);
        rig.add(wp);
        const wg = new Parts();
        // geniş zar: iç kısım gövde renginde, uç kısım daralan açık renk
        box(wg.solid, span * 0.55, 0.08 * S, 1.35 * S, spec.accent, s * span * 0.3, 0, -0.1 * S);
        box(wg.solid, span * 0.5, 0.07 * S, 0.95 * S, lighten(spec.accent, 0.08), s * span * 0.75, 0, -0.2 * S, 0, s * 0.12, 0);
        box(wg.solid, span * 0.55, 0.09 * S, 0.45 * S, bodyCol, s * span * 0.28, 0.02 * S, 0.45 * S);
        for (let i = 0; i < 3; i++) box(wg.solid, 0.08 * S, 0.08 * S, 1.0 * S, spec.belly, s * span * (0.35 + i * 0.25), 0.04 * S, -0.05 * S, 0, s * 0.25 * i, 0);
        bake(wp, wg, mats);
        wp.userData.side = s;
        wings.push(wp);
      });
    }

    const cap = measure(root);

    /* --- kuyruk (hitbox'a dahil değil) --- */
    let tail = null;
    if (p.tail && p.tail !== 'none') {
      tail = new THREE.Group();
      tail.position.set(0, hipY - 0.05 * S, -D * 0.5);
      rig.add(tail);
      const cfg = { long: { n: 4, len: 0.62, taper: 0.8, w: 0.5 }, short: { n: 2, len: 0.34, taper: 0.75, w: 0.42 },
        bushy: { n: 3, len: 0.52, taper: 0.94, w: 0.62 }, serpent: { n: 7, len: 0.55, taper: 0.88, w: 0.62 },
        fan: { n: 2, len: 0.5, taper: 1.3, w: 0.5 } }[p.tail] || { n: 3, len: 0.5, taper: 0.85, w: 0.5 };
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

    const blob = addBlob(root, D * 0.55);
    root.userData = {
      rig, neck, legs, tail, mats, membrane: null, blob, tentacles: [], wings, isSnake,
      hipY, height: hipY + H, scale: S, cap,
      radius: cap.r, flash: 0, atk: 0, atkDur: 0.3, isCell: false, hurt: 0, lean: 0, prevYaw: null,
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

  /** Yer gölgesi: mesh yerine yarıçap (gfx.js tüm lekeleri tek çizimde çizer). */
  function addBlob(root, r) {
    root.userData.blobR = r;
    return null;
  }

  /* =========================================================
     Tek çizim çağrısı: parça ağacı → iskeletli mesh
     ========================================================= */
  const GLOW_VERT = ['#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;'];
  const GLOW_VERT2 = ['#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;'];
  const GLOW_FRAG = ['#include <common>', '#include <common>\nvarying float vGlow;'];
  const GLOW_FRAG2 = ['#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor * vGlow;'];
  function glowCompile(sh) {
    sh.vertexShader = sh.vertexShader.replace(GLOW_VERT[0], GLOW_VERT[1]).replace(GLOW_VERT2[0], GLOW_VERT2[1]);
    sh.fragmentShader = sh.fragmentShader.replace(GLOW_FRAG[0], GLOW_FRAG[1]).replace(GLOW_FRAG2[0], GLOW_FRAG2[1]);
  }

  const _m = new THREE.Matrix4();
  const _v3 = new THREE.Vector3();
  const _n3 = new THREE.Vector3();
  const _nm = new THREE.Matrix3();

  function skinify(root) {
    const d = root.userData;
    const mats = d.mats;
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();

    // 1) hareketli düğümler (grup) → kemikler; ağaç yapısı korunur
    const boneOf = new Map();
    const bones = [];
    function mk(node, parentBone) {
      const b = new THREE.Bone();
      b.position.copy(node.position);
      b.rotation.copy(node.rotation);
      b.scale.copy(node.scale);
      b.userData = Object.assign({}, node.userData);
      boneOf.set(node, b);
      bones.push(b);
      if (parentBone) parentBone.add(b);
      node.children.forEach((c) => { if (!c.isMesh && !c.isSprite && c.isObject3D) mk(c, b); });
      return b;
    }
    const rigBone = mk(d.rig, null);

    // 2) parçaları kemik uzayında tek geometriye topla
    const parts = [];
    let verts = 0;
    root.traverse((o) => {
      if (!o.isMesh || (o.material !== mats.solid && o.material !== mats.glow)) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      parts.push({ o, g, bone: bones.indexOf(boneOf.get(o.parent)), glow: o.material === mats.glow ? 1 : 0 });
      verts += g.attributes.position.count;
    });
    const pos = new Float32Array(verts * 3), nor = new Float32Array(verts * 3), col = new Float32Array(verts * 3);
    const si = new Uint16Array(verts * 4), sw = new Float32Array(verts * 4), gl = new Float32Array(verts);
    let k = 0;
    parts.forEach((p) => {
      _m.multiplyMatrices(inv, p.o.matrixWorld);
      _nm.getNormalMatrix(_m);
      const gp = p.g.attributes.position, gn = p.g.attributes.normal, gc = p.g.attributes.color;
      for (let i = 0; i < gp.count; i++, k++) {
        _v3.fromBufferAttribute(gp, i).applyMatrix4(_m);
        pos[k * 3] = _v3.x; pos[k * 3 + 1] = _v3.y; pos[k * 3 + 2] = _v3.z;
        if (gn) { _n3.fromBufferAttribute(gn, i).applyMatrix3(_nm).normalize(); nor[k * 3] = _n3.x; nor[k * 3 + 1] = _n3.y; nor[k * 3 + 2] = _n3.z; }
        if (gc) { col[k * 3] = gc.getX(i); col[k * 3 + 1] = gc.getY(i); col[k * 3 + 2] = gc.getZ(i); }
        si[k * 4] = Math.max(0, p.bone); sw[k * 4] = 1;
        gl[k] = p.glow;
      }
      if (p.g !== p.o.geometry) p.g.dispose();
      p.o.geometry.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setAttribute('glow', new THREE.BufferAttribute(gl, 1));
    geo.computeBoundingSphere();
    geo.boundingSphere.radius *= 1.25;                 // animasyon payı (kuyruk, kanat)

    // 3) eski parça meshlerini kaldır; saydam zarı kemiğine taşı
    const membrane = d.membrane;
    if (membrane) { const b = boneOf.get(membrane.parent); membrane.parent.remove(membrane); b.add(membrane); }
    root.remove(d.rig);
    mats.glow.dispose();

    const mesh = new THREE.SkinnedMesh(geo, mats.solid);
    mats.solid.onBeforeCompile = glowCompile;
    mesh.add(rigBone);
    root.add(mesh);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.userData.skin = true;

    // 4) animasyon başvurularını kemiklere çevir
    const B = (n) => (n ? boneOf.get(n) || n : n);
    d.rig = rigBone;
    d.neck = B(d.neck);
    d.legs = d.legs.map(B);
    d.wings = d.wings.map(B);
    d.tentacles = d.tentacles.map((t) => ({ segs: t.segs.map(B), phase: t.phase }));
    if (d.tail) {
      const segs = (d.tail.userData.segments || []).map(B);
      d.tail = B(d.tail);
      d.tail.userData.segments = segs;
    }
    d.mesh = mesh;
    return root;
  }

  /** kind: 'player' | 'boss' | 'creature' — gölge atma kararı gfx.js'te (kaliteye göre). */
  function build(spec, kind) {
    const root = spec.kind === 'cell' ? buildCell(spec) : buildLand(spec);
    const blobR = root.userData.blobR;
    skinify(root);
    root.userData.blobR = blobR;
    const k = kind || 'creature';
    const cast = EV.GFX ? EV.GFX.castFor(k) : false;
    root.traverse((o) => {
      if (!o.isMesh || (o.material && o.material.transparent)) return;
      o.castShadow = cast;
      o.userData.shadowCast = k;
    });
    root.userData.realShadow = cast;
    return root;
  }

  /* =========================================================
     Animasyon
     ========================================================= */
  /** Saldırı eğrisi: ilk %30 geri çekilme (hazırlık), sonra ileri atılma. */
  function attackCurve(d) {
    if (d.atk <= 0) return 0;
    const p = 1 - d.atk;
    return p < 0.3 ? -0.45 * (p / 0.3) : Math.sin(Math.PI * (p - 0.3) / 0.7);
  }

  function animate(root, dt, speed01, time) {
    const d = root.userData;
    if (!d || !d.rig) return;
    const amp = 0.18 + speed01 * 0.72;
    const rate = 5 + speed01 * 9;
    const S = d.scale;

    // dönüş hızı → gövde içe yatar, kuyruk dışa savrulur
    const yaw = root.rotation.y;
    let turn = 0;
    if (d.prevYaw != null && dt > 0) turn = U.clamp(U.wrapAngle(yaw - d.prevYaw) / dt, -6, 6);
    d.prevYaw = yaw;
    d.lean = U.lerp(d.lean, -turn * 0.045 * (0.3 + speed01), Math.min(1, dt * 8));

    // adım: bacak öne-arkaya + havadayken kalkar (uçarken bacaklar toplanır)
    const flying = !!d.flying;
    for (let i = 0; i < d.legs.length; i++) {
      const L = d.legs[i];
      if (flying) { L.rotation.x = U.lerp(L.rotation.x, 0.9, Math.min(1, dt * 6)); L.position.y = L.userData.baseY; continue; }
      const ph = time * rate + L.userData.phase;
      L.rotation.x = Math.sin(ph) * amp;
      L.position.y = L.userData.baseY + Math.max(0, Math.cos(ph)) * 0.14 * S * speed01;
    }

    if (d.atk > 0) d.atk = Math.max(0, d.atk - dt / d.atkDur);
    const thrust = attackCurve(d);
    if (d.hurt > 0) d.hurt = Math.max(0, d.hurt - dt * 5);
    const recoil = d.hurt * d.hurt;

    if (d.isCell) {
      const breathe = 1 + Math.sin(time * 2.6) * 0.045;
      d.rig.position.y = Math.sin(time * 1.7) * 0.11 * S;
      d.rig.position.z = thrust * 0.45 * S - recoil * 0.25 * S;
      d.rig.rotation.z = Math.sin(time * 1.1) * 0.07 + d.lean;
      d.rig.rotation.x = Math.sin(time * 1.4 + 0.6) * 0.05 + speed01 * 0.12 - recoil * 0.2;
      if (d.form === 'virus' || d.form === 'colony') d.rig.rotation.y += dt * (d.form === 'virus' ? 1.6 : 0.5);
      if (d.form === 'spiral') d.rig.rotation.z = Math.sin(time * 6) * 0.25;
      if (d.membrane) {
        const b = d.membrane.userData.base;
        if (d.form === 'jelly') {
          const pump = 1 + Math.sin(time * 3.2) * 0.1;             // şemsiye kasılır/gevşer
          d.membrane.scale.set(b.x * pump, b.y * (2 - pump), b.z * pump);
          d.rig.position.y = Math.sin(time * 3.2 - 0.8) * 0.2 * S;
        } else {
          d.membrane.scale.set(b.x * breathe * (1 - thrust * 0.12), b.y * breathe, b.z * breathe * (1 + thrust * 0.25));
        }
      }
      for (let k = 0; k < d.tentacles.length; k++) {
        const t = d.tentacles[k];
        for (let i = 0; i < t.segs.length; i++) {
          t.segs[i].rotation.x = Math.sin(time * 2.4 + t.phase - i * 0.7) * 0.28 + speed01 * 0.35;
          t.segs[i].rotation.z = Math.cos(time * 1.9 + t.phase - i * 0.6) * 0.2;
        }
      }
    } else {
      const breathe = 1 + Math.sin(time * 2.1) * 0.022 * (1 - speed01);
      d.rig.scale.set(1, breathe, 1);
      d.rig.position.y = (flying ? Math.sin(time * 4) * 0.12 * S : Math.abs(Math.sin(time * rate)) * 0.1 * speed01 * S);
      d.rig.position.z = thrust * 0.35 * S - recoil * 0.3 * S;
      d.rig.rotation.z = Math.sin(time * rate * 0.5) * 0.05 * speed01 + d.lean;
      d.rig.rotation.x = thrust * 0.12 - recoil * 0.25 + (flying ? 0.12 * speed01 : 0);
      if (d.isSnake) d.rig.rotation.y = Math.sin(time * (3 + speed01 * 5)) * 0.14 * (0.3 + speed01);
    }

    for (let i = 0; i < d.wings.length; i++) {
      const w = d.wings[i], s = w.userData.side;
      const flap = flying ? Math.sin(time * (9 + speed01 * 5)) * 0.75 : -0.2 + Math.sin(time * 1.5) * 0.05;
      w.rotation.z = s * (flying ? flap : 1.1 + flap);                // yerdeyken kanatlar katlanır
      w.rotation.x = flying ? Math.cos(time * 9) * 0.1 : 0;
    }

    if (d.neck) {
      d.neck.rotation.x = Math.sin(time * rate * 0.5 + 1) * 0.09 * (0.3 + speed01) + thrust * 0.55 - recoil * 0.3;
      d.neck.rotation.y = Math.sin(time * 1.3) * 0.06 + d.lean * 0.8;
    }

    if (d.tail && d.tail.userData.segments) {
      const segs = d.tail.userData.segments;
      if (d.isCell) {
        const w = 9 + speed01 * 11, a = 0.3 + speed01 * 0.24;
        for (let i = 0; i < segs.length; i++) {
          segs[i].rotation.y = Math.sin(time * w - i * 0.9) * a;
          segs[i].rotation.x = Math.cos(time * w * 0.7 - i * 0.7) * a * 0.45;
        }
      } else if (d.isSnake) {
        const w = 3 + speed01 * 6, a = 0.22 + speed01 * 0.18;     // yılan kıvrımı gövde boyunca akar
        for (let i = 0; i < segs.length; i++) segs[i].rotation.y = Math.sin(time * w - i * 0.85) * a - d.lean * 0.3;
      } else {
        for (let i = 0; i < segs.length; i++) {
          segs[i].rotation.y = Math.sin(time * (2.2 + speed01 * 4) - i * 0.6) * (0.12 + speed01 * 0.14) - d.lean * 0.6;
          segs[i].rotation.x = Math.sin(time * 1.6 - i * 0.4) * 0.05 + thrust * 0.12;
        }
      }
    }

    if (d.flash > 0 || d.glow) {
      d.flash = Math.max(0, d.flash - dt * 4);
      const g = d.glow || ZERO;
      d.mats.solid.emissive.setRGB(g.r + d.flash * 0.9, g.g + d.flash * 0.12, g.b + d.flash * 0.12);
    }
  }
  const ZERO = { r: 0, g: 0, b: 0 };

  /** Vuruş parlaması + sarsılma. */
  function flash(root) { if (root.userData) { root.userData.flash = 1; root.userData.hurt = 1; } }

  /** Kalıcı ışıma (şampiyon, geçmiş benlik…): {r,g,b} 0..1 ya da null. */
  function setGlow(root, rgb) { if (root.userData) root.userData.glow = rgb; }

  /** Ölüm pozu k: 0→1 — yana devrilir, batar, solar. */
  function deathPose(root, k) {
    const d = root.userData;
    if (!d || !d.rig) return;
    if (!d.dying) {
      d.dying = { side: Math.random() < 0.5 ? -1 : 1 };
      root.traverse((o) => { if (o.material && !o.isSprite) { o.material.transparent = true; o.material.depthWrite = k < 0.5; } });
    }
    const e = k * k;
    d.rig.rotation.z = d.dying.side * e * (d.isCell ? 0.6 : 1.45);
    d.rig.position.y = -e * 0.6 * d.scale;
    const s = d.isCell ? 1 - e * 0.5 : 1;
    d.rig.scale.set(s, s, s);
    root.traverse((o) => {
      if (!o.material || o.isSprite) return;
      if (o.userData.op0 == null) o.userData.op0 = o.material.opacity;
      o.material.opacity = o.userData.op0 * (1 - k);
    });
  }

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
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose();
      // Sprite'lar paylaşılan tek geometriyi kullanır: dispose edilmemeli.
      if (o.geometry && !o.isSprite) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }

  return { build, animate, flash, setGlow, deathPose, attack, capsule, surfDist, closestPoint, dispose };
})();
