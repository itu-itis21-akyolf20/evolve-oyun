/* ============================================================
   gfx.js — görüntü kalitesi: ton eşleme, gökyüzü, gölge, çim,
   zemin dokusu karışımı (splatting), su, havadaki parçacıklar ve
   FPS'e göre otomatik kalite

   Kalite seviyeleri (low / med / high):
     pixelRatio · gölge · çim · arazi çözünürlüğü · doku katmanı sayısı
   'auto' modda ilk açılışta cihaza göre seçilir (telefon = low),
   oyun sırasında FPS 40'ın altına düşerse bir kademe iner.

   Zemin: 4 gerçek fotoğraf dokusu (assets/textures.js, CC0) köşe
   ağırlıklarına (world.js) + doku parlaklığına göre karışır; uzakta
   ikinci (büyük) UV ölçeği tekrarı gizler. Su altında kostik ışık.
   Düşük kalitede 3 katman, tek ölçek, tek kostik örneği.

   Çim: tek çizim çağrısı, sabit sayıda tel. Teller oyuncunun etrafındaki
   bir karoya sarılır (karo oyuncuyla kayar); yükseklik GPU'da arazi
   fonksiyonuyla hesaplanır (world.js height() ile AYNI formül).
   Tel yoğunluğu ve rengi altındaki zemin katmanından okunur.
   ============================================================ */
window.EV = window.EV || {};

/* Işıksız (MeshBasic) materyaller = efektler: vuruş izi, halka, patlama, mermi, yer uyarıları.
   Sinema ton eşlemesi (ACES) bunları soldurup gri yapıyordu; varsayılan olarak ton eşlemesiz
   çizilsinler (açıkça toneMapped verilirse o geçerli). */
(function () {
  const Basic = THREE.MeshBasicMaterial;
  function VividBasic(p) {
    const m = new Basic(p);
    if (!p || p.toneMapped === undefined) m.toneMapped = false;
    return m;
  }
  VividBasic.prototype = Basic.prototype;
  THREE.MeshBasicMaterial = VividBasic;
})();

EV.GFX = (function () {
  'use strict';

  const U = EV.U;
  const STORE = 'evolve_gfx';
  // splat: zemin katmanı · far: uzak UV ölçeği · caus: kostik örneği · decorTex: kaya/yaprak dokusu
  const LEVELS = {
    low:  { name: 'Düşük',  pr: 1.0,  shadows: false, shadowSize: 0,    grass: 3500,  grassR: 30, seg: 150, motes: 150, fog: 1.0,  creatureShadows: false, decor: 0.6,
      splat: 3, far: 0, caus: 1, aniso: 2, decorTex: 0 },
    med:  { name: 'Orta',   pr: 1.25, shadows: true,  shadowSize: 1024, grass: 9000,  grassR: 40, seg: 200, motes: 300, fog: 1.15, creatureShadows: false, decor: 0.85,
      splat: 4, far: 1, caus: 2, aniso: 4, decorTex: 1 },
    high: { name: 'Yüksek', pr: 1.5,  shadows: true,  shadowSize: 2048, grass: 16000, grassR: 48, seg: 240, motes: 450, fog: 1.3,  creatureShadows: true, decor: 1,
      splat: 4, far: 1, caus: 2, aniso: 8, decorTex: 1 },
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
  const timeU = { value: 0 };                 // tüm gölgelendiricilerde ortak zaman

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
  const terrainU = { uHScale: { value: 1 }, uSize: { value: 720 } };

  /* =========================================================
     Dokular. assets/textures.js (base64 JPEG) <script> ile gelir:
     file:// üzerinde WebGL resim dosyasını doku yapamaz, script'i yükler.
     Gelene kadar her doku kendi ortalama rengi (düz renkli zemin).
     ========================================================= */
  const TEX_AVG = {
    grass: [0.378, 0.426, 0.19], meadow: [0.598, 0.576, 0.343], dirt: [0.583, 0.453, 0.307],
    rock: [0.658, 0.609, 0.55], sand: [0.648, 0.586, 0.436], cracked: [0.813, 0.662, 0.506],
    cliff: [0.513, 0.412, 0.315], mossrock: [0.431, 0.363, 0.205], ripples: [0.568, 0.524, 0.48],
  };
  const lumOf = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
  const texs = {};
  const scriptSrc = (document.currentScript && document.currentScript.src) || '';
  const BASE = scriptSrc.replace(/js\/gfx\.js(\?.*)?$/, '');
  let texRequested = false;

  function anisoFor() {
    const max = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
    return Math.max(1, Math.min(max, Q().aniso));
  }

  function solidCanvas(rgb) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 4;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgb(' + rgb.map((v) => Math.round(v * 255)).join(',') + ')';
    ctx.fillRect(0, 0, 4, 4);
    return cv;
  }

  const filled = new Set();
  function fillTex(id) {
    const t = texs[id];
    if (!t || filled.has(id) || !EV.TEXDATA || !EV.TEXDATA[id]) return;
    filled.add(id);
    const img = new Image();
    img.onload = () => { t.image = img; t.anisotropy = anisoFor(); t.needsUpdate = true; };
    img.onerror = () => { console.warn('Doku çözülemedi: ' + id); };
    img.src = EV.TEXDATA[id];
  }

  /** Zemin dokusu (paylaşımlı). Veri yoksa ortalama renkte yer tutucu. */
  function groundTex(id) {
    if (texs[id]) return texs[id];
    const t = new THREE.Texture(solidCanvas(TEX_AVG[id] || [0.5, 0.5, 0.5]));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    texs[id] = t;
    requestTextures();
    fillTex(id);
    return t;
  }

  function requestTextures() {
    if (texRequested || EV.TEXDATA) return;
    texRequested = true;
    const s = document.createElement('script');
    s.src = BASE + 'assets/textures.js';
    s.async = true;
    s.onerror = () => { console.warn('assets/textures.js yüklenemedi: zemin düz renkli kalır'); };
    document.head.appendChild(s);
  }

  /** assets/textures.js yüklenince çağırır. */
  function texturesArrived() { Object.keys(texs).forEach(fillTex); }

  /** Döşenebilir Worley kenar ağı: su altı kostik ışığı. */
  function causticTexture() {
    const S = 128, C = 5;
    const pts = [];
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([(i + U.rand(0.15, 0.85)) / C, (j + U.rand(0.15, 0.85)) / C]);
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = (x + 0.5) / S, v = (y + 0.5) / S;
        const ci = Math.floor(u * C), cj = Math.floor(v * C);
        let f1 = 9, f2 = 9;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ii = ci + di, jj = cj + dj;
            const wi = (ii + C) % C, wj = (jj + C) % C;
            const p = pts[wj * C + wi];
            const px = p[0] + (ii - wi) / C, py = p[1] + (jj - wj) / C;
            const d = Math.hypot(u - px, v - py) * C;
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
        }
        const e = f2 - f1;
        const c = Math.pow(Math.max(0, 1 - e / 0.5), 2.4) * 255;
        const k = (y * S + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = c;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /** Döşenebilir dalga normal haritası: tam sayı frekanslı sinüslerin toplamı. */
  function waterNormalTexture() {
    const S = 128;
    const waves = [];
    for (let i = 0; i < 14; i++) {
      const fx = U.randInt(-7, 7), fy = U.randInt(-7, 7) || 1;
      waves.push({ fx, fy, a: 1 / Math.hypot(fx, fy), ph: U.rand(0, Math.PI * 2) });
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let dx = 0, dy = 0;
        for (let i = 0; i < waves.length; i++) {
          const w = waves[i];
          const c = Math.cos(Math.PI * 2 * (w.fx * x + w.fy * y) / S + w.ph) * w.a;
          dx += c * w.fx; dy += c * w.fy;
        }
        const nx = -dx * 0.09, ny = -dy * 0.09;
        const l = Math.hypot(nx, ny, 1);
        const k = (y * S + x) * 4;
        img.data[k] = (nx / l * 0.5 + 0.5) * 255;
        img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255;
        img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  let causTex = null, waterNorm = null;
  const causU = () => causTex || (causTex = causticTexture());

  /* =========================================================
     Aşama başına zemin katmanları (sıra world.js ağırlıklarıyla aynı):
     0 taban · 1 leke · 2 leke (düşükte 0'a katılır) · 3 kaya
     tile: doku kaç metrede bir tekrarlar · tint: doku rengi çarpanı
     grass: katman başına çim yoğunluğu · caus: kostik şiddeti
     ========================================================= */
  const SPLAT = {
    cell: {
      tex: ['ripples', 'sand', 'dirt', 'cliff'], tile: [9, 4.5, 5, 9],
      tint: [[0.21, 0.44, 0.49], [0.21, 0.42, 0.46], [0.16, 0.32, 0.3], [0.27, 0.53, 0.58]],
      grass: [1, 0.7, 1.6, 0.15], groundMix: 0.35, caus: 1.5,
    },
    reptile: {
      tex: ['sand', 'cracked', 'dirt', 'cliff'], tile: [4.5, 5.5, 5, 9],
      tint: [[1.2, 1.1, 0.92], [0.95, 0.9, 0.82], [1.05, 0.98, 0.88], [1.3, 1.25, 1.2]],
      grass: [0.8, 0.35, 1.3, 0], groundMix: 0.5, caus: 0,
    },
    mammal: {
      tex: ['grass', 'dirt', 'meadow', 'mossrock'], tile: [3.2, 4.5, 4, 14],
      tint: [[0.86, 0.98, 0.82], [0.78, 0.72, 0.66], [0.84, 0.9, 0.76], [1.05, 1.08, 1.05]],
      grass: [1, 0.12, 0.75, 0], groundMix: 0.55, caus: 0,
    },
  };

  const splatU = {
    uL0: { value: null }, uL1: { value: null }, uL2: { value: null }, uL3: { value: null },
    uScale: { value: new THREE.Vector4(1, 1, 1, 1) },
    uAvgLum: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) },
    uTint: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] },
    uFar: { value: new THREE.Vector4(8, 55, 0.21, 0.18) },   // başlangıç m, bitiş m, uzak ölçek, yakında pay
    uBlend: { value: new THREE.Vector2(0.55, 0.14) },       // parlaklık katkısı, geçiş derinliği
    uCausTex: { value: null }, uCausAmt: { value: 0 }, uTime: timeU,
  };
  const layerCols = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];

  function setSplatStage(id) {
    const cfg = SPLAT[id] || SPLAT.mammal;
    ['uL0', 'uL1', 'uL2', 'uL3'].forEach((k, i) => { splatU[k].value = groundTex(cfg.tex[i]); });
    splatU.uScale.value.set(1 / cfg.tile[0], 1 / cfg.tile[1], 1 / cfg.tile[2], 1 / cfg.tile[3]);
    const lums = cfg.tex.map((t) => lumOf(TEX_AVG[t]));
    splatU.uAvgLum.value.set(lums[0], lums[1], lums[2], lums[3]);
    cfg.tint.forEach((t, i) => {
      splatU.uTint.value[i].setRGB(t[0], t[1], t[2]);
      const a = TEX_AVG[cfg.tex[i]];
      layerCols[i].setRGB(a[0] * t[0], a[1] * t[1], a[2] * t[2]);
    });
    splatU.uCausTex.value = causU();
    splatU.uCausAmt.value = cfg.caus;
    grassU.uGrassMask.value.set(cfg.grass[0], cfg.grass[1], cfg.grass[2], cfg.grass[3]);
    grassU.uGroundMix.value = cfg.groundMix;
  }

  /* =========================================================
     Arazi materyali: Lambert (sis + gölge + yarıküre/güneş) üstüne
     doku karışımı. Köşe rengi ince ton/leke katmanı olarak kalır.
     ========================================================= */
  const TERRAIN_FRAG = `
    uniform sampler2D uL0, uL1, uL2, uL3, uCausTex;
    uniform vec4 uScale, uAvgLum, uFar;
    uniform vec3 uTint[4];
    uniform vec2 uBlend;
    uniform float uCausAmt, uTime;
    varying vec4 vSplat;
    varying vec3 vWPos;
    varying float vDist;
    vec3 splatTex(sampler2D t, vec2 uv, float far) {
      vec3 c = texture2D(t, uv).rgb;
    #if SPLAT_FAR
      c = mix(c, texture2D(t, uv * uFar.z + vec2(0.37, 0.61)).rgb, far);
    #endif
      return c;
    }
    vec3 splatAlbedo() {
      vec2 p = vWPos.xz;
      float far = mix(uFar.w, 0.85, smoothstep(uFar.x, uFar.y, vDist));
      vec4 w = vSplat;
      vec3 c0 = splatTex(uL0, p * uScale.x, far);
      vec3 c1 = splatTex(uL1, p * uScale.y, far);
      vec3 c3 = splatTex(uL3, p * uScale.w, far);
    #if SPLAT_LAYERS > 3
      vec3 c2 = splatTex(uL2, p * uScale.z, far);
    #else
      vec3 c2 = c0;
      w.x += w.z; w.z = 0.0;
    #endif
      // yükseklik harmanı: parlak (yüksek) doku pikseli komşusunun üstüne taşar
      const vec3 LUM = vec3(0.299, 0.587, 0.114);
      vec4 h = vec4(dot(c0, LUM), dot(c1, LUM), dot(c2, LUM), dot(c3, LUM)) / uAvgLum;
      vec4 v = w * (uBlend.x + h);
      float m = max(max(max(v.x, v.y), max(v.z, v.w)) - uBlend.y, 1e-4);
      vec4 b = max(v - m, 0.0);
      vec3 col = c0 * uTint[0] * b.x + c1 * uTint[1] * b.y + c2 * uTint[2] * b.z + c3 * uTint[3] * b.w;
      return col / max(b.x + b.y + b.z + b.w, 1e-4);
    }
    float causticLight() {
    #if CAUSTICS
      if (uCausAmt <= 0.0) return 1.0;
      vec2 q = vWPos.xz * 0.075;
      q += sin(q.yx * 5.3 + uTime * vec2(0.7, 0.9)) * 0.045;   // dalgalanma: ağ düzgün görünmesin
      float c = texture2D(uCausTex, q + vec2(uTime * 0.016, uTime * 0.01)).r;
      #if CAUSTICS > 1
      c = min(c, texture2D(uCausTex, q * 1.37 + vec2(0.43 - uTime * 0.013, uTime * 0.017)).r) * 1.35;
      #endif
      return 1.0 + c * uCausAmt * (1.0 - smoothstep(30.0, 85.0, vDist));
    #else
      return 1.0;
    #endif
    }`;

  function terrainMaterial() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.customProgramCacheKey = () => 'terrain-' + Q().splat + Q().far + Q().caus;
    mat.onBeforeCompile = (sh) => {
      const q = Q();
      Object.assign(sh.uniforms, splatU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 splat;
          varying vec4 vSplat;
          varying vec3 vWPos;
          varying float vDist;`)
        .replace('#include <fog_vertex>', `#include <fog_vertex>
          vSplat = splat;
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vDist = -mvPosition.z;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          #define SPLAT_LAYERS ${q.splat}
          #define SPLAT_FAR ${q.far}
          #define CAUSTICS ${q.caus}
          ${TERRAIN_FRAG}`)
        .replace('#include <map_fragment>', 'diffuseColor.rgb = splatAlbedo();')
        .replace('reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert',
          'reflectedLight.directDiffuse *= causticLight();\n\treflectedLight.directDiffuse *= BRDF_Diffuse_Lambert');
    };
    return mat;
  }

  /* =========================================================
     Dekor materyali: köşe rengi + üç düzlemli kaya dokusu ayrıntısı.
     'kind' özniteliği: 0 düz · 1 kaya · 2 yaprak/yosun · 3 kabuk
     ========================================================= */
  function decorMaterial() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0 });
    const avg = TEX_AVG.rock;
    mat.customProgramCacheKey = () => 'decor-' + Q().decorTex;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDetail = { value: groundTex('rock') };
      sh.uniforms.uDetailAvg = { value: new THREE.Vector3(avg[0], avg[1], avg[2]) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float kind;
          varying float vKind;
          varying vec3 vWP;`)
        .replace('#include <fog_vertex>', `#include <fog_vertex>
          vKind = kind;
          vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          #define DECOR_TEX ${Q().decorTex}
          uniform sampler2D uDetail;
          uniform vec3 uDetailAvg;
          varying float vKind;
          varying vec3 vWP;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          #if DECOR_TEX
          {
            vec3 fn = normalize(cross(dFdx(vWP), dFdy(vWP)));
            vec3 tw = pow(abs(fn), vec3(4.0));
            tw /= tw.x + tw.y + tw.z;
            float sc = vKind < 1.5 ? 0.45 : (vKind < 2.5 ? 1.3 : 0.9);
            vec3 ps = vWP * sc;
            ps.y *= vKind > 2.5 ? 0.25 : 1.0;
            vec3 t = texture2D(uDetail, ps.zy).rgb * tw.x + texture2D(uDetail, ps.xz).rgb * tw.y + texture2D(uDetail, ps.xy).rgb * tw.z;
            vec3 det = t / uDetailAvg;
            vec3 d = vKind < 1.5 ? mix(vec3(1.0), det, 0.9) : vec3(mix(1.0, dot(det, vec3(0.333)), 0.6));
            diffuseColor.rgb *= vKind > 0.5 ? d : vec3(1.0);
          }
          #endif`);
    };
    return mat;
  }

  /* =========================================================
     Su (havuzlar): kayan dalga normalleri, fresnel ile gökyüzü
     yansıması, güneş parıltısı; kıyı arazi yüksekliğinden (GPU'da)
     hesaplanır: sığda saydam + köpük, derinde koyu.
     ========================================================= */
  function waterMaterial(color) {
    if (!waterNorm) waterNorm = waterNormalTexture();
    const uniforms = Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      uWater: { value: new THREE.Color(color) },
      uNorm: { value: waterNorm },
      uTime: timeU,
      uSunDir: skyU.uSunDir, uSunCol: skyU.uSunCol, uZenith: skyU.uZenith, uHorizon: skyU.uHorizon,
      uHScale: terrainU.uHScale, uSize: terrainU.uSize,
    });
    return new THREE.ShaderMaterial({
      uniforms, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `
        #include <common>
        #include <fog_pars_vertex>
        attribute float edge;
        varying vec3 vWPos;
        varying float vEdge;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          vEdge = edge;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <fog_pars_fragment>
        uniform vec3 uWater, uSunDir, uSunCol, uZenith, uHorizon;
        uniform sampler2D uNorm;
        uniform float uTime;
        varying vec3 vWPos;
        varying float vEdge;
        ${HEIGHT_GLSL}
        void main() {
          float depth = vWPos.y - terrainH(vWPos.xz);
          if (depth <= 0.0) discard;
          vec2 p = vWPos.xz;
          vec3 n1 = texture2D(uNorm, p * 0.11 + vec2(uTime * 0.021, uTime * 0.013)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(uNorm, p * 0.23 + vec2(-uTime * 0.018, uTime * 0.026)).xyz * 2.0 - 1.0;
          vec3 n = normalize(vec3(n1.x + n2.x, 2.2, n1.y + n2.y));
          vec3 V = normalize(cameraPosition - vWPos);
          float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          vec3 R = reflect(-V, n);
          vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.6));
          float deep = smoothstep(0.0, 1.1, depth);
          vec3 col = mix(uWater * 1.15 + 0.04, uWater * 0.32, deep);
          col = mix(col, mix(sky, uZenith, 0.35), clamp(fres, 0.0, 0.55));
          col += uSunCol * pow(max(dot(R, normalize(uSunDir)), 0.0), 220.0) * 2.4;
          float foam = (1.0 - smoothstep(0.0, 0.16, depth)) * (0.55 + 0.45 * n1.x);
          col = mix(col, vec3(0.9, 0.93, 0.9), foam * 0.45);
          float shore = smoothstep(0.0, 0.06, depth) * (1.0 - smoothstep(0.72, 1.0, vEdge));
          float a = max(mix(0.5, 0.92, deep), fres) * shore;
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <fog_fragment>
        }`,
    });
  }

  /* =========================================================
     Gökyüzü kubbesi
     ========================================================= */
  let sky = null;
  const skyU = {
    uZenith: { value: new THREE.Color(0x5a9ad8) },
    uHorizon: { value: new THREE.Color(0xcfe3f0) },
    uGround: { value: new THREE.Color(0x8a8a70) },
    uSunDir: { value: new THREE.Vector3(60, 90, 40).normalize() },
    uSunCol: { value: new THREE.Color(0xfff2cc) },
    uWater: { value: 0 },
    uTime: timeU,
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
    uTime: timeU,
    uBase: { value: new THREE.Color(0x3f7a2e) },
    uTip: { value: new THREE.Color(0x9fd05a) },
    uHeight: { value: 0.9 },
    uDensity: { value: 1 },
    uSway: { value: 0.25 },
    uHScale: terrainU.uHScale,
    uSize: terrainU.uSize,
    uSplat: { value: null },
    uSplatK: { value: new THREE.Vector2(1, 0) },
    uGrassMask: { value: new THREE.Vector4(1, 1, 1, 0) },
    uLayerCol: { value: layerCols },
    uGroundMix: { value: 0.5 },
  };

  /** world.js köşe ağırlıkları (RGBA bayt, (seg+1)²): çim tel yoğunluğu ve rengi için. */
  function setSplat(data, seg) {
    const W = seg + 1;
    let t = grassU.uSplat.value;
    if (!t || t.image.width !== W) {
      if (t) t.dispose();
      t = new THREE.DataTexture(data, W, W, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.magFilter = t.minFilter = THREE.LinearFilter;
      grassU.uSplat.value = t;
    } else {
      t.image.data = data;
    }
    t.needsUpdate = true;
    grassU.uSplatK.value.set(seg / W, 0.5 / W);
  }

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
    const vtf = renderer && renderer.capabilities.maxVertexTextures > 0;   // köşe gölgelendiricisinde doku okuma
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.customProgramCacheKey = () => 'grass-' + (vtf ? 1 : 0);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, grassU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          #define GRASS_SPLAT ${vtf ? 1 : 0}
          attribute vec3 offset;
          attribute float hy;
          uniform vec2 uCenter, uSplatK;
          uniform float uTile, uTime, uHeight, uDensity, uSway;
          uniform sampler2D uSplat;
          uniform vec4 uGrassMask;
          uniform vec3 uLayerCol[4];
          uniform vec3 uBase;
          varying float vHy;
          varying float vRnd;
          varying vec3 vGround;
          ${HEIGHT_GLSL}`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
        // çift yüzlü Lambert arka yüzü -normal ile karanlık hesaplar: tel iki yüzden de aynı aydınlansın
        .replace('#include <shadowmap_vertex>', `#include <shadowmap_vertex>
          #ifdef DOUBLE_SIDED
            vLightBack = vLightFront;
            vIndirectBack = vIndirectFront;
          #endif`)
        .replace('#include <begin_vertex>', `
          vec2 wp = offset.xy + floor((uCenter - offset.xy) / uTile + 0.5) * uTile;
          float edge = 1.0 - smoothstep(uTile * 0.36, uTile * 0.5, length(wp - uCenter));
        #if GRASS_SPLAT
          vec4 sw = texture2D(uSplat, (wp / uSize + 0.5) * uSplatK.x + uSplatK.y);
          sw /= max(sw.x + sw.y + sw.z + sw.w, 0.01);
          float dens = dot(sw, uGrassMask);
          vGround = uLayerCol[0] * sw.x + uLayerCol[1] * sw.y + uLayerCol[2] * sw.z + uLayerCol[3] * sw.w;
        #else
          float dens = 1.0;
          vGround = uBase;
        #endif
          float keep = step(offset.z, uDensity * dens);
          float sc = (0.55 + fract(offset.z * 7.31) * 0.9) * uHeight * edge * keep * (0.6 + 0.4 * clamp(dens, 0.0, 1.0));
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
          uniform float uGroundMix;
          varying float vHy;
          varying float vRnd;
          varying vec3 vGround;`)
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4(mix(mix(uBase, vGround, uGroundMix), uTip, vHy * vHy) * (0.82 + vRnd * 0.3), 1.0);');
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
    const an = anisoFor();
    Object.keys(texs).forEach((k) => { const t = texs[k]; if (t.anisotropy !== an) { t.anisotropy = an; t.needsUpdate = true; } });
    buildGrass();
    buildMotes();
    if (!first) {
      // gölge / katman sayısı değişti: materyaller yeniden derlenmeli
      scene.traverse((o) => {
        if (!o.material) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
        if (o.isMesh && o.userData.shadowCast) o.castShadow = castFor(o.userData.shadowCast);
      });
      if (EV.Game && EV.Game.stage) applyStage(EV.Game.stage());
      // görüş dışındakiler dahil hepsini şimdi derle: sonradan görüşe girince kare takılmasın
      if (camera) renderer.compile(scene, camera);
    }
  }

  /** Aşamaya göre gökyüzü, zemin katmanları, çim ve parçacık renkleri. */
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
    setSplatStage(stage.id);
    const G = {
      cell:    { base: 0x24684c, tip: 0x5cc098, h: 1.3, dens: 0.3,  sway: 0.45 },
      reptile: { base: 0x9a8a50, tip: 0xe2d4a0, h: 0.5, dens: 0.16, sway: 0.15 },
      mammal:  { base: 0x3e7028, tip: 0x9cc860, h: 0.8, dens: 0.9,  sway: 0.3 },
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
    terrainU.uHScale.value = hScale;
    terrainU.uSize.value = size;
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
    timeU.value = tAcc;
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
      }
      if (sun) skyU.uSunDir.value.subVectors(sun.position, sun.target.position).normalize();
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

  requestTextures();

  return {
    init, applyStage, setTerrain, update, updateBlobs, setPref, castFor, HEIGHT_GLSL,
    terrainMaterial, decorMaterial, waterMaterial, setSplat, texturesArrived, groundTex,
    get level() { return level; }, get pref() { return pref; }, get seg() { return Q().seg; }, get decor() { return Q().decor; },
    LEVELS, mobile,
  };
})();
