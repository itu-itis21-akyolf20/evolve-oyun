// UI test: aim ray, hover, lock cycle, projectile toward crosshair incl. slopes
T.start('normal');
const G = EV.Game, P = G.player, I = EV.Input, W = EV.World;
const step = (n) => { for (let i = 0; i < n; i++) { G.time += 1 / 30; EV.tick(1 / 30); I.endFrame(); } };
EV.Enemies.clearAll(G); G.spawnTimer = 1e9; G.apexTimer = 1e9; G.build.picks = 0; P.iframe = 1e9;
const def = EV.MOBS && null;
// spawn helper: reuse make() with a mob def from an existing pack
EV.Enemies.spawnPack(G); step(0);
const proto = G.enemies[0].def;
EV.Enemies.clearAll(G);
const spawnAt = (x, z) => { const e = EV.Enemies.make(G, proto, { pos: { x, z }, hp: 1e6 }); e.speed = 0; e.behavior = 'passive'; e.atk = { range: 0, windup: 99, cd: 99 }; return e; };
const freeze = () => G.enemies.forEach((e) => { e.speed = 0; e.knock.set(0, 0, 0); });
const hip = (e) => e.group.position.clone().setY(e.group.position.y + e.group.userData.hipY);
const aimAt = (pt) => { // iterate yaw/pitch so crosshair ray hits pt
  for (let k = 0; k < 8; k++) {
    EV.Player.updateCamera(G, G.camera, 1);
    const c = G.camera.position; const d = pt.clone().sub(c).normalize();
    P.yaw = Math.atan2(d.x, d.z); P.pitch = -Math.asin(d.y);
  }
  EV.Player.updateCamera(G, G.camera, 1);
};
const out = {};
const px = 5, pz = 5;
P.group.position.set(px, W.groundY(px, pz), pz);
P.yaw = 0; P.pitch = 0.3; step(2);
// 1. hover
const e1 = spawnAt(px + 0.5, pz + 14);
step(1); aimAt(hip(e1)); step(2);
out.hover = { hoverIsE1: P.hover === e1, aimToHip: +P.aimPoint.distanceTo(hip(e1)).toFixed(2), crosshairClass: document.getElementById('crosshair').className, targetFrameHidden: document.getElementById('targetFrame').hidden };
// 2. lock cycling with 3 enemies at various screen offsets
const e2 = spawnAt(px + 6, pz + 16), e3 = spawnAt(px - 7, pz + 18);
freeze(); aimAt(hip(e1).add(new THREE.Vector3(1.5, 0, 0)));
const ndc = (e) => { const v = hip(e).project(G.camera); return +Math.hypot(v.x, v.y).toFixed(3); };
out.ndcDist = { e1: ndc(e1), e2: ndc(e2), e3: ndc(e3) };
const ids = { [e1.id]: 'e1', [e2.id]: 'e2', [e3.id]: 'e3' };
const seq = [];
for (let i = 0; i < 4; i++) { I._press('KeyT'); step(1); seq.push(P.lockTarget ? ids[P.lockTarget.id] : null); }
out.lockSeq = seq;
step(1); out.lockedFrame = document.getElementById('targetFrame').className;
out.aimPointWhenLocked = P.lockTarget ? +P.aimPoint.distanceTo(hip(P.lockTarget)).toFixed(2) : null;
I._press('KeyX'); step(1); out.afterX = P.lockTarget;
I._press('KeyT'); step(1); const lk = P.lockTarget; G.killEnemy(lk); step(1); out.afterKill = P.lockTarget ? 'still' : null;
I._press('KeyT'); step(1); const lk2 = P.lockTarget; out.relockOk = !!lk2;
if (lk2) { lk2.group.position.set(px + 60, W.groundY(px + 60, pz), pz); step(1); out.afterFar = P.lockTarget ? 'still' : null; }
// lock when target behind camera / off-screen?
EV.Enemies.clearAll(G);
// 3. projectiles toward crosshair incl slopes
G.stageIndex = 1; G.startStage(false); T.handleModals({ pick: 'first' }); G.paused = false; EV.Enemies.clearAll(G); G.spawnTimer = 1e9; G.apexTimer = 1e9; G.build.picks = 0; P.iframe = 1e9;
G.build.skills = [{ id: 'r_spear', rank: 1, cd: 0 }]; EV.UI.buildSkillbar(G);
// find slope pairs: player spot and target 24 units away with big height diff
const pairs = [];
let hmin=1e9,hmax=-1e9; for (let i=0;i<2000;i++){const h=W.height(EV.U.rand(-80,80),EV.U.rand(-80,80)); hmin=Math.min(hmin,h); hmax=Math.max(hmax,h);} out.hRange=[+hmin.toFixed(1),+hmax.toFixed(1)];
for (let tries = 0; tries < 200000 && pairs.length < 30; tries++) {
  const x = EV.U.rand(-90, 90), z = EV.U.rand(-90, 90), a = EV.U.rand(0, 6.28), D = EV.U.rand(10, 28);
  const tx = x + Math.sin(a) * D, tz = z + Math.cos(a) * D;
  const dh = W.height(tx, tz) - W.height(x, z);
  if (Math.abs(dh) > 2 + (pairs.length % 3) && !W.inCover(x, z) && !W.inCover(tx, tz)) pairs.push({ x, z, tx, tz, dh: +dh.toFixed(2), D: +D.toFixed(1) });
}
const projRes = [];
for (const pr of pairs) {
  EV.Enemies.clearAll(G);
  P.group.position.set(pr.x, W.groundY(pr.x, pr.z), pr.z); P.vel.set(0,0,0); P.impulse.set(0,0,0);
  const e = spawnAt(pr.tx, pr.tz); freeze(); e.group.position.set(pr.tx, W.groundY(pr.tx, pr.tz), pr.tz);
  P.lockTarget = null; step(1); aimAt(hip(e)); step(2); freeze(); e.group.position.set(pr.tx, W.groundY(pr.tx, pr.tz), pr.tz); aimAt(hip(e)); step(1);
  const hov = P.hover === e; const aimErr = +P.aimPoint.distanceTo(hip(e)).toFixed(2);
  const before = new Set(G.scene.children);
  const hp0 = e.hp; P.energy = 999; G.build.skills[0].cd = 0;
  I._press('KeyQ'); step(1);
  const proj = G.scene.children.filter((c) => !before.has(c) && c.geometry && c.geometry.type === 'IcosahedronGeometry')[0];
  let minD = 1e9, end = null, frames = 0;
  while (proj && proj.parent && frames < 60) { const d = proj.position.distanceTo(hip(e)); if (d < minD) minD = d; end = proj.position.clone(); step(1); frames++; }
  const gy = end ? W.height(end.x, end.z) : 0;
  // line-of-sight from chest (y+h*0.55) and from camera to target hip: max terrain penetration
  const los = (o) => { const t = hip(e); let worst = -1e9; for (let k = 6; k < 34; k++) { const q = o.clone().lerp(t, k / 40); worst = Math.max(worst, W.height(q.x, q.z) - q.y); } return +worst.toFixed(2); };
  const chestO = P.group.position.clone().setY(P.group.position.y + P.group.userData.height * 0.55);
  pr.terrainAboveChestLine = los(chestO); pr.terrainAboveCamLine = los(G.camera.position.clone());
  projRes.push(Object.assign({}, pr, { hover: hov, aimErr, hit: e.hp < hp0, minDistToHip: +minD.toFixed(2), endAboveGround: end ? +(end.y - gy).toFixed(2) : null, endDistToTarget: end ? +end.distanceTo(hip(e)).toFixed(1) : null, frames }));
}
out.projSummary = { n: projRes.length, hits: projRes.filter((r) => r.hit).length, hoverOk: projRes.filter((r) => r.hover).length }; out.misses = projRes.filter((r) => !r.hit || !r.hover).map((r) => ({ dh: r.dh, D: r.D, hover: r.hover, aimErr: r.aimErr, hit: r.hit, minD: r.minDistToHip, chestLine: r.terrainAboveChestLine, camLine: r.terrainAboveCamLine, frames: r.frames }));
// also lock-on version for steepest pair
G.paused = true;
return out;
