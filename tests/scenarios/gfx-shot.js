// Grafik görüntüsü: aşama STAGE, oyuncunun arkasından; HUD açık
const STAGE = __STAGE__;
T.start('normal');
const G = EV.Game, P = G.player;
if (STAGE) { G.stageIndex = STAGE; G.startStage(false); }
T.sim(1.2, { dt: 1 / 30, bot: false });
P.pitch = 0.28;
await new Promise((r) => setTimeout(r, 1500));
return { level: EV.GFX.level, enemies: G.enemies.length, calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles };
