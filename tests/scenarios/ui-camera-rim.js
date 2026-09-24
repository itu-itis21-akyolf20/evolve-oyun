// UI test: camera vs terrain near the play-area rim (steep walls)
const G = EV.Game, W = EV.World;
T.start('normal');
const res = {};
for (const s of [1, 2]) {
  G.stageIndex = s; G.startStage(false); T.handleModals({ pick: 'first' });
  const P = G.player;
  let n = 0, under = 0, nearClip = 0, losBlocked = 0, worstLos = 0, minClear = 1e9;
  for (let i = 0; i < 1500; i++) {
    const a0 = EV.U.rand(0, 6.283), r0 = EV.CFG.TUNE.playRadius * EV.U.rand(0.85, 1); const x = Math.cos(a0) * r0, z = Math.sin(a0) * r0;
    P.group.position.set(x, W.groundY(x, z), z);
    P.yaw = EV.U.rand(-Math.PI, Math.PI); P.pitch = EV.U.rand(-0.35, 1.15); P.zoom = EV.U.pick([0.6, 1, 1.6]);
    EV.Player.updateCamera(G, G.camera, 1); G.camera.updateMatrixWorld(); G.camera.updateProjectionMatrix();
    const c = G.camera.position; n++;
    const clear = c.y - W.height(c.x, c.z); minClear = Math.min(minClear, clear);
    if (clear < 0.3) under++;
    // near-plane corners below terrain?
    for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const v = new THREE.Vector3(nx, ny, -1).unproject(G.camera); if (v.y < W.height(v.x, v.z)) { nearClip++; break; } }
    // terrain between camera and player chest
    const pp = P.group.position.clone(); pp.y += P.group.userData.height * 0.6;
    let worst = -1e9; for (let k = 1; k < 30; k++) { const q = c.clone().lerp(pp, k / 30); worst = Math.max(worst, W.height(q.x, q.z) - q.y); }
    if (worst > 0) { losBlocked++; worstLos = Math.max(worstLos, worst); }
  }
  res['stage' + s] = { samples: n, camBelowTerrainPlus0_3: under, nearPlaneInTerrain: nearClip, playerHiddenByTerrain: losBlocked, worstTerrainAboveLine: +worstLos.toFixed(2), minCamClearance: +minClear.toFixed(2) };
}
// screenshot: worst case looking up (pitch -0.35) on a slope
const P = G.player;
P.pitch = -0.35; P.zoom = 1.6; EV.Player.updateCamera(G, G.camera, 1);
G.paused = true;
return res;
