// UI test: performance in a crowded late scene
const G = EV.Game, I = EV.Input;
T.start('dehset');
G.stageIndex = 2; G.startStage(false); T.handleModals({ pick: 'first' });
T.sim(40);
G.gainEvo(G.evoMax() * 0.5, EV.Build.xpNeed(G) * 6);
T.sim(40);
// spawn apex too for crowd
if (!G.apex) EV.Enemies.spawnApex(G);
T.sim(3);
const alive = G.enemies.filter((e) => e.alive);
const near = alive.filter((e) => e.group.position.distanceTo(G.player.group.position) < 60).length;
// tick timing (bot off), 300 ticks
const times = [];
for (let i = 0; i < 300; i++) {
  if (T.handleModals({ pick: 'first' })) { G.paused = false; }
  const t0 = performance.now(); G.time += 1 / 30; EV.tick(1 / 30); I.endFrame(); times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b, 0) / times.length;
// breakdown of subsystems
const prof = {};
const wrap = (obj, name, key) => { const f = obj[name]; obj[name] = function () { const t0 = performance.now(); const r = f.apply(this, arguments); prof[key] = (prof[key] || 0) + performance.now() - t0; return r; }; return () => { obj[name] = f; }; };
const un = [wrap(EV.Player, 'update', 'player'), wrap(EV.Enemies, 'update', 'enemies'), wrap(EV.Enemies, 'maintain', 'maintain'), wrap(EV.Skills, 'update', 'skills'), wrap(EV.Decal, 'update', 'decals'), wrap(EV.FX, 'update', 'fx'), wrap(EV.UI, 'refresh', 'uiRefresh'), wrap(EV.UI, 'updateSkillbar', 'uiSkillbar'), wrap(EV.UI, 'updateTarget', 'uiTarget'), wrap(EV.Pickups, 'update', 'pickups'), wrap(EV.Items, 'update', 'items'), wrap(EV.Mating, 'update', 'mating')];
for (let i = 0; i < 150; i++) { G.time += 1 / 30; EV.tick(1 / 30); I.endFrame(); }
un.forEach((f) => f());
Object.keys(prof).forEach((k) => { prof[k] = +(prof[k] / 150).toFixed(3); });
// render stats
G.paused = true;
await new Promise((r) => setTimeout(r, 700));
const ri = G.renderer.info;
const rs = { calls: ri.render.calls, triangles: ri.render.triangles, points: ri.render.points, lines: ri.render.lines, geometries: ri.memory.geometries, textures: ri.memory.textures, programs: ri.programs ? ri.programs.length : null };
// explicit render timing (swiftshader = CPU raster, not representative of GPU)
const rt = []; for (let i = 0; i < 10; i++) { const t0 = performance.now(); G.renderer.render(G.scene, G.camera); G.renderer.getContext().finish(); rt.push(performance.now() - t0); }
let meshes = 0, visibleMeshes = 0, shadow = G.renderer.shadowMap.enabled; G.scene.traverse((o) => { if (o.isMesh) { meshes++; if (o.visible) visibleMeshes++; } });
const dmgNodes = document.querySelectorAll('#dmgLayer > *').length;
return { level: G.build.level, stage: G.stageIndex, alive: alive.length, near60: near, hostiles: T.state().hostiles, boss: !!G.boss, apex: !!G.apex, tickMs: { avg: +avg.toFixed(2), p50: +times[150].toFixed(2), p95: +times[285].toFixed(2), max: +times[299].toFixed(2) }, perSystemMs: prof, render: rs, renderMsSwiftshader: +(rt.reduce((a, b) => a + b, 0) / rt.length).toFixed(1), meshes, visibleMeshes, shadowMap: shadow, pixelRatio: G.renderer.getPixelRatio(), sceneChildren: G.scene.children.length, dmgNodes, fx: EV.FX.count, skills: EV.Skills.counts, decals: EV.Decal.count };
