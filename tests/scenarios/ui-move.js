// UI test: movement relative to camera + facing rules
T.start('normal');
const G = EV.Game, P = G.player, I = EV.Input;
const step = (n) => { for (let i = 0; i < n; i++) { G.time += 1 / 30; EV.tick(1 / 30); I.endFrame(); } };
const clearKeys = () => { ['KeyW','KeyA','KeyS','KeyD'].forEach((k) => { I.keys[k] = false; }); I.mouse.left = I.mouse.right = false; };
EV.Enemies.clearAll(G);
G.spawnTimer = 999; G.apexTimer = 9999; G.build.picks = 0;
P.iframe = 1e9;
// find clear flat spot
const spot = { x: 0, z: 0 };
const out = { yaws: [], facing: {} };
for (const yaw of [0, 1.0, 2.5, -2.0, Math.PI]) {
  const row = { yaw };
  for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    EV.Enemies.clearAll(G);
    P.group.position.set(spot.x, EV.World.groundY(spot.x, spot.z), spot.z);
    P.vel.set(0, 0, 0); P.impulse.set(0, 0, 0);
    P.yaw = yaw; P.pitch = 0.35; clearKeys(); step(3);
    const m = G.camera.matrixWorld.elements;
    const right = new THREE.Vector3(m[0], 0, m[2]).normalize();
    const fwd = new THREE.Vector3(-m[8], 0, -m[10]).normalize();
    const p0 = P.group.position.clone();
    I.keys[key] = true; step(12); clearKeys();
    const d = P.group.position.clone().sub(p0); d.y = 0;
    const len = d.length(); d.normalize();
    const exp = { KeyW: fwd, KeyS: fwd.clone().negate(), KeyD: right, KeyA: right.clone().negate() }[key];
    const faceV = new THREE.Vector3(Math.sin(P.group.rotation.y), 0, Math.cos(P.group.rotation.y));
    row[key] = { dist: +len.toFixed(2), dotExpected: +d.dot(exp).toFixed(3), faceDotMove: +faceV.dot(d).toFixed(3) };
  }
  out.yaws.push(row);
}
// facing while holding right mouse and strafing D
EV.Enemies.clearAll(G);
P.yaw = 0.7; P.pitch = 0.35; clearKeys(); step(3);
I.mouse.right = true; I.keys.KeyD = true; step(20);
const aimYaw = Math.atan2(P.aimPoint.x - P.group.position.x, P.aimPoint.z - P.group.position.z);
out.facing.rightMouseStrafe = { rot: +P.group.rotation.y.toFixed(3), aimYaw: +aimYaw.toFixed(3), camYaw: P.yaw, diff: +Math.abs(EV.U.wrapAngle(P.group.rotation.y - aimYaw)).toFixed(3) };
clearKeys(); step(2);
// facing while attacking (left mouse) while moving S (backwards)
P.yaw = -1.2; step(3);
I.mouse.left = true; I.keys.KeyS = true; step(15);
const aimYaw2 = Math.atan2(P.aimPoint.x - P.group.position.x, P.aimPoint.z - P.group.position.z);
out.facing.attackWhileBackpedal = { rot: +P.group.rotation.y.toFixed(3), aimYaw: +aimYaw2.toFixed(3), diff: +Math.abs(EV.U.wrapAngle(P.group.rotation.y - aimYaw2)).toFixed(3), faceT: +P.faceT.toFixed(2) };
// sample facing each frame between attacks (faceT windows)
const samples = [];
for (let i = 0; i < 30; i++) { step(1); const a = Math.atan2(P.aimPoint.x - P.group.position.x, P.aimPoint.z - P.group.position.z); samples.push(+Math.abs(EV.U.wrapAngle(P.group.rotation.y - a)).toFixed(2)); }
out.facing.attackBackpedalSamples = samples;
out.facing.basicCdMax = +(0.55 / P.stats.atkSpd).toFixed(2);
clearKeys(); step(2);
// shoulder offset: player's screen x
P.yaw = 0.3; P.pitch = 0.35; step(5);
const pv = P.group.position.clone(); pv.y += 1; pv.project(G.camera);
out.playerNDC = { x: +pv.x.toFixed(3), y: +pv.y.toFixed(3) };
// zoom
const camDist = () => G.camera.position.distanceTo(P.pivot);
const z0 = camDist();
I.mouse.wheel = 5; step(1); step(2);
const zOut = camDist(); const zoomOut = P.zoom;
I.mouse.wheel = -20; step(1); step(2);
out.zoom = { base: +z0.toFixed(2), after5Down: +zOut.toFixed(2), zoomOut, after20Up: +camDist().toFixed(2), zoomIn: P.zoom };
G.paused = true;
return out;
