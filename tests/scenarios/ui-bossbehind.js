// UI test: big Alfa behind the player (between camera and player) — camera clipping / occlusion
const G = EV.Game, I = EV.Input, W = EV.World;
T.start('normal');
G.stageIndex = 2; G.startStage(false); T.handleModals({ pick: 'first' }); T.sim(1);
G.gainEvo(G.evoMax(), 0);
const b = G.boss, P = G.player; P.iframe = 1e9;
const out = [];
for (const back of [3, 5, 7, 9, 11]) {
  P.yaw = 0.8; P.pitch = 0.3;
  const x = P.group.position.x - Math.sin(P.yaw) * (back + b.radius), z = P.group.position.z - Math.cos(P.yaw) * (back + b.radius);
  b.group.position.set(x, W.groundY(x, z), z);
  EV.Player.updateCamera(G, G.camera, 1); G.camera.updateMatrixWorld();
  const box = new THREE.Box3().setFromObject(b.group);
  const rc = new THREE.Raycaster(); rc.camera = G.camera;
  const pp = P.group.position.clone(); pp.y += P.group.userData.height * 0.6;
  rc.set(G.camera.position, pp.clone().sub(G.camera.position).normalize());
  const meshes = []; b.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const hits = rc.intersectObjects(meshes, false);
  out.push({ gapBehindPlayer: back, camDist: +G.camera.position.distanceTo(P.pivot).toFixed(1), camInBossBox: box.containsPoint(G.camera.position), playerOccluded: hits.length > 0 && hits[0].distance < G.camera.position.distanceTo(pp) - 0.3 });
}
// leave the worst case for the screenshot
const back = 7; const x = P.group.position.x - Math.sin(P.yaw) * (back + b.radius), z = P.group.position.z - Math.cos(P.yaw) * (back + b.radius);
b.group.position.set(x, W.groundY(x, z), z); b.speed = 0;
G.paused = true;
return out;
