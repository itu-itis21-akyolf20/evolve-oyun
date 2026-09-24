// Mobil sürüm: mobile.html yüklenir, dokunmatik çubuk/bakış/düğmeler oyunu sürer
const wait = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 50)); } return true; };
const r = {};
r.booted = await wait(() => window.EV && EV.Game && EV.MobileBridge && document.getElementById('mTouch'), 15000);
if (!r.booted) return r;
r.sameUi = !!document.getElementById('startPanel') && !!document.getElementById('hud');
T.start('normal');
await new Promise((res) => setTimeout(res, 300));
const G = EV.Game, P = G.player, root = document.getElementById('mTouch');
r.touchVisible = getComputedStyle(root).display !== 'none';

let tid = 1;
const touch = (type, x, y, id, target) => {
  const t = new Touch({ identifier: id, target: target || root, clientX: x, clientY: y });
  (target || root).dispatchEvent(new TouchEvent(type, { changedTouches: [t], touches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true }));
};
const W = innerWidth, H = innerHeight;

// 1) çubuk: yukarı it → W basılı → ileri yürür
const p0 = P.group.position.clone();
const s = tid++;
touch('touchstart', 120, H - 100, s);
touch('touchmove', 120, H - 170, s);
r.stickW = EV.Input.down('KeyW');
T.sim(1.5, { dt: 1 / 30, bot: false });
r.moved = +P.group.position.distanceTo(p0).toFixed(1);
touch('touchend', 120, H - 170, s);
r.stickReleased = !EV.Input.down('KeyW');

// 2) sağ yarıda sürükle → kamera döner
const yaw0 = P.yaw;
const l = tid++;
touch('touchstart', W * 0.6, H * 0.4, l);
touch('touchmove', W * 0.6 + 80, H * 0.4, l);
T.sim(0.1, { dt: 1 / 30, bot: false });
touch('touchend', W * 0.6 + 80, H * 0.4, l);
r.lookTurned = Math.abs(P.yaw - yaw0) > 0.1;

// 3) saldırı düğmesi → sol tık; uzak atış → sağ+sol
const atk = root.querySelector('.mAtk'), sh = root.querySelector('.mShoot');
const a = tid++;
touch('touchstart', 0, 0, a, atk);
r.attackHeld = EV.Input.mouse.left && !EV.Input.mouse.right;
touch('touchend', 0, 0, a, atk);
const b = tid++;
touch('touchstart', 0, 0, b, sh);
r.shootHeld = EV.Input.mouse.left && EV.Input.mouse.right;
touch('touchend', 0, 0, b, sh);
r.buttonsReleased = !EV.Input.mouse.left && !EV.Input.mouse.right;

// 4) yetenek ikonları doldu mu, menü düğmesi liderliği açıyor mu
await new Promise((res) => setTimeout(res, 200));
r.skillIcons = Array.from(root.querySelectorAll('.mSkill .ic'), (x) => x.textContent);
const m = tid++;
touch('touchstart', 0, 0, m, root.querySelector('[data-a="menu"]'));
touch('touchend', 0, 0, m, root.querySelector('[data-a="menu"]'));
r.menuOpensBoard = EV.Online.isOpen() && G.paused;
document.getElementById('lbClose').click();
r.boardClosedResumed = !EV.Online.isOpen() && !G.paused;

// 5) çanta düğmesi
const bg = tid++;
touch('touchstart', 0, 0, bg, root.querySelector('[data-a="bag"]'));
touch('touchend', 0, 0, bg, root.querySelector('[data-a="bag"]'));
r.bagOpens = EV.Inv.isOpen();
EV.Inv.close(); G.resume();
T.sim(20, { dt: 1 / 30 });
return r;
