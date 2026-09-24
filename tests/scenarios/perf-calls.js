// Çizim çağrısı dağılımı: düşmansız / 60 düşman; yaratık başına mesh sayısı
const G = EV.Game;
T.start('normal');
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
G.stageIndex = 2; G.startStage(false);
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
EV.GFX.setPref('low');
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
G.enemies.slice().forEach((e) => EV.Enemies.despawn(G, G.enemies.indexOf(e)));
G.paused = false;
await frame(); await frame();
const empty = G.renderer.info.render.calls;
while (G.enemies.length < 60) EV.Enemies.spawnPack(G);
G.enemies.forEach((e) => { const p = G.player.group.position; e.group.position.set(p.x + (Math.random() - 0.5) * 30, e.group.position.y, p.z + 8 + Math.random() * 20); });
await frame(); await frame();
const full = G.renderer.info.render.calls;
const meshes = G.enemies.map((e) => { let n = 0; e.group.traverse((o) => { if ((o.isMesh || o.isSprite) && o.visible) n++; }); return n; });
let decor = 0; G.scene.traverse((o) => { if (o.isMesh && o.parent && o.parent !== G.scene && !o.parent.userData.rig && o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius > 20) decor++; });
return { emptyCalls: empty, with60: full, perEnemyAvg: +(meshes.reduce((a, b) => a + b, 0) / meshes.length).toFixed(1), perEnemyMax: Math.max(...meshes), decorChunks: decor };
