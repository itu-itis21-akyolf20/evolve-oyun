// Düşük kalite: gölge kapalı, çim az; kalite değiştirince hata yok
T.start('normal');
const G = EV.Game;
const r = {};
EV.GFX.setPref('low');
T.sim(1, { dt: 1 / 30, bot: false });
await new Promise((res) => setTimeout(res, 600));
r.low = { level: EV.GFX.level, shadows: G.renderer.shadowMap.enabled, calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles };
EV.GFX.setPref('med');
await new Promise((res) => setTimeout(res, 600));
r.med = { level: EV.GFX.level, shadows: G.renderer.shadowMap.enabled, calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles };
EV.GFX.setPref('high');
await new Promise((res) => setTimeout(res, 600));
r.high = { level: EV.GFX.level, calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles };
EV.GFX.setPref('auto');
r.sel = document.getElementById('gfxSel').options.length;
T.sim(5, { dt: 1 / 30 });
return r;
