// UI test: big Alfa (stage from EV_STAGE) — camera occlusion and telegraph visibility on slopes
const STAGE = 2;
const G = EV.Game, I = EV.Input, W = EV.World;
T.start('normal');
G.stageIndex = STAGE; G.startStage(false); T.handleModals({ pick: 'first' }); T.sim(2);
G.gainEvo(G.evoMax(), 0);
const b = G.boss, P = G.player;
const samples = [];
let buriedWorst = 0, triTotal = 0, triBuried = 0;
function teleBuried() {
  G.scene.children.forEach((m) => {
    if (!m.isMesh || m.renderOrder !== 5 || m.material.color.getHex() === 0x7fd9ff) return;
    const pos = m.geometry.attributes.position, idx = m.geometry.index;
    const c = Math.cos(m.rotation.y), s = Math.sin(m.rotation.y);
    const n = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < n; t++) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { const i = idx ? idx.getX(t * 3 + k) : t * 3 + k; cx += pos.getX(i) / 3; cy += pos.getY(i) / 3; cz += pos.getZ(i) / 3; }
      const wx = m.position.x + cx * c + cz * s, wz = m.position.z - cx * s + cz * c;
      const d = W.height(wx, wz) - cy; triTotal++; if (d > 0) { triBuried++; buriedWorst = Math.max(buriedWorst, d); }
    }
  });
}
function measure() {
  const box = new THREE.Box3().setFromObject(b.group);
  const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(G.camera));
  const xs = pts.map((p) => Math.max(-1, Math.min(1, p.x))), ys = pts.map((p) => Math.max(-1, Math.min(1, p.y)));
  const cover = ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) / 4;
  const rc = new THREE.Raycaster(); rc.camera = G.camera;
  const pp = P.group.position.clone(); pp.y += P.group.userData.height * 0.6;
  rc.set(G.camera.position, pp.clone().sub(G.camera.position).normalize());
  const meshes = []; b.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const hits = rc.intersectObjects(meshes, false);
  const occl = hits.length > 0 && hits[0].distance < G.camera.position.distanceTo(pp) - 0.3;
  // crosshair ray hits boss?
  return { d: +EV.Creature.surfDist(b.group, P.group.position.x, P.group.position.z).toFixed(1), cover: +cover.toFixed(2), occl, camInBox: box.containsPoint(G.camera.position), hover: P.hover === b };
}
let shotTaken = null;
for (let k = 0; k < 40; k++) {
  T.sim(0.5);
  if (!G.boss || !G.player.alive) continue;
  // point camera at the boss like a player would (lock)
  P.lockTarget = b;
  P.yaw = Math.atan2(b.group.position.x - P.group.position.x, b.group.position.z - P.group.position.z); P.pitch = 0.3;
  EV.Player.updateCamera(G, G.camera, 1);
  teleBuried();
  const m = measure(); m.decals = EV.Decal.count; samples.push(m);
  if (!shotTaken && EV.Decal.count > 0 && m.d < 6) { shotTaken = m; break; }
}
G.paused = true;
const occlFrac = samples.filter((s) => s.occl).length / Math.max(1, samples.length);
return { stage: STAGE, boss: b.name, bossH: +b.group.userData.height.toFixed(1), bossR: +b.radius.toFixed(1), playerH: +P.group.userData.height.toFixed(1), n: samples.length, occlFrac: +occlFrac.toFixed(2), maxCover: Math.max(...samples.map((s) => s.cover)), camInBoxAny: samples.some((s) => s.camInBox), close: samples.filter((s) => s.d < 5).slice(0, 6), shotTaken, tele: { triTotal, triBuried, buriedWorst: +buriedWorst.toFixed(3) } };
