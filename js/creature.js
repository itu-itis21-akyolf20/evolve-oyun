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
    const skip = ctx.skip || {};          // takılı mutasyonun yerini aldığı parçalar

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
    if (has(spec, 'spikes') && !ctx.hasSpikes && !skip.spikes) {
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
    if (has(spec, 'crest') && !skip.crest) {
      box(h.solid, 0.08 * S, 0.45 * S, 0.7 * S, lighten(spec.accent, 0.15), 0, ctx.headTop + 0.15 * S, ctx.headZ * 0.3);
    }
    if (has(spec, 'plates') && !skip.plates) {
      for (let i = 0; i < 4; i++) {
        box(b.solid, W * 0.7, 0.1 * S, 0.34 * S, 0xe8dcc0, 0, top + 0.04 * S, (i / 3 - 0.5) * L * 0.8, 0.12);
      }
    }
    if (has(spec, 'sunCrest') && !skip.crest) {
      for (let i = 0; i < 3; i++) box(h.glow, 0.07 * S, (0.35 - i * 0.08) * S, 0.14 * S, 0xffae3d, 0, ctx.headTop + 0.18 * S, ctx.headZ * 0.2 - i * 0.18 * S, -0.3);
    }
    if (has(spec, 'frills')) {
      [-1, 1].forEach((s) => box(h.solid, 0.06 * S, 0.5 * S, 0.5 * S, 0xd9b26a, s * 0.55 * S, ctx.headTop - 0.2 * S, 0, 0, 0, s * 0.5));
    }
    if (has(spec, 'horns') && !ctx.hasHorns && !skip.horns) {
      [-1, 1].forEach((s) => cone(h.solid, 0.13 * S, 0.7 * S, 5, 0xe8dcc0, s * 0.35 * S, ctx.headTop + 0.25 * S, ctx.headZ * 0.3, -0.25, 0, -s * 0.42));
    }
    if (has(spec, 'scutes') && !skip.scutes) {
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
    if (has(spec, 'tusks') && !skip.tusks) {
      [-1, 1].forEach((s) => cone(h.solid, 0.07 * S, 0.45 * S, 4, 0xf4efe0, s * 0.3 * S, -0.2 * S, ctx.headZ + 0.2 * S, 1.2, 0, 0));
    }
  }

  /* =========================================================
     MUTASYONLAR — spec.mutations (items.js bodyMutations)
     [{ region, kind, plus 0-9, rarity 0-4, color 0xRRGGBB, glow 0|1 }]

     Parçalar bölgenin KEMİĞİNE bağlı Parts toplayıcılarına eklenir
     (gövde/sırt/deri → rig, baş/çene → boyun, pençe → her bacak,
     kuyruk → son kuyruk boğumu ya da kamçı ucu): skinify hepsini
     tek iskeletli meshe katar → ek çizim çağrısı YOK, animasyonla oynar.
     Hitbox (measure) mutasyonlardan ÖNCE ölçülür: parça büyüse de kapsül aynı.
     +seviye parçayı büyütür/çoğaltır; nadirlik rengine çalar,
     Destansı/Efsanevi uçlar ışır. Bozuk veri sessizce atlanır.
     ========================================================= */
  const MUT_KIND = {
    fangs: 'jaw', sabre: 'jaw', tusks: 'jaw', mandibles: 'jaw',
    claws: 'claws', talons: 'claws', sickle: 'claws', hooks: 'claws',
    quills: 'back', plates: 'back', spines: 'back', sail: 'back', wings: 'back',
    club: 'tail', stinger: 'tail', rattle: 'tail', fin: 'tail', whip: 'tail', brush: 'tail',
    horns: 'head', antlers: 'head', crest: 'head', frill: 'head', antennae: 'head', eye: 'head',
    scutes: 'hide', fur: 'hide', slime: 'hide', glands: 'hide', musk: 'hide', capsid: 'hide',
  };
  const MUT_TINT = [0, 0.14, 0.22, 0.3, 0.36];
  const ownKey = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  /** Doğrulanmış mutasyon listesi (bölge başına bir tane; tür bölgeyi belirler). */
  function mutations(spec) {
    const list = spec && Array.isArray(spec.mutations) ? spec.mutations : null;
    if (!list) return [];
    const out = [], seen = {};
    for (let i = 0; i < list.length && i < 24 && out.length < 6; i++) {
      const m = list[i];
      if (!m || typeof m !== 'object' || !ownKey(MUT_KIND, m.kind)) continue;
      const region = MUT_KIND[m.kind];
      if (seen[region]) continue;
      seen[region] = true;
      const col = Number(m.color);
      out.push({
        region, kind: m.kind,
        plus: U.clamp(Math.round(Number(m.plus)) || 0, 0, 9),
        rarity: U.clamp(Math.round(Number(m.rarity)) || 0, 0, 4),
        color: Number.isFinite(col) ? U.clamp(Math.round(col), 0, 0xffffff) : 0xffffff,
        glow: m.glow ? 1 : 0,
      });
    }
    return out;
  }

  /** Takılı mutasyonun yerini aldığı doğuştan/soy parçaları (üst üste binmesin). */
  function mutSkip(muts) {
    const k = {};
    muts.forEach((m) => { k[m.region] = m.kind; });
    return {
      fangs: k.jaw === 'fangs' || k.jaw === 'sabre',
      tusks: k.jaw === 'tusks',
      horns: k.head === 'horns' || k.head === 'antlers',
      crest: k.head === 'crest',
      spikes: k.back === 'spines' || k.back === 'quills' || k.back === 'plates' || k.back === 'sail',
      plates: k.back === 'plates',
      scutes: k.hide === 'scutes',
      claws: !!k.claws,
      tuft: !!k.tail,
    };
  }

  function mixHex(a, b, t) {
    const c = new THREE.Color(a);
    c.lerp(new THREE.Color(b), t);
    return c.getHex();
  }
  const frac = (v) => v - Math.floor(v);
  const hash = (i, s) => frac(Math.sin(i * 12.9898 + s * 78.233) * 43758.5453);

  const _up = new THREE.Vector3(0, 1, 0);
  const _oq = new THREE.Quaternion();
  const _ov = new THREE.Vector3();
  const _op = new THREE.Vector3();
  const _os = new THREE.Vector3();
  const IDENT = new THREE.Matrix4();

  /** geo (+Y boyunca merkezli, boyu h) tabanı p'de, (dx,dy,dz) yönüne bakacak şekilde eklenir. */
  function orient(c, geo, h, color, px, py, pz, dx, dy, dz, sx, sz) {
    _ov.set(dx, dy, dz);
    if (_ov.lengthSq() < 1e-10) _ov.set(0, 1, 0);
    _ov.normalize();
    _oq.setFromUnitVectors(_up, _ov);
    _op.set(px + _ov.x * h * 0.5, py + _ov.y * h * 0.5, pz + _ov.z * h * 0.5);
    _os.set(sx == null ? 1 : sx, 1, sz == null ? 1 : sz);
    c.add(geo, new THREE.Matrix4().compose(_op, _oq, _os), color);
  }

  /**
   * Kıvrık, sivrilen parça (boynuz, diş, pençe, diken): n boğum, her boğumda yön curl'e döner.
   * o: { p, d, curl, len, r, r1 (uç yarıçap oranı), n, seg, col, tipCol, band, glowTip, glowCol }
   * glowTip: ucun son %40'ı ışıyan bir kılıfla kaplanır. Dönüş: eklem noktaları (ilk taban, son uç).
   */
  function horn(P, o) {
    const n = o.n || 3, seg = o.seg || 5;
    const d = new THREE.Vector3(o.d[0], o.d[1], o.d[2]);
    if (d.lengthSq() < 1e-10) d.set(0, 1, 0);
    d.normalize();
    const cu = o.curl || [0, 0, 0];
    const r1 = o.r1 == null ? 0 : o.r1;
    const l = o.len / n;
    let x = o.p[0], y = o.p[1], z = o.p[2];
    const pts = [[x, y, z]];
    let lx = 0, ly = 1, lz = 0, lastA = 1, lastB = 0;
    for (let i = 0; i < n; i++) {
      const a = 1 - (i / n) * (1 - r1), b = 1 - ((i + 1) / n) * (1 - r1);
      const tip = o.band != null ? i >= o.band : i === n - 1;
      const col = tip && o.tipCol != null ? o.tipCol : o.col;
      orient(P.solid, new THREE.CylinderGeometry(o.r * b, o.r * a, l * 1.1, seg), l, col, x, y, z, d.x, d.y, d.z);
      x += d.x * l; y += d.y * l; z += d.z * l;
      pts.push([x, y, z]);
      lx = d.x; ly = d.y; lz = d.z; lastA = a; lastB = b;
      d.x += cu[0] / n; d.y += cu[1] / n; d.z += cu[2] / n;
      d.normalize();
    }
    if (o.glowTip) {
      const f = 0.4, h = l * f * 1.05;
      const rb = o.r * (lastB + (lastA - lastB) * f) * 1.3 + o.r * 0.04;
      orient(P.glow, new THREE.CylinderGeometry(o.r * lastB * 1.3, rb, h, seg), h, o.glowCol, x - lx * h, y - ly * h, z - lz * h, lx, ly, lz);
    }
    return pts;
  }

  /** Çift yüzlü üçgen zar (yelken, yüzgeç, kanat zarı, yaka). */
  function tri(c, a, b, cc, color) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      a[0], a[1], a[2], b[0], b[1], b[2], cc[0], cc[1], cc[2],
      a[0], a[1], a[2], cc[0], cc[1], cc[2], b[0], b[1], b[2],
    ]), 3));
    g.computeVertexNormals();
    c.add(g, IDENT, color);
  }

  /** Yassı elmas plaka (stegosaur plakası, ibik): tabanı b, ekseni (rx,rz) açısında; ince yön x. */
  function plate(P, bx, by, bz, rx, rz, h, wz, th, col, glowCol) {
    const ax = -Math.sin(rz), ay = Math.cos(rz) * Math.cos(rx), az = Math.cos(rz) * Math.sin(rx);
    P.solid.add(new THREE.ConeGeometry(1, 1, 4), G.xform(bx + ax * h * 0.5, by + ay * h * 0.5, bz + az * h * 0.5, rx, 0, rz, th, h, wz), col);
    if (glowCol != null) {
      const f = 0.4, k = 1 - f / 2;
      P.glow.add(new THREE.ConeGeometry(1, 1, 4), G.xform(bx + ax * h * k, by + ay * h * k, bz + az * h * k, rx, 0, rz, th * f * 1.6, h * f * 1.02, wz * f * 1.12), glowCol);
    }
  }

  const _s0 = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 };
  const _s1 = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 };
  const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const at = (s, o) => [s.x - s.nx * o, s.y - s.ny * o, s.z - s.nz * o];   // yüzeyin biraz içi (taban gömülsün)

  /** Kara gövdesi (kutu) yüzeyi: t ∈ [-1,1] boyuna (+ ön), phi yanlara (0 sırt, ±π/2 yan). */
  function landSurf(cy, W, H, D) {
    return (t, phi, out) => {
      const s = Math.sin(phi), c = Math.cos(phi);
      out.x = spow(s, 0.5) * W * 0.5;
      out.y = cy + spow(c, 0.5) * H * 0.5;
      out.z = t * D * 0.46;
      out.nx = s; out.ny = c; out.nz = 0;
      return out;
    };
  }

  /** Hücre zarı (elipsoid) yüzeyi, aynı (t, phi) düzeninde. */
  function cellSurf(cy, a, b, c) {
    return (t, phi, out) => {
      const th = t * 1.2;
      const ux = Math.sin(phi) * Math.cos(th), uy = Math.cos(phi) * Math.cos(th), uz = Math.sin(th);
      out.x = ux * a; out.y = cy + uy * b; out.z = uz * c;
      const nx = ux / a, ny = uy / b, nz = uz / c;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      out.nx = nx / l; out.ny = ny / l; out.nz = nz / l;
      return out;
    };
  }

  /* Parça kurucuları: (m: mutasyon, M: beden bağlamı, c: renk/ölçek) */
  const MUT = {
    /* ---------------- ÇENE ---------------- */
    fangs(m, M, c) {
      const J = M.jaw, u = M.u, col = c.tint(0xf2ecd8);
      if (M.cell) {            // hücre: ağız çevresinde halka dişler
        const n = 6 + Math.floor(m.plus / 2);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, ox = Math.sin(a), oy = Math.cos(a);
          horn(J.P, { p: [J.x + ox * J.w, J.y + oy * J.w, J.z - 0.06 * u], d: [ox * 0.6, oy * 0.6, 1], curl: [-ox * 0.9, -oy * 0.9, 0],
            len: 0.3 * u * c.k, r: 0.06 * u * c.sk, n: 2, seg: 4, col, glowTip: c.g, glowCol: c.glow });
        }
        return;
      }
      [-1, 1].forEach((s) => {
        horn(J.P, { p: [J.x + s * J.w, J.y + 0.05 * u, J.z - 0.08 * u], d: [0, -1, 0.15], curl: [0, 0, -0.35],
          len: 0.36 * u * c.k, r: 0.068 * u * c.sk, n: 2, col, glowTip: c.g, glowCol: c.glow });
        if (m.plus >= 5) horn(J.P, { p: [J.x + s * J.w * 1.5, J.y - 0.1 * u, J.z + 0.04 * u], d: [s * 0.1, 1, 0.2], curl: [0, 0, -0.3],
          len: 0.24 * u * c.k, r: 0.055 * u * c.sk, n: 2, col, glowTip: c.g, glowCol: c.glow });
      });
    },
    sabre(m, M, c) {
      const J = M.jaw, u = M.u, col = c.tint(0xf0e4c4);
      [-1, 1].forEach((s) => horn(J.P, { p: [J.x + s * J.w * 0.95, J.y + 0.06 * u, J.z - 0.14 * u], d: [s * 0.06, -1, 0.3], curl: [0, 0.1, -1.1],
        len: 0.66 * u * c.k, r: 0.088 * u * c.sk, n: 4, col, glowTip: c.g, glowCol: c.glow }));
    },
    tusks(m, M, c) {
      const J = M.jaw, u = M.u, col = c.tint(0xf6f0de);
      [-1, 1].forEach((s) => horn(J.P, { p: [J.x + s * J.w * 1.4, J.y + 0.02 * u, J.z - 0.22 * u], d: [s * 0.35, -0.55, 1], curl: [s * 0.3, 1.7, -0.35],
        len: 0.82 * u * c.k, r: 0.1 * u * c.sk, n: 5, col, glowTip: c.g, glowCol: c.glow }));
    },
    mandibles(m, M, c) {
      const J = M.jaw, u = M.u, col = c.tint(0x4a3222), tip = c.tint(0x2a1a10);
      [-1, 1].forEach((s) => {
        horn(J.P, { p: [J.x + s * J.w * 1.35, J.y + 0.06 * u, J.z - 0.14 * u], d: [s * 0.75, -0.12, 1], curl: [-s * 1.9, 0, 0.15],
          len: 0.6 * u * c.k, r: 0.09 * u * c.sk, n: 4, col, tipCol: tip, band: 2, glowTip: c.g, glowCol: c.glow });
        horn(J.P, { p: [J.x + s * J.w * 1.6, J.y + 0.04 * u, J.z + 0.1 * u * c.k], d: [-s, -0.1, 0.4],
          len: 0.14 * u * c.k, r: 0.045 * u * c.sk, n: 1, seg: 4, col: tip });
      });
    },

    /* ---------------- PENÇE ---------------- */
    claws(m, M, c) {
      const u = M.u, col = c.tint(0xe2d6ba);
      M.feet.forEach((F) => {
        const n = F.nc || 3, sx = F.fz, sz = -F.fx, s = F.s || 1;
        for (let j = 0; j < n; j++) {
          const o = n === 1 ? 0 : (j / (n - 1) - 0.5) * 2;
          horn(F.P, { p: [F.x + sx * o * 0.11 * u * s, F.y, F.z + sz * o * 0.11 * u * s], d: [F.fx, -0.3, F.fz], curl: [0, -1.4, 0],
            len: 0.26 * u * s * c.k, r: 0.052 * u * s * c.sk, n: 2, seg: 4, col, glowTip: c.g, glowCol: c.glow });
        }
      });
    },
    talons(m, M, c) {
      const u = M.u, col = c.tint(0x2e2824);
      M.feet.forEach((F) => {
        const n = F.nc || 3, sx = F.fz, sz = -F.fx, s = F.s || 1;
        for (let j = 0; j < n; j++) {
          const o = n === 1 ? 0 : (j / (n - 1) - 0.5) * 2;
          horn(F.P, { p: [F.x + sx * o * 0.12 * u * s, F.y + 0.02 * u, F.z + sz * o * 0.12 * u * s], d: [F.fx + sx * o * 0.25, -0.1, F.fz + sz * o * 0.25],
            curl: [0, -2.3, 0], len: 0.36 * u * s * c.k, r: 0.06 * u * s * c.sk, n: 3, seg: 4, col, glowTip: c.g, glowCol: c.glow });
        }
        if (n > 1) horn(F.P, { p: [F.x - F.fx * 0.3 * u * s, F.y + 0.02 * u, F.z - F.fz * 0.3 * u * s], d: [-F.fx, -0.2, -F.fz], curl: [0, -2, 0],
          len: 0.26 * u * s * c.k, r: 0.055 * u * s * c.sk, n: 2, seg: 4, col, glowTip: c.g, glowCol: c.glow });
      });
    },
    sickle(m, M, c) {
      const u = M.u, col = c.tint(0xe0d2b2), dark = c.tint(0x3a3028);
      M.feet.forEach((F) => {
        const s = F.s || 1, sx = F.fz, sz = -F.fx;
        const inner = F.x > 0.01 ? -1 : 1;
        [-1, 1].forEach((o) => horn(F.P, { p: [F.x + sx * o * 0.09 * u * s, F.y, F.z + sz * o * 0.09 * u * s], d: [F.fx, -0.3, F.fz], curl: [0, -1.4, 0],
          len: 0.18 * u * s * c.k, r: 0.045 * u * s, n: 2, seg: 4, col }));
        horn(F.P, { p: [F.x + sx * inner * 0.12 * u * s, F.y + 0.1 * u * s, F.z - F.fz * 0.05 * u], d: [F.fx * 0.35, 1, F.fz * 0.35],
          curl: [F.fx * 2.4, -2.9, F.fz * 2.4], len: 0.5 * u * s * c.k, r: 0.08 * u * s * c.sk, n: 5, seg: 4, col: dark, glowTip: c.g, glowCol: c.glow });
      });
    },
    hooks(m, M, c) {
      const u = M.u, col = c.tint(lighten(M.spec.accent, 0.12));
      M.feet.forEach((F) => {
        const s = F.s || 1, sx = F.fz, sz = -F.fx;
        [-1, 1].forEach((o) => horn(F.P, { p: [F.x + sx * o * 0.08 * u * s, F.y, F.z + sz * o * 0.08 * u * s], d: [F.fx, -0.5, F.fz], curl: [0, -2.4, 0],
          len: 0.34 * u * s * c.k, r: 0.055 * u * s * c.sk, n: 3, seg: 4, col, glowTip: c.g, glowCol: c.glow }));
      });
    },

    /* ---------------- SIRT ---------------- */
    quills(m, M, c) {
      const u = M.u, dark = c.tint(0x3e3228), light = c.tint(0xf2ecd8);
      const n = 9 + m.plus * 2;
      for (let i = 0; i < n; i++) {
        const t = 0.35 - frac(i * 0.7548777 + 0.13) * 1.2;
        const ph = (frac(i * 0.5698403 + 0.37) - 0.5) * 2.1;
        const S0 = M.surf(t, ph, _s0);
        horn(M.body, { p: at(S0, 0.04 * u), d: [S0.nx * 0.55, S0.ny * 0.55 + 0.25, S0.nz * 0.5 - 0.85], curl: [0, -0.15, -0.1],
          len: 0.56 * u * c.k * (0.75 + 0.4 * hash(i, 3)), r: 0.038 * u * c.sk, n: 2, seg: 4, col: dark, tipCol: light, band: 1,
          glowTip: c.g, glowCol: c.glow });
      }
    },
    plates(m, M, c) {
      const u = M.u, col = c.tint(lighten(M.spec.accent, 0.18)), n = 4 + Math.floor(m.plus / 2);
      for (let i = 0; i < n; i++) {
        const t = 0.32 - (i / Math.max(1, n - 1)) * 1.12;
        const S0 = M.surf(t, 0, _s0);
        const h = 0.58 * u * c.k * (0.55 + 0.45 * Math.sin(Math.PI * (i + 0.5) / n));
        const side = i % 2 ? 1 : -1;
        plate(M.body, S0.x + side * 0.07 * u, S0.y - 0.06 * u, S0.z, -0.22, side * 0.1, h, h * 0.42, 0.075 * u * c.sk, col, c.g ? c.glow : null);
      }
    },
    spines(m, M, c) {
      const u = M.u, col = c.tint(0xe8dcc0), n = 5 + Math.floor(m.plus / 2);
      for (let i = 0; i < n; i++) {
        const t = 0.42 - (i / Math.max(1, n - 1)) * 1.28;
        const S0 = M.surf(t, 0, _s0);
        horn(M.body, { p: at(S0, 0.05 * u), d: [0, 1, -0.45], curl: [0, 0, -0.3], len: 0.48 * u * c.k * (0.6 + 0.4 * Math.sin(Math.PI * (i + 0.5) / n)),
          r: 0.1 * u * c.sk, n: 2, seg: 4, col, glowTip: c.g, glowCol: c.glow });
      }
    },
    sail(m, M, c) {
      const u = M.u, ray = c.tint(0xe8dcc0), mem = c.tint(mixHex(M.spec.accent, 0xc8503a, 0.5)), mem2 = c.tint(mixHex(M.spec.accent, 0xe07a4a, 0.5));
      const n = 6 + Math.floor(m.plus / 2), tops = [];
      for (let i = 0; i < n; i++) {
        const t = 0.28 - (i / (n - 1)) * 1.05;
        const S0 = M.surf(t, 0, _s0);
        const h = 0.82 * u * c.k * (0.3 + 0.7 * Math.sin(Math.PI * (i + 0.5) / n));
        const b = [S0.x, S0.y - 0.03 * u, S0.z], tp = [S0.x, S0.y + h, S0.z - h * 0.14];
        orient(M.body.solid, new THREE.CylinderGeometry(0.014 * u, 0.034 * u, h * 1.03, 4), h, ray, b[0], b[1], b[2], 0, 1, -0.14);
        if (c.g) ico(M.body.glow, 0.05 * u * c.sk, 0, c.glow, tp[0], tp[1], tp[2]);
        tops.push({ b, t: tp });
      }
      for (let i = 0; i < n - 1; i++) {
        const A = tops[i], B = tops[i + 1], col = i % 2 ? mem : mem2;
        tri(M.body.solid, A.b, A.t, B.t, col);
        tri(M.body.solid, A.b, B.t, B.b, col);
      }
    },
    wings(m, M, c) {
      const u = M.u, bone = c.tint(lighten(M.spec.body, 0.05)), mem = c.tint(mixHex(M.spec.accent, 0x2a1a2a, 0.35));
      [-1, 1].forEach((s) => {
        const S0 = M.surf(0.32, s * 1.0, _s0);
        const sh = [S0.x, S0.y, S0.z];
        const arm = horn(M.body, { p: sh, d: [s * 0.55, 0.65, -0.5], curl: [0, -0.45, -0.5], len: 0.78 * u * c.k, r: 0.06 * u * c.sk, r1: 0.55, n: 2, seg: 4, col: bone });
        const el = arm[arm.length - 1];
        const f1 = horn(M.body, { p: el, d: [s * 0.25, -0.45, -1], curl: [0, -0.3, 0], len: 0.95 * u * c.k, r: 0.04 * u * c.sk, n: 2, seg: 4, col: bone, glowTip: c.g, glowCol: c.glow });
        const f2 = horn(M.body, { p: el, d: [s * 0.55, -0.05, -0.8], curl: [0, -0.2, 0], len: 0.7 * u * c.k, r: 0.035 * u * c.sk, n: 2, seg: 4, col: bone, glowTip: c.g, glowCol: c.glow });
        const t1 = f1[f1.length - 1], t2 = f2[f2.length - 1];
        const S1 = M.surf(-0.8, s * 1.2, _s1);
        tri(M.body.solid, sh, el, t1, mem);
        tri(M.body.solid, sh, t1, [S1.x, S1.y, S1.z], mem);
        tri(M.body.solid, el, t2, t1, mem);
      });
    },

    /* ---------------- KUYRUK (uç: T, ileri = -z) ---------------- */
    club(m, M, c) {
      const T = M.tail, u = M.u, col = c.tint(0xcdbf9a), knob = c.tint(0xe8dcc0);
      const r = Math.max(T.w, 0.2 * u) * 1.05 * c.k;
      ico(T.P.solid, r, 0, col, T.x, T.y, T.z - r * 0.6, 1.3, 0.78, 1.05);
      [[1, 0], [-1, 0], [0, 1], [0.7, -0.7], [-0.7, -0.7]].forEach(([ax, ay]) => horn(T.P, {
        p: [T.x + ax * r * 0.95, T.y + ay * r * 0.55, T.z - r * 0.6], d: [ax, ay, -0.25], len: r * 0.6, r: r * 0.26, n: 1, seg: 4,
        col: knob, glowTip: c.g, glowCol: c.glow }));
    },
    stinger(m, M, c) {
      const T = M.tail, u = M.u, bulb = c.tint(lighten(M.spec.accent, 0.08)), needle = c.tint(0x2a2420);
      const r = Math.max(T.w, 0.16 * u) * 0.9 * c.sk;
      ico(T.P.solid, r, 0, bulb, T.x, T.y, T.z - r * 0.8, 1, 0.95, 1.3);
      horn(T.P, { p: [T.x, T.y + r * 0.3, T.z - r * 1.8], d: [0, 0.35, -1], curl: [0, 2.0, 0.9], len: 0.58 * u * c.k, r: r * 0.45, n: 4, seg: 5,
        col: needle, glowTip: true, glowCol: c.g ? c.glow : 0x9cff6a });
    },
    rattle(m, M, c) {
      const T = M.tail, u = M.u, a = c.tint(0xd8c49a), b = c.tint(0xb8a47a);
      const n = 3 + Math.floor(m.plus / 2);
      let w = Math.max(T.w, 0.16 * u) * (1 + 0.06 * m.plus), z = T.z + 0.02 * u;
      for (let i = 0; i < n; i++) {
        const d = w * 0.6;
        box(T.P.solid, w * 1.12, w * 0.86, d, i % 2 ? a : b, T.x, T.y, z - d * 0.5);
        z -= d * 0.8;
        w *= 0.9;
      }
      if (c.g) ico(T.P.glow, w * 0.42, 0, c.glow, T.x, T.y, z - w * 0.2);
    },
    fin(m, M, c) {
      const T = M.tail, u = M.u, col = c.tint(mixHex(M.spec.accent, 0x5ab0d0, 0.35)), ray = c.tint(lighten(M.spec.accent, 0.2));
      const L = 0.62 * u * c.k, w = Math.max(T.w, 0.14 * u);
      const b0 = [T.x, T.y + w * 0.45, T.z + 0.06 * u], b1 = [T.x, T.y - w * 0.45, T.z + 0.06 * u];
      const fork = [T.x, T.y, T.z - L * 0.38];
      const up = [T.x, T.y + 0.58 * u * c.k, T.z - L], lo = [T.x, T.y - 0.42 * u * c.k, T.z - L * 0.85];
      tri(T.P.solid, b0, up, fork, col);
      tri(T.P.solid, b1, fork, lo, col);
      tri(T.P.solid, b0, fork, b1, col);
      [up, lo].forEach((e) => {
        const dx = e[0] - T.x, dy = e[1] - T.y, dz = e[2] - T.z, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        orient(c.g ? T.P.glow : T.P.solid, new THREE.CylinderGeometry(0.012 * u, 0.03 * u, len, 4), len, c.g ? c.glow : ray, T.x, T.y, T.z, dx, dy, dz);
      });
    },
    whip(m, M, c) {
      const T = M.tail, u = M.u, col = c.tint(lighten(M.spec.accent, 0.05));
      horn(T.P, { p: [T.x, T.y, T.z + 0.03 * u], d: [0, 0.05, -1], curl: [0.3, 0.4, 0], len: 1.15 * u * c.k, r: Math.max(T.w * 0.7, 0.07 * u), r1: 0.12,
        n: 5, seg: 5, col, glowTip: c.g, glowCol: c.glow });
    },
    brush(m, M, c) {
      const T = M.tail, u = M.u, fur = c.tint(M.spec.accent), tip = c.tint(0xf4f0e6);
      const n = 7 + m.plus, r = Math.max(T.w, 0.2 * u);
      for (let i = 0; i < n; i++) {
        const a = i * 2.39996, rr = r * (0.3 + 0.7 * frac(i * 0.618034)) * 0.55;
        horn(T.P, { p: [T.x + Math.cos(a) * rr, T.y + Math.sin(a) * rr, T.z + 0.06 * u], d: [Math.cos(a) * 0.45, Math.sin(a) * 0.45, -1],
          len: 0.52 * u * c.k * (0.7 + 0.3 * hash(i, 5)), r: 0.12 * u * c.sk, r1: 0.2, n: 2, seg: 4, col: fur, tipCol: tip, band: 1,
          glowTip: c.g && i % 2 === 0, glowCol: c.glow });
      }
    },

    /* ---------------- BAŞ (üst: H) ---------------- */
    horns(m, M, c) {
      const H = M.top, u = M.u, dark = c.tint(0x8a7a60), light = c.tint(0xf0e8d4);
      [-1, 1].forEach((s) => horn(H.P, { p: [H.x + s * H.w * 0.7, H.y - 0.06 * u, H.z - 0.02 * u], d: [s * 0.6, 1, 0.05], curl: [s * 0.5, -0.45, -1.35],
        len: 0.64 * u * c.k, r: 0.115 * u * c.sk, n: 4, seg: 5, col: dark, tipCol: light, band: 2, glowTip: c.g, glowCol: c.glow }));
    },
    antlers(m, M, c) {
      const H = M.top, u = M.u, col = c.tint(0xcdb892);
      const tines = 2 + Math.floor(m.plus / 3);
      [-1, 1].forEach((s) => {
        const pts = horn(H.P, { p: [H.x + s * H.w * 0.55, H.y - 0.04 * u, H.z - 0.08 * u], d: [s * 0.55, 1, -0.3], curl: [s * 0.35, -0.2, -0.35],
          len: 0.92 * u * c.k, r: 0.075 * u * c.sk, r1: 0.3, n: 4, seg: 4, col, glowTip: c.g, glowCol: c.glow });
        for (let j = 0; j < tines; j++) {
          const q = pts[1 + (j % (pts.length - 2))];
          horn(H.P, { p: q, d: [s * 0.25, 0.9, 0.75 - j * 0.3], curl: [0, 0.2, -0.4], len: 0.4 * u * c.k * (1 - j * 0.12), r: 0.045 * u * c.sk,
            n: 2, seg: 4, col, glowTip: c.g, glowCol: c.glow });
        }
      });
    },
    crest(m, M, c) {
      const H = M.top, u = M.u, col = c.tint(mixHex(M.spec.accent, 0xff7a3a, 0.45));
      const n = 3 + Math.floor(m.plus / 3);
      for (let i = 0; i < n; i++) {
        const h = 0.44 * u * c.k * (1 - i * 0.15);
        plate(H.P, H.x, H.y - 0.05 * u, H.z + 0.3 * u - i * 0.24 * u, -0.5, 0, h, h * 0.5, 0.06 * u * c.sk, col, c.g ? c.glow : null);
      }
    },
    frill(m, M, c) {
      const H = M.top, u = M.u, a = c.tint(mixHex(M.spec.accent, 0xffa03a, 0.5)), b = c.tint(mixHex(M.spec.accent, 0xe0503a, 0.45)), ray = c.tint(0x3a2a1a);
      const n = 7 + Math.floor(m.plus / 2), L = 0.62 * u * c.k;
      const cx = H.x, cy = H.y - 0.32 * u, cz = H.z - 0.3 * u;
      const tips = [];
      for (let i = 0; i < n; i++) {
        const an = -1.45 + (2.9 * i) / (n - 1);
        const tp = [cx + Math.sin(an) * L, cy + Math.cos(an) * L * 0.9, cz - L * 0.3];
        tips.push(tp);
        const dx = tp[0] - cx, dy = tp[1] - cy, dz = tp[2] - cz, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        orient(H.P.solid, new THREE.CylinderGeometry(0.01 * u, 0.028 * u, len, 4), len, ray, cx, cy, cz, dx, dy, dz);
        if (c.g) ico(H.P.glow, 0.05 * u * c.sk, 0, c.glow, tp[0], tp[1], tp[2]);
      }
      for (let i = 0; i < n - 1; i++) tri(H.P.solid, [cx, cy, cz], tips[i], tips[i + 1], i % 2 ? a : b);
    },
    antennae(m, M, c) {
      const H = M.top, u = M.u, col = c.tint(M.spec.accent), knob = c.tint(lighten(M.spec.accent, 0.25));
      [-1, 1].forEach((s) => {
        const pts = horn(H.P, { p: [H.x + s * H.w * 0.35, H.y - 0.03 * u, H.z + 0.3 * u], d: [s * 0.35, 1, 0.55], curl: [s * 0.35, -0.9, -1.1],
          len: 0.95 * u * c.k, r: 0.036 * u * c.sk, r1: 0.5, n: 5, seg: 4, col });
        const tp = pts[pts.length - 1];
        ico(c.g ? H.P.glow : H.P.solid, 0.075 * u * c.sk, 0, c.g ? c.glow : knob, tp[0], tp[1], tp[2]);
      });
    },
    eye(m, M, c) {
      const H = M.top, u = M.u, r = 0.1 * u * c.sk, brow = c.tint(lighten(M.spec.accent, -0.05));
      const eyeCol = c.g ? c.glow : lighten(M.spec.eye, 0.1);
      ico(H.P.glow, r, 1, eyeCol, H.x, H.y + r * 0.35, H.z + 0.1 * u);
      box(H.P.solid, r * 3.2, 0.055 * u, 0.09 * u, brow, H.x, H.y + r * 1.05, H.z + 0.06 * u - r * 0.3);
      if (m.plus >= 5) [-1, 1].forEach((s) => ico(H.P.glow, r * 0.55, 0, eyeCol, H.x + s * r * 2.2, H.y + r * 0.1, H.z + 0.04 * u));
    },

    /* ---------------- DERİ ---------------- */
    scutes(m, M, c) {
      const u = M.u, a = c.tint(lighten(M.spec.accent, -0.04)), b = c.tint(lighten(M.spec.accent, 0.06));
      const cols = 6 + m.plus, rows = m.plus >= 4 ? 5 : 3, sz = 0.17 * u * c.sk;
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < cols; i++) {
          const ph = (r - (rows - 1) / 2) * 0.42;
          const t = 0.8 - ((i + (r % 2) * 0.5) / cols) * 1.7;
          const S0 = M.surf(t, ph, _s0);
          const p = at(S0, 0.02 * u);
          orient(M.body.solid, new THREE.BoxGeometry(sz, 0.08 * u, sz * 1.2), 0.08 * u, (i + r) % 2 ? a : b, p[0], p[1], p[2], S0.nx, S0.ny, S0.nz);
          if (r === (rows - 1) / 2) horn(M.body, { p: [S0.x + S0.nx * 0.04 * u, S0.y + S0.ny * 0.04 * u, S0.z], d: [S0.nx, S0.ny, S0.nz - 0.3],
            len: 0.13 * u * c.k, r: 0.05 * u, n: 1, seg: 4, col: b, glowTip: c.g && i % 2 === 0, glowCol: c.glow });
        }
      }
    },
    fur(m, M, c) {
      const u = M.u, a = c.tint(M.spec.accent), b = c.tint(mixHex(M.spec.accent, M.spec.body, 0.5));
      const n = 16 + m.plus * 3;
      for (let i = 0; i < n; i++) {
        const t = frac(i * 0.7548777 + 0.21) * 1.8 - 0.9;
        const ph = (frac(i * 0.5698403 + 0.61) - 0.5) * 2.9;
        const S0 = M.surf(t, ph, _s0);
        horn(M.body, { p: at(S0, 0.05 * u), d: [S0.nx, S0.ny, S0.nz - 0.9], curl: [0, -0.4, 0], len: 0.32 * u * c.sk * (0.8 + 0.5 * hash(i, 7)),
          r: 0.1 * u, r1: 0.25, n: 2, seg: 4, col: i % 3 ? a : b });
      }
      if (c.g) for (let j = 0; j < 7; j++) { const S0 = M.surf(0.8 - j * 0.27, 0, _s0); box(M.body.glow, 0.07 * u, 0.06 * u, 0.2 * u, c.glow, S0.x, S0.y + 0.06 * u, S0.z); }
    },
    slime(m, M, c) {
      const u = M.u, col = c.tint(lighten(mixHex(M.spec.belly, 0x9adfff, 0.35), 0.06));
      const n = 10 + m.plus * 2;
      for (let i = 0; i < n; i++) {
        const t = frac(i * 0.7548777 + 0.4) * 1.8 - 0.9;
        const ph = (frac(i * 0.5698403 + 0.2) - 0.5) * 3.2;
        const S0 = M.surf(t, ph, _s0);
        const r = 0.13 * u * (0.7 + 0.6 * hash(i, 9)) * c.sk;
        ico(M.body.solid, r, 0, col, S0.x + S0.nx * r * 0.2, S0.y + S0.ny * r * 0.2, S0.z + S0.nz * r * 0.2, 1, 0.75, 1.1);
        if (Math.abs(ph) > 0.9 && i % 2) horn(M.body, { p: [S0.x + S0.nx * r * 0.5, S0.y - r * 0.3, S0.z], d: [0, -1, 0], len: r * 1.6 * c.k, r: r * 0.42,
          n: 1, seg: 5, col, glowTip: c.g, glowCol: c.glow });
      }
    },
    glands(m, M, c) {
      const u = M.u, sac = c.tint(mixHex(M.spec.belly, 0x9ad84a, 0.55)), core = c.tint(0xd8ff7a);
      const per = 3 + Math.floor(m.plus / 2), r = 0.12 * u * c.sk;
      [-1, 1].forEach((s) => {
        for (let j = 0; j < per; j++) {
          const t = 0.62 - (j / Math.max(1, per - 1)) * 1.3;
          const S0 = M.surf(t, s * 1.15, _s0);
          ico(M.body.solid, r, 0, sac, S0.x + S0.nx * r * 0.35, S0.y + S0.ny * r * 0.35, S0.z + S0.nz * r * 0.35);
          ico(c.g ? M.body.glow : M.body.solid, r * 0.55, 0, c.g ? c.glow : core, S0.x + S0.nx * r * 0.95, S0.y + S0.ny * r * 0.95, S0.z + S0.nz * r * 0.95);
        }
      });
    },
    musk(m, M, c) {
      const u = M.u, white = c.g ? c.glow : c.tint(0xf4f4ee), sac = c.tint(mixHex(M.spec.belly, 0xb0a060, 0.4));
      const w = 0.13 * u * c.sk, C = c.g ? M.body.glow : M.body.solid;
      [-1, 1].forEach((s) => {
        for (let j = 0; j < 9; j++) {
          const S0 = M.surf(0.86 - j * 0.21, s * 0.34, _s0);
          const p = at(S0, 0.01 * u);
          orient(C, new THREE.BoxGeometry(w, 0.05 * u, 0.25 * u), 0.05 * u, white, p[0], p[1], p[2], S0.nx, S0.ny, S0.nz);
        }
        const S1 = M.surf(-0.95, s * 2.2, _s1);
        ico(M.body.solid, 0.14 * u * c.sk, 0, sac, S1.x, S1.y, S1.z - 0.04 * u);
      });
    },
    capsid(m, M, c) {
      const u = M.u, stalk = c.tint(lighten(M.spec.accent, 0.1)), knob = c.tint(0xfff05a);
      const n = 18 + m.plus * 3;
      for (let i = 0; i < n; i++) {
        const t = frac(i * 0.7548777 + 0.05) * 1.9 - 0.95;
        const ph = (frac(i * 0.5698403 + 0.5) - 0.5) * 4.6;
        const S0 = M.surf(t, ph, _s0);
        const pts = horn(M.body, { p: at(S0, 0.03 * u), d: [S0.nx, S0.ny, S0.nz], len: 0.22 * u * c.k * (0.8 + 0.4 * hash(i, 11)), r: 0.035 * u, r1: 0.6, n: 1, seg: 4, col: stalk });
        const tp = pts[1];
        ico(c.g ? M.body.glow : M.body.solid, 0.055 * u * c.sk, 0, c.g ? c.glow : knob, tp[0], tp[1], tp[2]);
      }
    },
  };

  /** Mutasyonları beden bağlamına (M) kurar; biri bozulursa diğerleri yine çizilir. */
  function addMutations(muts, M) {
    const cfgR = (EV.CFG && EV.CFG.RARITY) || [];
    muts.forEach((m) => {
      const tintAmt = cfgR[m.rarity] && Number.isFinite(cfgR[m.rarity].tint) ? cfgR[m.rarity].tint : MUT_TINT[m.rarity];
      const k = 1 + 0.085 * m.plus;
      const c = { k, sk: Math.sqrt(k), g: !!m.glow, glow: m.color, tint: (hex) => mixHex(hex, m.color, tintAmt) };
      try { MUT[m.kind](m, M, c); } catch (err) { console.warn('Mutasyon çizilemedi:', m.kind, err); }
    });
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
    const muts = mutations(spec);
    const skip = mutSkip(muts);
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
    if (spikes && !skip.spikes) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        cone(body.solid, R * 0.11, R * 0.55, 4, spec.accent,
          Math.sin(a) * R * 1.0, Y + R * 0.45, Math.cos(a) * R * 1.1, Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
      }
    }
    addExtras(spec, { body, head, S, topY: Y + R * 0.7, len: R * 2.2, wid: R * 1.6, headTop: Y + R * 0.6, headZ: R * 1.0, hasSpikes: spikes, hasHorns: false, skip });

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
    const flagTips = [];          // her kamçının uç boğumu (kuyruk mutasyonu buraya)
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
        if (i === 2) flagTips.push({ g: seg, len, w });
        parent = seg;
        z = -len;
        w *= 0.82;
      }
    }
    if (tail) tail.userData.segments = segs;

    /* --- mutasyonlar (hitbox ölçümünden sonra; aynı kemiklere) --- */
    if (muts.length) {
      const mb = new Parts();
      const ft = flagTips[Math.floor(flagTips.length / 2)] || null;
      const tp = ft ? new Parts() : mb;
      const feet = [];
      [-1, 1].forEach((s) => {
        feet.push({ P: mb, x: s * R * 0.8, y: Y - R * 0.42, z: R * 0.35, fx: s * 0.75, fz: 0.66, s: 0.9 });
        feet.push({ P: mb, x: s * R * 0.82, y: Y - R * 0.4, z: -R * 0.42, fx: s * 0.9, fz: 0.44, s: 0.8 });
      });
      addMutations(muts, {
        cell: true, u: S * 0.95, spec, body: mb,
        surf: cellSurf(Y, R, R * 0.78, R * 1.26),
        jaw: { P: mb, x: 0, y: Y, z: R * 1.2, w: R * 0.34 },
        top: { P: mb, x: 0, y: Y + R * 0.7, z: R * 0.45, w: R * 0.42 },
        feet,
        tail: ft ? { P: tp, x: 0, y: 0, z: -ft.len, w: ft.w } : { P: mb, x: 0, y: Y, z: -R * 1.24, w: R * 0.25 },
      });
      bake(rig, mb, mats);
      if (ft) bake(ft.g, tp, mats);
    }

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
    const muts = mutations(spec);
    const skip = mutSkip(muts);

    /* --- gövde --- */
    const body = new Parts();
    box(body.solid, W, H, D, bodyCol, 0, hipY, 0);
    box(body.solid, W * 0.86, H * 0.3, D * 0.9, spec.belly, 0, hipY - H * 0.42, 0);
    box(body.solid, W * 1.12, H * 0.9, D * 0.42, spec.accent, 0, hipY + 0.1 * S, D * 0.26);

    const spikes = !!p.spikes && !skip.spikes;
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
    if (p.fangs && !skip.fangs) [-1, 1].forEach((s) => box(head.solid, 0.1 * S, 0.38 * S, 0.1 * S, 0xf4efe0, s * hw * 0.24, -0.3 * S, hd * 1.08));
    if (p.ears) [-1, 1].forEach((s) => box(head.solid, 0.22 * S, 0.44 * S, 0.12 * S, spec.accent, s * hw * 0.4, 0.62 * S, hd * 0.2, 0, 0, s * 0.22));
    const horns = !!p.horns && !skip.horns;
    if (horns) [-1, 1].forEach((s) => cone(head.solid, 0.15 * S, 0.8 * S, 5, 0xe8dcc0, s * hw * 0.42, 0.72 * S, hd * 0.34, -0.25, 0, -s * 0.42));

    addExtras(spec, {
      body, head, S, topY: hipY + H * 0.5, len: D, wid: W,
      headTop: 0.6 * S, headZ: hd, hasSpikes: spikes, hasHorns: horns, skip,
    });
    bake(rig, body, mats);
    bake(neck, head, mats);

    /* --- bacaklar --- */
    const legs = [];
    const claws = has(spec, 'claws') && !skip.claws;
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
    let tailTip = null;           // son boğum (kuyruk mutasyonu buraya)
    if (p.tail && p.tail !== 'none') {
      tail = new THREE.Group();
      tail.position.set(0, hipY - 0.05 * S, -D * 0.5);
      rig.add(tail);
      const cfg = { long: { n: 4, len: 0.62, taper: 0.8, w: 0.5 }, short: { n: 2, len: 0.34, taper: 0.75, w: 0.42 },
        bushy: { n: 3, len: 0.52, taper: 0.94, w: 0.62 }, serpent: { n: 7, len: 0.55, taper: 0.88, w: 0.62 },
        fan: { n: 2, len: 0.5, taper: 1.3, w: 0.5 } }[p.tail] || { n: 3, len: 0.5, taper: 0.85, w: 0.5 };
      let parent = tail, w = cfg.w * S, z = 0;
      const segs = [];
      const tuft = has(spec, 'tuft') && !skip.tuft;
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
        tailTip = { g, w, len };
        parent = g;
        z = -len;
        w *= cfg.taper;
      }
      tail.userData.segments = segs;
    }

    /* --- mutasyonlar (hitbox ölçümünden sonra; aynı kemiklere) --- */
    if (muts.length) {
      const mb = new Parts(), mh = new Parts();
      const legParts = legs.map((L) => ({ P: new Parts(), g: L }));
      const feet = legParts.map((f) => ({ P: f.P, x: 0, y: -legLen * 0.68 - 0.03 * S, z: 0.32 * S, fx: 0, fz: 1, s: 1 }));
      if (isBiped) [-1, 1].forEach((s) => feet.push({ P: mb, x: s * W * 0.55, y: hipY - 0.17 * S, z: D * 0.3 - 0.08 * S, fx: 0, fz: 1, s: 0.6 }));
      if (isSnake) [-1, 1].forEach((s) => feet.push({ P: mb, x: s * W * 0.5, y: hipY - H * 0.25, z: -D * 0.32, fx: s * 0.55, fz: -0.83, s: 0.8, nc: 1 }));
      const tp = tailTip ? new Parts() : mb;
      addMutations(muts, {
        cell: false, u: S, spec, body: mb,
        surf: landSurf(hipY, W, H, D),
        jaw: { P: mh, x: 0, y: -0.2 * S, z: hd * 1.12, w: hw * 0.26 },
        top: { P: mh, x: 0, y: 0.58 * S, z: hd * 0.34, w: hw * 0.5 },
        feet,
        tail: tailTip ? { P: tp, x: 0, y: 0, z: -tailTip.len, w: tailTip.w } : { P: mb, x: 0, y: hipY, z: -D * 0.5, w: 0.3 * S },
      });
      bake(rig, mb, mats);
      bake(neck, mh, mats);
      legParts.forEach((f) => bake(f.g, f.P, mats));
      if (tailTip) bake(tailTip.g, tp, mats);
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
