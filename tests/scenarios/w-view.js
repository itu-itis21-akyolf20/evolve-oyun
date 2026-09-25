// Görsel kontrol: aşama __STAGE__, görünüm '__VIEW__' ('pool' = en yakın havuza bak, 'low' = düşük kalite,
// 'far' = yüksekten geniş bakış). Yaratıklar gizlenir: sadece dünya görünsün.
// sed ile __STAGE__ / __VIEW__ doldurulmuş geçici kopya olarak koşturulur.
const STAGE = __STAGE__;
const VIEW = '__VIEW__';
T.start('normal');
const G = EV.Game, P = G.player, W = EV.World;
if (STAGE) { G.stageIndex = STAGE; G.startStage(false); }
if (VIEW === 'low') EV.GFX.setPref('low');
T.sim(0.6, { dt: 1 / 30, bot: false });
G.enemies.forEach((e) => { if (e.group) e.group.visible = false; });
G.eventT = 1e9; G.apexTimer = 1e9;
let info = {};
if (VIEW === 'pool' && W.pools.length) {
  const p = W.pools.slice().sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  const x = p.x - (p.r + 9), z = p.z - 3;
  P.group.position.set(x, W.groundY(x, z), z);
  P.yaw = Math.atan2(p.x - x, p.z - z);
  P.pitch = 0.32;
  info = { pool: p };
} else {
  P.pitch = VIEW === 'far' ? 0.45 : 0.28;
}
G.paused = true;                                   // dünya dursun, kare çizilmeye devam etsin
for (let i = 0; i < 40; i++) EV.Player.updateCamera(G, G.camera, 0.05);
G.enemies.forEach((e) => { if (e.group) e.group.visible = false; });
await new Promise((r) => setTimeout(r, 1800));
return Object.assign(info, { level: EV.GFX.level, calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles });
