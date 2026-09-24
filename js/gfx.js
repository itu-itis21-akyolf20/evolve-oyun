/* ============================================================
   gfx.js — görüntü kalitesi: ton eşleme, gökyüzü, gölge, çim,
   havadaki parçacıklar ve FPS'e göre otomatik kalite

   Kalite seviyeleri (low / med / high):
     pixelRatio · gölge (harita boyutu) · çim yoğunluğu · arazi çözünürlüğü
   'auto' modda ilk açılışta cihaza göre seçilir (telefon = low),
   oyun sırasında FPS 40'ın altına düşerse bir kademe iner.

   Çim: tek çizim çağrısı, sabit sayıda tel. Teller oyuncunun etrafındaki
   bir karoya sarılır (karo oyuncuyla kayar); yükseklik GPU'da arazi
   fonksiyonuyla hesaplanır (world.js height() ile AYNI formül).
   ============================================================ */
window.EV = window.EV || {};

EV.GFX = (function () {
  'use strict';

  const U = EV.U;
  const STORE = 'evolve_gfx';
  const LEVELS = {
    low:  { name: 'Düşük',  pr: 1.0,  shadows: false, shadowSize: 0,    grass: 3500,  grassR: 30, seg: 150, motes: 150, fog: 1.0,  creatureShadows: false, decor: 0.6 },
    med:  { name: 'Orta',   pr: 1.25, shadows: true,  shadowSize: 1024, grass: 9000,  grassR: 40, seg: 200, motes: 300, fog: 1.15, creatureShadows: false, decor: 0.85 },
    high: { name: 'Yüksek', pr: 1.5,  shadows: true,  shadowSize: 2048, grass: 16000, grassR: 48, seg: 240, motes: 450, fog: 1.3,  creatureShadows: true, decor: 1 },
  };
  const ORDER = ['low', 'med', 'high'];
  const mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);

  let renderer = null, scene = null, camera = null, sun = null;
  let pref = 'auto';
  let level = 'high';
  try { pref = localStorage.getItem(STORE) || 'auto'; } catch (e) { /* gizli sekme */ }
  if (!LEVELS[pref] && pref !== 'auto') pref = 'auto';
  level = pref === 'auto' ? (mobile ? 'low' : 'high') : pref;

  const Q = () => LEVELS[level];

  /* =========================================================
     Arazi yüksekliği (GLSL) — world.js height() ile aynı
     ========================================================= */
  const HEIGHT_GLSL = `
    uniform float uHScale;
    uniform float uSize;
    float terrainH(vec2 p) {
      float h = 0.0;
      h += sin(p.x * 0.041) * cos(p.y * 0.037) * 3.4;
      h += sin(p.x * 0.098 + 1.7) * cos(p.y * 0.086 - 0.9) * 1.5;
      h += sin((p.x + p.y) * 0.019 + 0.4) * 2.1;
      h += sin(p.x * 0.21) * sin(p.y * 0.19) * 0.55;
      h *= uHScale;
      float d = max(abs(p.x), abs(p.y)) / (uSize * 0.5);
      if (d > 0.72) h += (d - 0.72) * (d - 0.72) * 190.0;
      return h;
    }`;

  /* =========================================================
     Gökyüzü kubbesi
     ========================================================= */
  let sky = null;
  const skyU = {
    uZenith: { value: new THREE.Color(0x5a9ad8) },
    uHorizon: { value: new THREE.Color(0xcfe3f0) },
    uGround: { value: new THREE.Color(0x8a8a70) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
    uSunCol: { value: new THREE.Color(0xfff2cc) },
    uWater: { value: 0 },
    uTime: { value: 0 },
  };

  function buildSky() {
    const geo = new THREE.SphereGeometry(1, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;                         // hep en uzakta
        }`,
      fragmentShader: `
        uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunCol;
        uniform float uWater, uTime;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
          col = mix(col, uGround, clamp(-h * 4.0, 0.0, 1.0));
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          if (uWater > 0.5) {
            // su altı: yukarıdan süzülen ışık huzmeleri
            float rays = 0.5 + 0.5 * sin(atan(d.z, d.x) * 22.0 + uTime * 0.4) * sin(atan(d.z, d.x) * 9.0 - uTime * 0.25);
            col += uSunCol * rays * pow(clamp(h, 0.0, 1.0), 2.0) * 0.18;
            col += uSunCol * pow(s, 12.0) * 0.25;
          } else {
            col += uSunCol * (pow(s, 900.0) * 2.2 + pow(s, 24.0) * 0.28 + pow(s, 4.0) * 0.08);
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    sky = new THREE.Mesh(geo, mat);
    sky.scale.setScalar(380);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    scene.add(sky);
  }

  /* =========================================================
     Çim / yosun alanı
     ========================================================= */
  let grass = null;
  const grassU = {
    uCenter: { value: new THREE.Vector2() },
    uTile: { value: 96 },
    uTime: { value: 0 },
    uBase: { value: new THREE.Color(0x3f7a2e) },
    uTip: { value: new THREE.Color(0x9fd05a) },
    uHeight: { value: 0.9 },
    uDensity: { value: 1 },
    uSway: { value: 0.25 },
    uHScale: { value: 1 },
    uSize: { value: 720 },
  };

  function bladeGeometry() {
    // 3 çapraz yaprak, her biri 2 üçgen (sivri uç)
    const pos = [], hy = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      const cx = Math.cos(a), cz = Math.sin(a);
      const w = 0.07;
      const P = (x, y) => [cx * x + (k - 1) * 0.05, y, cz * x];
      const v = [P(-w, 0), P(w, 0), P(w * 0.5, 0.55), P(-w * 0.5, 0.55), P(0, 1)];
      [[0, 1, 2], [0, 2, 3], [3, 2, 4]].forEach((t) => t.forEach((i) => { pos.push(...v[i]); hy.push(v[i][1]); }));
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('hy', new THREE.Float32BufferAttribute(hy, 1));
    return g;
  }

  function buildGrass() {
    if (grass) { scene.remove(grass); grass.geometry.dispose(); grass.material.dispose(); grass = null; }
    const q = Q();
    const g = bladeGeometry();
    const n = q.grass;
    const R = q.grassR;
    grassU.uTile.value = R * 2;
    const off = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      off[i * 3] = U.rand(-R, R);
      off[i * 3 + 1] = U.rand(-R, R);
      off[i * 3 + 2] = Math.random();
    }
    g.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3));
    g.instanceCount = n;
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec3 offset;
          attribute float hy;
          uniform vec2 uCenter;
          uniform float uTile, uTime, uHeight, uDensity, uSway;
          varying float vHy;
          varying float vRnd;
          ${HEIGHT_GLSL}`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        .replace('#include <begin_vertex>', `
          vec2 wp = offset.xy + floor((uCenter - offset.xy) / uTile + 0.5) * uTile;
          float edge = 1.0 - smoothstep(uTile * 0.36, uTile * 0.5, length(wp - uCenter));
          float keep = step(offset.z, uDensity);
          float sc = (0.55 + fract(offset.z * 7.31) * 0.9) * uHeight * edge * keep;
          float ang = offset.z * 43.0;
          vec3 p = position;
          p = vec3(p.x * cos(ang) - p.z * sin(ang), p.y, p.x * sin(ang) + p.z * cos(ang)) * sc;
          float w = sin(uTime * 1.8 + wp.x * 0.23 + wp.y * 0.17) + 0.5 * sin(uTime * 3.1 + wp.x * 0.6);
          p.x += w * uSway * hy * hy * sc;
          p.z += w * uSway * 0.5 * hy * hy * sc;
          vec3 transformed = vec3(wp.x, terrainH(wp) - 0.05, wp.y) + p;
          vHy = hy;
          vRnd = fract(offset.z * 13.7);`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uBase, uTip;
          varying float vHy;
          varying float vRnd;`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4(mix(uBase, uTip, vHy) * (0.82 + vRnd * 0.3), 1.0);');
    };
    grass = new THREE.Mesh(g, mat);
    grass.frustumCulled = false;
    grass.receiveShadow = !!q.shadows;
    scene.add(grass);
  }

  /* =========================================================
     Havadaki parçacıklar (toz / polen / su altı kabarcık ve tortu)
     ========================================================= */
  let motes = null;
  const MOTE_R = 26;
  function buildMotes() {
    if (motes) { scene.remove(motes); motes.geometry.dispose(); motes.material.dispose(); motes = null; }
    const n = Q().motes;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = U.rand(-MOTE_R, MOTE_R);
      pos[i * 3 + 1] = U.rand(0, 14);
      pos[i * 3 + 2] = U.rand(-MOTE_R, MOTE_R);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false }));
    motes.frustumCulled = false;
    scene.add(motes);
  }

  function updateMotes(dt, center, t) {
    if (!motes) return;
    const p = motes.geometry.attributes.position;
    const a = p.array;
    const rise = stageWater ? 0.6 : 0.12;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += Math.sin(t * 0.5 + i) * 0.15 * dt;
      a[i + 1] += rise * dt * (0.5 + (i % 7) / 7);
      a[i + 2] += Math.cos(t * 0.4 + i) * 0.15 * dt;
      // oyuncunun çevresine sar
      let dx = a[i] - center.x, dz = a[i + 2] - center.z;
      if (dx > MOTE_R) a[i] -= MOTE_R * 2; else if (dx < -MOTE_R) a[i] += MOTE_R * 2;
      if (dz > MOTE_R) a[i + 2] -= MOTE_R * 2; else if (dz < -MOTE_R) a[i + 2] += MOTE_R * 2;
      const gy = EV.World.height(a[i], a[i + 2]);
      if (a[i + 1] > gy + 16) a[i + 1] = gy + 0.5; else if (a[i + 1] < gy) a[i + 1] = gy + 8;
    }
    p.needsUpdate = true;
  }

  /* =========================================================
     Yer gölgesi lekeleri: tüm yaratıklar için TEK örneklenmiş mesh
     ========================================================= */
  const BLOB_MAX = 320;
  let blobs = null;
  const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bp = new THREE.Vector3();
  function buildBlobs() {
    const g = new THREE.CircleGeometry(1, 14);
    g.rotateX(-Math.PI / 2);
    blobs = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }), BLOB_MAX);
    blobs.frustumCulled = false;
    blobs.renderOrder = 1;
    scene.add(blobs);
  }

  function updateBlobs(game) {
    if (!blobs || !game) return;
    let n = 0;
    const put = (grp, alive) => {
      const u = grp && grp.userData;
      if (!u || !u.blobR || !alive || !grp.visible || n >= BLOB_MAX) return;
      const p = grp.position;
      const sh = u.realShadow ? 0.5 : 1;                 // gerçek gölge varsa leke silik
      _bp.set(p.x, EV.World.height(p.x, p.z) + 0.07, p.z);
      _bs.set(u.blobR * sh + 0.001, 1, u.blobR * sh + 0.001);
      blobs.setMatrixAt(n++, _bm.compose(_bp, _bq, _bs));
    };
    if (game.player && game.player.group) put(game.player.group, game.player.alive);
    for (let i = 0; i < game.enemies.length; i++) { const e = game.enemies[i]; put(e.group, e.alive); }
    blobs.count = n;
    blobs.instanceMatrix.needsUpdate = true;
  }

  /* =========================================================
     Kurulum ve aşama
     ========================================================= */
  let stageWater = false;

  function init(r, sc, cam, sunLight) {
    renderer = r; scene = sc; camera = cam; sun = sunLight;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    buildSky();
    buildBlobs();
    applyLevel(level, true);
  }

  function applyLevel(l, first) {
    level = l;
    const q = Q();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = q.shadows;
    if (sun) {
      sun.castShadow = q.shadows;
      if (q.shadows) {
        sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
        const c = sun.shadow.camera;
        c.left = -42; c.right = 42; c.top = 42; c.bottom = -42; c.near = 1; c.far = 260;
        c.updateProjectionMatrix();
        sun.shadow.bias = -0.0006;
        sun.shadow.normalBias = 0.04;
      }
    }
    buildGrass();
    buildMotes();
    if (!first) {
      // gölge açılıp kapandıysa materyaller yeniden derlenmeli
      scene.traverse((o) => {
        if (!o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
        if (o.isMesh && o.userData.shadowCast) o.castShadow = castFor(o.userData.shadowCast);
      });
      if (EV.Game && EV.Game.stage) applyStage(EV.Game.stage());
    }
  }

  /** Aşamaya göre gökyüzü, çim ve parçacık renkleri. */
  function applyStage(stage) {
    const pal = stage.palette;
    stageWater = stage.kind === 'cell';
    const hor = new THREE.Color(pal.fog);
    const zen = new THREE.Color(pal.sky);
    if (stageWater) {
      zen.offsetHSL(0, 0.05, 0.12);                   // yüzeye doğru aydınlık
      hor.offsetHSL(0, 0.0, -0.06);
    } else {
      zen.lerp(new THREE.Color(0x3f7fd0), 0.55);      // tepede derin mavi
    }
    skyU.uZenith.value.copy(zen);
    skyU.uHorizon.value.copy(hor);
    skyU.uGround.value.set(pal.low);
    skyU.uSunCol.value.set(pal.sun);
    skyU.uWater.value = stageWater ? 1 : 0;
    scene.background = null;
    if (scene.fog) {
      scene.fog.color.copy(hor);
      const f = stage.fog || [70, 190];
      scene.fog.near = f[0] * Q().fog;
      scene.fog.far = f[1] * Q().fog;
      // sisin arkası görünmez: çizme (uzak dekor parçaları kamera kesiminde elenir)
      if (camera) { camera.far = Math.min(420, scene.fog.far * 1.08); camera.updateProjectionMatrix(); }
    }
    const G = {
      cell:    { base: 0x2a7a58, tip: 0x6ad8a8, h: 1.3, dens: 0.3,  sway: 0.45 },
      reptile: { base: 0xb09a5a, tip: 0xeadcaa, h: 0.5, dens: 0.16, sway: 0.15 },
      mammal:  { base: 0x4f8a34, tip: 0xa8d864, h: 0.8, dens: 0.9,  sway: 0.3 },
    }[stage.id] || { base: 0x3a6a24, tip: 0x9ccf58, h: 0.9, dens: 1, sway: 0.25 };
    grassU.uBase.value.set(G.base);
    grassU.uTip.value.set(G.tip);
    grassU.uHeight.value = G.h;
    grassU.uDensity.value = G.dens;
    grassU.uSway.value = G.sway;
    if (motes) {
      motes.material.color.set(stageWater ? 0xcff5ff : stage.id === 'reptile' ? 0xf2e2b0 : 0xfff6c8);
      motes.material.size = stageWater ? 0.14 : 0.09;
      motes.material.opacity = stageWater ? 0.6 : 0.45;
    }
  }

  function setTerrain(hScale, size) {
    grassU.uHScale.value = hScale;
    grassU.uSize.value = size;
  }

  /** Gölge atacak mı: 'player' | 'boss' her zaman (gölge açıksa), 'creature' sadece yüksekte, 'decor' açıksa. */
  function castFor(kind) {
    const q = Q();
    if (!q.shadows) return false;
    return kind === 'creature' ? q.creatureShadows : true;
  }

  /* ---------------- kare ---------------- */
  let tAcc = 0, fAcc = 0, fN = 0, slowSecs = 0;
  function update(dt, realDt, center) {
    tAcc += dt;
    grassU.uTime.value = tAcc;
    skyU.uTime.value = tAcc;
    if (sky && camera) sky.position.copy(camera.position);
    if (center) {
      grassU.uCenter.value.set(center.x, center.z);
      updateMotes(dt, center, tAcc);
      if (sun && sun.castShadow) {
        // gölge kutusu oyuncuyu izler; 2 m'lik adımlarla (kayma titremesin)
        const sx = Math.round(center.x / 2) * 2, sz = Math.round(center.z / 2) * 2;
        sun.position.set(sx + 70, center.y + 110, sz + 45);
        sun.target.position.set(sx, center.y, sz);
        sun.target.updateMatrixWorld();
        skyU.uSunDir.value.set(70, 110, 45).normalize();
      }
    }
    // otomatik kalite: 3 sn ortalaması 40 FPS'in altındaysa bir kademe in
    if (pref === 'auto' && realDt > 0) {
      fAcc += realDt; fN++;
      if (fAcc >= 3) {
        const avg = fAcc / fN;
        slowSecs = avg > 1 / 40 ? slowSecs + fAcc : 0;
        fAcc = 0; fN = 0;
        const i = ORDER.indexOf(level);
        if (slowSecs >= 6 && i > 0) {
          slowSecs = 0;
          applyLevel(ORDER[i - 1]);
          if (EV.Game && EV.Game.toast) EV.Game.toast('Grafik kalitesi: ' + Q().name + ' (FPS için)', '#cfc6b8', 1500);
        }
      }
    }
  }

  /** Kullanıcı tercihi: 'auto' | 'low' | 'med' | 'high'. */
  function setPref(p) {
    pref = LEVELS[p] || p === 'auto' ? p : 'auto';
    try { localStorage.setItem(STORE, pref); } catch (e) { /* gizli sekme */ }
    applyLevel(pref === 'auto' ? (mobile ? 'low' : 'high') : pref);
  }

  return {
    init, applyStage, setTerrain, update, updateBlobs, setPref, castFor, HEIGHT_GLSL,
    get level() { return level; }, get pref() { return pref; }, get seg() { return Q().seg; }, get decor() { return Q().decor; },
    LEVELS, mobile,
  };
})();
