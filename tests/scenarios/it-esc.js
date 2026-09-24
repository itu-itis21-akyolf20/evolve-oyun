// it-esc: Tab ile aç, Esc ile kapat — oyun duraklı mı, ekranda bir işaret var mı?
T.start('normal');
T.sim(5, { dt: 1 / 30 });
const g = EV.Game;
g.paused = false;
const key = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
key('Tab');
key('Escape');
const t0 = g.time;
await new Promise((r) => setTimeout(r, 600));
const vis = [...document.querySelectorAll('.overlay, #lockHint, [id*=ock]')].filter((e) => !e.hidden && getComputedStyle(e).display !== 'none').map((e) => e.id || e.className);
return { paused: g.paused, timeAdvanced: g.time - t0, invHidden: document.getElementById('invPanel').hidden, visibleOverlays: vis };
