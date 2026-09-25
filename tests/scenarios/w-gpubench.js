// GPU süresi: her aşama × kalite için N kare senkron çizilir (readPixels ile GPU beklenir).
// perf.js'teki FPS vsync'e takılıyor (~56); bu ölçüm kare başına gerçek çizim maliyetini verir.
// Kullanım: node tests/cdp-run.mjs --port 944x --gpu --width 1600 --height 900 --scenario tests/scenarios/w-gpubench.js
const G = EV.Game;
const LEVELS = window.__levels || ['high', 'med', 'low'];
const N = 40;
T.start('normal');
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
EV.Combat.hitPlayer = () => 0;
G.eventT = 1e9; G.apexTimer = 1e9;
const gl = G.renderer.getContext();
const px = new Uint8Array(4);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => { G.renderer.render(G.scene, G.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
const out = {};
for (const st of [0, 1, 2]) {
  if (st) { G.stageIndex = st; G.startStage(false); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' })); }
  await wait(600);
  for (const lv of LEVELS) {
    EV.GFX.setPref(lv);
    await wait(900);                                 // doku yükleme + derleme
    for (let i = 0; i < 6; i++) frame();             // ısınma
    const times = [];
    for (let i = 0; i < N; i++) { const t = performance.now(); frame(); times.push(performance.now() - t); }
    times.sort((a, b) => a - b);
    const info = G.renderer.info.render;
    out[['cell', 'reptile', 'mammal'][st] + '.' + lv] = {
      medMs: +times[N >> 1].toFixed(2), p90Ms: +times[Math.floor(N * 0.9)].toFixed(2),
      calls: info.calls, tris: info.triangles,
    };
  }
}
EV.GFX.setPref('auto');
return out;
