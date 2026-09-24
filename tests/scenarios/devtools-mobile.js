const wait = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 50)); } return true; };
await wait(() => window.EV && EV.Game && document.getElementById('tBox') && document.getElementById('tBtn'), 15000);
document.getElementById('tStage').value = '1';
document.getElementById('tGo').click();
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1' }));
await new Promise((r) => setTimeout(r, 300));
document.getElementById('tBtn').click();
await new Promise((r) => setTimeout(r, 500));
return { panel: !document.getElementById('tPanel').hidden, stage: EV.Game.stageIndex };
