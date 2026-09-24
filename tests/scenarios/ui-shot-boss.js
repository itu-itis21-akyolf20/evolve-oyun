// UI screenshot: boss

const G = EV.Game, I = EV.Input, W = EV.World;
const step = (n) => { for (let i = 0; i < n; i++) { G.time += 1 / 30; EV.tick(1 / 30); I.endFrame(); } };
function audit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (el) => { if (!el || el.hidden) return false; let n = el; while (n && n !== document.body) { const cs = getComputedStyle(n); if (n.hidden || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false; n = n.parentElement; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ids = ['evoTop','bossBanner','targetFrame','chips','fleeWarn','toast','skillbar','echoBar','hud','helpHint','creatureName','matePrompt','marker','lockHint','crosshair'];
  const rects = {};
  ids.forEach((id) => { const el = document.getElementById(id); if (vis(el)) { const r = el.getBoundingClientRect(); rects[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; } });
  const overlaps = [];
  const keys = Object.keys(rects);
  const inter = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = rects[keys[i]], b = rects[keys[j]];
    if ((keys[i] === 'hud' && keys[j] === 'creatureName') || (keys[j] === 'hud' && keys[i] === 'creatureName')) continue;
    const s = inter(a, b); if (s > 4) overlaps.push(keys[i] + 'x' + keys[j] + ':' + s + 'px2');
  }
  const offscreen = keys.filter((k) => { const r = rects[k]; return r[0] < 0 || r[1] < 0 || r[2] > vw || r[3] > vh; });
  const modal = {};
  ['startPanel','cardPanel','evolvePanel','buildPanel','invPanel','deathPanel'].forEach((id) => {
    const el = document.getElementById(id); if (!vis(el)) return;
    const inner = el.querySelector('.panel, .cards-wrap');
    const r = inner.getBoundingClientRect();
    const m = { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], scrollNeeded: inner.scrollHeight > inner.clientHeight + 2 ? inner.scrollHeight - inner.clientHeight : 0, offscreen: r.top < 0 || r.bottom > vh || r.left < 0 || r.right > vw };
    const clipped = [];
    inner.querySelectorAll('*').forEach((n) => { if (n.children.length === 0 && n.scrollWidth > n.clientWidth + 2 && n.clientWidth > 0 && getComputedStyle(n).overflow !== 'visible') clipped.push((n.id || n.className || n.tagName) + ':' + (n.textContent || '').slice(0, 30)); });
    m.clipped = clipped.slice(0, 8);
    const cards = inner.querySelectorAll('.card, .gene');
    if (cards.length) { const rows = new Set(); cards.forEach((c) => rows.add(Math.round(c.getBoundingClientRect().top))); m.cards = cards.length; m.cardRows = rows.size; m.cardsBelowFold = [...cards].filter((c) => c.getBoundingClientRect().bottom > vh).length; }
    modal[id] = m;
  });
  return { vw, vh, dpr: devicePixelRatio, rects, overlaps, offscreen, modal };
}

T.start('normal'); T.sim(5); G.gainEvo(G.evoMax(), 0); T.sim(3); let t = 0; T.sim(20, { until: (g) => { t += 1/30; return t > 2 && EV.Decal.count > 0 && g.boss && g.boss.group.position.distanceTo(g.player.group.position) < 14; } });
 const b = G.boss; const P = G.player; P.pitch = 0.32;
 if (b) P.yaw = Math.atan2(b.group.position.x - P.group.position.x, b.group.position.z - P.group.position.z);
 EV.Player.updateCamera(G, G.camera, 1);
 let cover = null, camInside = null, playerOccluded = null;
 if (b) { const box = new THREE.Box3().setFromObject(b.group); const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(G.camera));
  const xs = pts.map((p) => Math.max(-1, Math.min(1, p.x))), ys = pts.map((p) => Math.max(-1, Math.min(1, p.y)));
  cover = +(((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))) / 4).toFixed(2);
  camInside = box.containsPoint(G.camera.position);
  const rc = new THREE.Raycaster(); rc.camera = G.camera; const pp = P.group.position.clone(); pp.y += P.group.userData.height * 0.6; rc.set(G.camera.position, pp.clone().sub(G.camera.position).normalize()); const hits = rc.intersectObject(b.group, true); playerOccluded = hits.length > 0 && hits[0].distance < G.camera.position.distanceTo(pp);
 }
 G.paused = true;
 const tl = G.scene.children.filter((c) => c.isMesh && c.renderOrder === 5 && c.material.color.getHex() !== 0x7fd9ff).length;
 return Object.assign(audit(), { stage: G.stageIndex, boss: b && { name: b.name, dist: +b.group.position.distanceTo(P.group.position).toFixed(1), height: +b.group.userData.height.toFixed(1), radius: +b.radius.toFixed(1) }, decals: EV.Decal.count, teleMeshes: tl, bossScreenCover: cover, camInsideBossBox: camInside, playerOccludedByBoss: playerOccluded });
