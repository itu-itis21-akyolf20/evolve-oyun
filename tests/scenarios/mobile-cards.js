const wait = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 50)); } return true; };
await wait(() => window.EV && EV.Game && document.getElementById('mTouch'), 15000);
document.getElementById('nameInput').value = 'TestBot';
document.getElementById('diffNormal').click();
await new Promise((r) => setTimeout(r, 400));
return { cardOpen: !document.getElementById('cardPanel').hidden };
