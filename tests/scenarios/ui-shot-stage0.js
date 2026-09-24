// UI screenshot: stage0

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

T.start('normal'); T.sim(8); G.paused = true; return audit();
