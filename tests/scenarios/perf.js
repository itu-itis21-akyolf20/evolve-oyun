// Gerçek döngüde FPS + sistem başına süre (--gpu ile çalıştır). Memeli nesil 2, kalabalık.
const LEVELS = window.__levels || ['high', 'med', 'low'];
const G = EV.Game;
T.start('normal');
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
G.stageIndex = 2; G.generation = 2; G.startStage(false);
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
EV.Combat.hitPlayer = () => 0;                                 // ölmesin
G.eventT = 1e9; G.apexTimer = 1e9;

// sistem süreleri
const acc = {};
const wrap = (obj, name, key) => {
  const f = obj[name];
  obj[name] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { acc[key] = (acc[key] || 0) + performance.now() - t; } };
};
[['Enemies', 'update'], ['Enemies', 'maintain'], ['Player', 'update'], ['Skills', 'update'], ['Boss', 'updateShots'], ['Decal', 'update'],
 ['FX', 'update'], ['Pickups', 'update'], ['Items', 'update'], ['Mating', 'update'], ['GFX', 'update'],
 ['UI', 'refresh'], ['UI', 'updateSkillbar'], ['UI', 'updateTarget'], ['UI', 'updateBoss'], ['UI', 'updateDanger']].forEach(([m, f]) => wrap(EV[m], f, m + '.' + f));
wrap(G, 'cleanupDead', 'cleanupDead');
wrap(G, 'updateEvents', 'events');
wrap(G.renderer, 'render', 'render(CPU)');

// yapay girdi: oyuncu dolaşsın ve saldırsın
const I = EV.Input;
let t0 = performance.now();
const walker = setInterval(() => { const k = Math.floor((performance.now() - t0) / 1500) % 4; ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((c, i) => { I.keys[c] = i === k; }); I.mouse.left = true; G.paused = false; }, 100);

const out = {};
for (const lv of LEVELS) {
  EV.GFX.setPref(lv);
  await new Promise((r) => setTimeout(r, 1500));
  // kalabalığı tamamla
  while (G.enemies.filter((e) => e.alive && !e.ally).length < 60) EV.Enemies.spawnPack(G);
  Object.keys(acc).forEach((k) => { acc[k] = 0; });
  let frames = 0, worst = 0, last = performance.now();
  const start = performance.now();
  await new Promise((res) => {
    const step = (now) => {
      frames++; worst = Math.max(worst, now - last); last = now;
      if (now - start < 6000) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  const secs = (performance.now() - start) / 1000;
  const per = {};
  Object.keys(acc).sort((a, b) => acc[b] - acc[a]).slice(0, 8).forEach((k) => { per[k] = +(acc[k] / frames).toFixed(2); });
  out[lv] = { fps: +(frames / secs).toFixed(1), worstMs: Math.round(worst), msPerFrame: per,
    calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles, enemies: G.enemies.filter((e) => e.alive).length,
    pr: G.renderer.getPixelRatio(), size: innerWidth + 'x' + innerHeight };
}
clearInterval(walker);
return out;
