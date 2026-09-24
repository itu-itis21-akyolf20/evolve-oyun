/* ============================================================
   world.js — arazi, dekor, ışık, çarpışma ve yol bulma yardımcıları

   Arazi yüksekliği analitik bir fonksiyondan gelir; hem mesh
   hem varlık yerleşimi aynı kaynağı kullanır.
   Dekor tek geometride birleştirilir (≈3 çizim çağrısı).
   Engeller ızgaraya konur: kaçınma ve çarpışma sorguları O(yakın).
   ============================================================ */
window.EV = window.EV || {};

EV.World = (function () {
  'use strict';

  const T = EV.CFG.TUNE;
  const U = EV.U;
  const G = EV.Geo;
  const SIZE = T.worldSize;
  const PLAY = T.playRadius;
  const SEG = 128;
  const AREA = (SIZE / 260) * (SIZE / 260);   // dekor yoğunluğu harita büyüdükçe korunsun
  const n = (k) => Math.round(k * AREA);

  let scene = null;
  let terrain = null;
  let decorGroup = null;
  let hemi = null, sun = null;
  let pools = [];
  const obstacles = [];
  const covers = [];      // saklanma yerleri {x,z,r}

  /* ---------------- engel ızgarası ---------------- */
  const CELL = 8;
  const grid = new Map();
  const gkey = (cx, cz) => cx * 4096 + cz;

  function rebuildGrid() {
    grid.clear();
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const x0 = Math.floor((o.x - o.r) / CELL), x1 = Math.floor((o.x + o.r) / CELL);
      const z0 = Math.floor((o.z - o.r) / CELL), z1 = Math.floor((o.z + o.r) / CELL);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const k = gkey(cx, cz);
          let b = grid.get(k);
          if (!b) { b = []; grid.set(k, b); }
          b.push(o);
        }
      }
    }
  }

  const _near = [];
  const _seen = new Set();
  /** (x,z) çevresinde r içinde kalabilecek engeller (tekrarsız). */
  function nearObstacles(x, z, r) {
    _near.length = 0;
    _seen.clear();
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const b = grid.get(gkey(cx, cz));
        if (!b) continue;
        for (let i = 0; i < b.length; i++) {
          if (!_seen.has(b[i])) { _seen.add(b[i]); _near.push(b[i]); }
        }
      }
    }
    return _near;
  }

  /* ---------------- arazi yüksekliği ---------------- */
  let hScale = 1;
  let hover = 0;

  function height(x, z) {
    let h = 0;
    h += Math.sin(x * 0.041) * Math.cos(z * 0.037) * 3.4;
    h += Math.sin(x * 0.098 + 1.7) * Math.cos(z * 0.086 - 0.9) * 1.5;
    h += Math.sin((x + z) * 0.019 + 0.4) * 2.1;
    h += Math.sin(x * 0.21) * Math.sin(z * 0.19) * 0.55;
    h *= hScale;
    const d = Math.max(Math.abs(x), Math.abs(z)) / (SIZE * 0.5);
    if (d > 0.72) h += (d - 0.72) * (d - 0.72) * 190;
    return h;
  }

  function groundY(x, z) { return height(x, z) + hover; }

  function slopeAt(x, z) {
    const e = 1.2;
    const hx = height(x + e, z) - height(x - e, z);
    const hz = height(x, z + e) - height(x, z - e);
    return Math.sqrt(hx * hx + hz * hz) / (2 * e);
  }

  /* ---------------- su havuzları ---------------- */
  function findPools() {
    const out = [];
    const step = 11;
    for (let x = -SIZE / 2 + step; x < SIZE / 2 - step; x += step) {
      for (let z = -SIZE / 2 + step; z < SIZE / 2 - step; z += step) {
        const h = height(x, z);
        if (h > -1.6) continue;
        let isMin = true;
        for (let a = 0; a < 8 && isMin; a++) {
          const ang = (a / 8) * Math.PI * 2;
          if (height(x + Math.cos(ang) * 6, z + Math.sin(ang) * 6) < h) isMin = false;
        }
        if (isMin) out.push({ x, z, r: U.rand(5, 10), h });
      }
    }
    return out.slice(0, 22);
  }

  function isInPool(x, z, pad) {
    for (let i = 0; i < pools.length; i++) {
      const p = pools[i];
      const dx = x - p.x, dz = z - p.z;
      const rr = p.r + (pad || 0);
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  /* ---------------- arazi mesh ---------------- */
  function buildTerrain() {
    let geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const idx = geo.toNonIndexed();
    geo.dispose();
    geo = idx;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    terrain = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      shininess: 0, specular: 0x000000, vertexColors: true, flatShading: true,
    }));
    terrain.frustumCulled = false;
    scene.add(terrain);
    reshapeTerrain();
  }

  function reshapeTerrain() {
    const pos = terrain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
    pos.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
  }

  function paintTerrain(pal) {
    const pos = terrain.geometry.attributes.position;
    const col = terrain.geometry.attributes.color;
    const cLow = new THREE.Color(pal.low), cMid = new THREE.Color(pal.mid), cHigh = new THREE.Color(pal.high);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const hAvg = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const t = U.clamp((hAvg + 4) / 9, 0, 1);
      if (t < 0.5) tmp.copy(cLow).lerp(cMid, t * 2);
      else tmp.copy(cMid).lerp(cHigh, (t - 0.5) * 2);
      tmp.offsetHSL(0, 0, (U.hash2(Math.round(cx * 3), Math.round(cz * 3)) - 0.5) * 0.09);
      for (let k = 0; k < 3; k++) col.setXYZ(i + k, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
  }

  /* ---------------- dekor parçaları ---------------- */
  function addRock(col, x, y, z, size, pal) {
    const n = U.randInt(2, 4);
    for (let i = 0; i < n; i++) {
      const s = size * U.rand(0.5, 1.0);
      col.add(new THREE.DodecahedronGeometry(s, 0),
        G.xform(x + U.rand(-size, size) * 0.6, y + s * U.rand(0.25, 0.5), z + U.rand(-size, size) * 0.6,
          U.rand(0, 3), U.rand(0, 3), U.rand(0, 3), 1, U.rand(0.55, 0.9), 1),
        i === 0 ? pal.rock : pal.rockDark);
    }
  }

  function addCrystal(col, x, y, z, size, pal) {
    const n = U.randInt(2, 4);
    for (let i = 0; i < n; i++) {
      const h = size * U.rand(1.6, 3.4);
      col.add(new THREE.ConeGeometry(size * U.rand(0.25, 0.5), h, 5),
        G.xform(x + U.rand(-1, 1) * size, y + h * 0.45, z + U.rand(-1, 1) * size,
          U.rand(-0.22, 0.22), U.rand(0, 3), U.rand(-0.22, 0.22)),
        pal.crystal);
    }
  }

  const LEAF = [0x4f8f3a, 0x3f7a2e, 0x63a648];
  function addTree(col, x, y, z, size) {
    const trunkH = size * U.rand(3.4, 4.8);
    col.add(new THREE.BoxGeometry(size * 0.42, trunkH, size * 0.42),
      G.xform(x, y + trunkH / 2, z, 0, U.rand(0, 3), 0), 0x6b4a2c);
    const blobs = U.randInt(5, 8);
    for (let i = 0; i < blobs; i++) {
      const s = size * U.rand(0.75, 1.35);
      col.add(new THREE.BoxGeometry(s, s * 0.8, s),
        G.xform(x + U.rand(-1, 1) * size * 0.75, y + trunkH + U.rand(-0.5, 0.9) * size, z + U.rand(-1, 1) * size * 0.75,
          U.rand(-0.15, 0.15), U.rand(0, 3), U.rand(-0.15, 0.15)),
        U.pick(LEAF));
    }
  }

  function addShrub(col, x, y, z, size, color) {
    const s = size * U.rand(0.6, 1.0);
    col.add(new THREE.BoxGeometry(s, s * 0.45, s), G.xform(x, y + s * 0.1, z, 0, U.rand(0, 3), 0), color);
  }

  function addAlga(col, x, y, z, size, color) {
    const seg = U.randInt(4, 7);
    let cy = y;
    const lean = U.rand(-0.16, 0.16), dir = U.rand(0, Math.PI * 2);
    for (let i = 0; i < seg; i++) {
      const h = size * U.rand(0.7, 1.1);
      const w = Math.max(size * (0.3 - i * 0.025), 0.07);
      col.add(new THREE.BoxGeometry(w, h, w),
        G.xform(x + Math.sin(dir) * lean * i * size, cy + h * 0.5, z + Math.cos(dir) * lean * i * size, 0, dir + i * 0.3, lean * 0.8),
        color);
      cy += h * 0.86;
    }
  }

  /** Engel sadece oynanabilir alan içindeyse eklenir (dışarısı zaten kapalı). */
  function addObstacle(x, z, r) {
    if (Math.hypot(x, z) < PLAY + r) obstacles.push({ x, z, r });
  }

  function clearDecor() {
    for (let i = decorGroup.children.length - 1; i >= 0; i--) {
      const m = decorGroup.children[i];
      m.geometry.dispose();
      m.material.dispose();
      decorGroup.remove(m);
    }
  }

  function addBaked(geo, opts) {
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial(Object.assign(
      { vertexColors: true, flatShading: true, shininess: 0, specular: 0x000000 }, opts)));
    mesh.frustumCulled = false;
    decorGroup.add(mesh);
  }

  /** Oyuncunun doğduğu merkezi boş tut: başlar başlamaz kayaya sıkışmasın. */
  const clearCenter = (x, z) => x * x + z * z < 14 * 14;

  function buildCellDecor(stage, solid, glassy) {
    const pal = stage.palette;
    for (let c = 0; c < n(48); c++) {
      const cx = U.rand(-SIZE / 2 + 14, SIZE / 2 - 14);
      const cz = U.rand(-SIZE / 2 + 14, SIZE / 2 - 14);
      if (clearCenter(cx, cz)) continue;
      const n = U.randInt(4, 9);
      for (let i = 0; i < n; i++) {
        const x = cx + U.rand(-6, 6), z = cz + U.rand(-6, 6);
        addAlga(solid, x, height(x, z) - 0.2, z, U.rand(0.8, 1.7), U.pick([0x2f8f5e, 0x287a52, 0x3aa86e]));
      }
      addObstacle(cx, cz, 3.0);
    }
    for (let i = 0; i < n(170); i++) {
      const x = U.rand(-SIZE / 2 + 8, SIZE / 2 - 8), z = U.rand(-SIZE / 2 + 8, SIZE / 2 - 8);
      if (clearCenter(x, z)) continue;
      const size = U.rand(0.5, 2.2);
      addRock(solid, x, height(x, z) - 0.3, z, size, pal);
      if (size > 1.7) addObstacle(x, z, size * 1.15);
    }
    for (let i = 0; i < n(22); i++) {
      const a = U.rand(0, Math.PI * 2), d = U.rand(SIZE * 0.36, SIZE * 0.46);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      addRock(solid, x, height(x, z) - 0.5, z, U.rand(3.0, 6.0), pal);
    }
    for (let i = 0; i < n(320); i++) {
      const x = U.rand(-SIZE / 2 + 6, SIZE / 2 - 6), z = U.rand(-SIZE / 2 + 6, SIZE / 2 - 6);
      glassy.add(new THREE.IcosahedronGeometry(U.rand(0.2, 0.55), 0),
        G.xform(x, height(x, z) + U.rand(1.0, 7.5), z, 0, U.rand(0, 3), 0), pal.crystal);
    }
  }

  function buildLandDecor(stage, solid, glassy, wet) {
    const pal = stage.palette;
    const isMammal = stage.id === 'mammal';

    pools.forEach((p) => {
      const disc = new THREE.CircleGeometry(p.r, 9);
      disc.rotateX(-Math.PI / 2);
      wet.add(disc, G.xform(p.x, p.h + 0.85, p.z), pal.water);
      const ring = U.randInt(3, 6);
      for (let i = 0; i < ring; i++) {
        const a = U.rand(0, Math.PI * 2);
        const rx = p.x + Math.cos(a) * (p.r + U.rand(0.5, 2.2));
        const rz = p.z + Math.sin(a) * (p.r + U.rand(0.5, 2.2));
        addRock(solid, rx, height(rx, rz) - 0.2, rz, U.rand(0.6, 1.3), pal);
      }
    });

    for (let i = 0; i < n(150); i++) {
      const x = U.rand(-SIZE / 2 + 8, SIZE / 2 - 8), z = U.rand(-SIZE / 2 + 8, SIZE / 2 - 8);
      if (isInPool(x, z, 3) || clearCenter(x, z)) continue;
      const size = U.rand(0.7, 2.6);
      addRock(solid, x, height(x, z) - 0.25, z, size, pal);
      if (size > 1.6) addObstacle(x, z, size * 1.2);
    }
    for (let i = 0; i < n(26); i++) {
      const a = U.rand(0, Math.PI * 2), d = U.rand(SIZE * 0.36, SIZE * 0.46);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      addRock(solid, x, height(x, z) - 0.5, z, U.rand(3.2, 6.5), pal);
    }
    const count = n(isMammal ? 90 : 46);
    for (let i = 0; i < count; i++) {
      const x = U.rand(-SIZE / 2 + 10, SIZE / 2 - 10), z = U.rand(-SIZE / 2 + 10, SIZE / 2 - 10);
      if (isInPool(x, z, 4) || clearCenter(x, z)) continue;
      const y = height(x, z) - 0.2;
      if (isMammal) addTree(solid, x, y, z, U.rand(0.9, 1.7));
      else addCrystal(glassy, x, y, z, U.rand(0.9, 2.0), pal);
      addObstacle(x, z, isMammal ? 1.2 : 1.7);
    }
    const shrubColor = isMammal ? 0x568f3d : 0xb8a45e;
    for (let i = 0; i < n(220); i++) {
      const x = U.rand(-SIZE / 2 + 6, SIZE / 2 - 6), z = U.rand(-SIZE / 2 + 6, SIZE / 2 - 6);
      if (isInPool(x, z, 2)) continue;
      addShrub(solid, x, height(x, z) - 0.05, z, U.rand(0.4, 0.9), shrubColor);
    }
  }

  /* ---------------- saklanma yerleri ----------------
     İçindeyken sıradan yaratıklar seni ancak dibine gelince fark eder,
     apex izini kaybeder. Saldırmak gizliliği 2 sn bozar.
     hücre: yoğun yosun ormanı · sürüngen: kaya kovuğu · memeli: uzun otlar */
  function buildCovers(stage, solid) {
    covers.length = 0;
    const count = stage.kind === 'cell' ? 16 : stage.id === 'reptile' ? 13 : 18;
    for (let c = 0, guard = 0; c < count && guard < 400; guard++) {
      const a = U.rand(0, Math.PI * 2), d = U.rand(22, PLAY - 12);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const r = U.rand(4.5, 7);
      if (isInPool(x, z, r) || covers.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 10)) continue;
      covers.push({ x, z, r });
      c++;
      if (stage.kind === 'cell') {
        for (let i = 0; i < 26; i++) {
          const aa = U.rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * r;
          const px = x + Math.cos(aa) * rr, pz = z + Math.sin(aa) * rr;
          addAlga(solid, px, height(px, pz) - 0.2, pz, U.rand(1.3, 2.2), U.pick([0x1f7a4c, 0x2a8f58, 0x187044]));
        }
      } else if (stage.id === 'reptile') {
        // kaya kovuğu: etrafı yüksek kayalarla çevrili, bir tarafı açık
        const gap = U.rand(0, Math.PI * 2);
        for (let i = 0; i < 9; i++) {
          const aa = gap + 0.6 + (i / 9) * (Math.PI * 2 - 1.2);
          const px = x + Math.cos(aa) * r, pz = z + Math.sin(aa) * r;
          addRock(solid, px, height(px, pz) - 0.3, pz, U.rand(1.6, 2.4), stage.palette);
          obstacles.push({ x: px, z: pz, r: 1.4 });
        }
        solid.add(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 0.08, 12), G.xform(x, height(x, z) + 0.05, z), 0x6b5a3a);
      } else {
        const cols = [0x6f9a3a, 0x5a8a2e, 0x86ad4a];
        for (let i = 0; i < 70; i++) {
          const aa = U.rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * r;
          const px = x + Math.cos(aa) * rr, pz = z + Math.sin(aa) * rr;
          const h = U.rand(2.6, 3.8);
          solid.add(new THREE.BoxGeometry(0.14, h, 0.14), G.xform(px, height(px, pz) + h / 2 - 0.2, pz, U.rand(-0.2, 0.2), U.rand(0, 3), U.rand(-0.2, 0.2)), U.pick(cols));
        }
      }
    }
  }

  /** Nokta bir saklanma yerinin içinde mi? */
  function inCover(x, z) {
    for (let i = 0; i < covers.length; i++) {
      const c = covers[i];
      if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < c.r * c.r) return c;
    }
    return null;
  }

  function buildDecor(stage) {
    clearDecor();
    obstacles.length = 0;
    const solid = new G.Collector(), glassy = new G.Collector(), wet = new G.Collector();

    if (stage.kind === 'cell') buildCellDecor(stage, solid, glassy);
    else buildLandDecor(stage, solid, glassy, wet);
    buildCovers(stage, solid);
    // saklanma yerlerinin içindeki engeller kaldırılır: içeri girilebilmeli
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (covers.some((c) => Math.hypot(o.x - c.x, o.z - c.z) < c.r - 0.8)) obstacles.splice(i, 1);
    }

    addBaked(solid.bake(), {});
    addBaked(glassy.bake(), { transparent: true, opacity: stage.kind === 'cell' ? 0.5 : 0.92 });
    addBaked(wet.bake(), { transparent: true, opacity: 0.86 });
    rebuildGrid();
  }

  /* ---------------- çarpışma ---------------- */
  /** Konumu engellerden ve oyun alanı sınırından dışarı iter (yerinde). */
  function resolveCollision(v, radius) {
    const list = nearObstacles(v.x, v.z, radius + 7);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const dx = v.x - o.x, dz = v.z - o.z;
      const minD = o.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD) {
        if (d2 < 1e-6) { v.x += minD; continue; }
        const d = Math.sqrt(d2);
        v.x = o.x + (dx / d) * minD;
        v.z = o.z + (dz / d) * minD;
      }
    }
    clampToPlay(v);
  }

  function clampToPlay(v) {
    const d = Math.hypot(v.x, v.z);
    if (d > PLAY) { v.x *= PLAY / d; v.z *= PLAY / d; }
  }

  /**
   * Engelden kaçınma: (x,z)'den dir yönüne giderken önündeki engele göre
   * yana sapma vektörü döndürür. Eskiden yaratıklar düz çizgide kovalayıp
   * kayaya yapışıyordu; çarpışma itmesi onları yerinde titretiyordu.
   */
  function avoid(x, z, dx, dz, radius, look, out) {
    out.x = 0; out.z = 0;
    const list = nearObstacles(x + dx * look * 0.5, z + dz * look * 0.5, look);
    let best = Infinity;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const ox = o.x - x, oz = o.z - z;
      const along = ox * dx + oz * dz;              // engelin önümüzdeki mesafesi
      if (along < -o.r || along > look + o.r) continue;
      const side = ox * -dz + oz * dx;              // yanal sapma (sol +)
      const clear = o.r + radius + 0.6;
      if (Math.abs(side) > clear) continue;
      if (along < best) {
        best = along;
        const push = (clear - Math.abs(side)) / clear;       // ne kadar tam karşıdaysa o kadar sert
        const dirSign = side >= 0 ? -1 : 1;                   // engelin ters tarafına
        out.x = -dz * dirSign * push * 1.6;
        out.z = dx * dirSign * push * 1.6;
      }
    }
    // oyun alanı kenarı: içeri doğru çek
    const d = Math.hypot(x, z);
    if (d > PLAY - 8) {
      const k = (d - (PLAY - 8)) / 8;
      out.x -= (x / d) * k;
      out.z -= (z / d) * k;
    }
    return out;
  }

  function blocked(x, z, pad) {
    const list = nearObstacles(x, z, pad + 7);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const dx = x - o.x, dz = z - o.z;
      if (dx * dx + dz * dz < (o.r + pad) * (o.r + pad)) return true;
    }
    return false;
  }

  /** Doğum için uygun nokta: alan içinde, suda/engelde/yokuşta değil. */
  function randomSpawn(near, minR, maxR, pad) {
    pad = pad == null ? 1.5 : pad;
    for (let tries = 0; tries < 30; tries++) {
      const a = U.rand(0, Math.PI * 2);
      const d = U.rand(minR, maxR);
      const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > PLAY - 4) continue;
      if (isInPool(x, z, 2) || slopeAt(x, z) > 1.4 || blocked(x, z, pad)) continue;
      return { x, z, y: height(x, z) };
    }
    const v = { x: near.x * 0.8, z: near.z * 0.8 };
    clampToPlay(v);
    return { x: v.x, z: v.z, y: height(v.x, v.z) };
  }

  /* ---------------- ışık & atmosfer ---------------- */
  function applyLight(stage) {
    const pal = stage.palette;
    const f = stage.fog || [70, 190];
    scene.background = new THREE.Color(pal.sky);
    scene.fog = new THREE.Fog(pal.fog, f[0], f[1]);
    hemi.color.setHex(pal.sun);
    hemi.groundColor.setHex(pal.low);
    sun.color.setHex(pal.sun);
    const wet = stage.kind === 'cell';
    hemi.intensity = wet ? 0.8 : 0.45;
    sun.intensity = wet ? 0.45 : 0.78;
  }

  function init(sc) {
    scene = sc;
    decorGroup = new THREE.Group();
    scene.add(decorGroup);
    hemi = new THREE.HemisphereLight(0xffffff, 0x888866, 0.45);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 0.78);
    sun.position.set(60, 90, 40);
    scene.add(sun);
    pools = findPools();
    buildTerrain();
  }

  function applyStage(stage) {
    hScale = stage.terrainScale == null ? 1 : stage.terrainScale;
    hover = stage.hover || 0;
    pools = findPools();
    reshapeTerrain();
    paintTerrain(stage.palette);
    buildDecor(stage);
    applyLight(stage);
  }

  return {
    init, applyStage, height, groundY, slopeAt, resolveCollision, clampToPlay,
    avoid, blocked, randomSpawn, isInPool, nearObstacles, obstacles, covers, inCover, SIZE, PLAY,
    get hover() { return hover; },
  };
})();
