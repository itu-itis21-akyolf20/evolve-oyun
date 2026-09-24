// Mobil nişan yardımı: en yakına kilitlenir, kamera hedefe döner, 🤖 kapatınca bırakır; 🎯 basılı tut = şarj
const wait = async (fn, ms) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 50)); } return true; };
await wait(() => window.EV && EV.Game && EV.MobileAssist && document.getElementById('mTouch'), 15000);
T.start('normal');
const G = EV.Game, P = G.player, root = document.getElementById('mTouch');
const def = EV.MOBS.ENEMIES[0][1];
G.enemies.slice().forEach((e) => { if (!e.ally && e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
const pp = P.group.position;
const behind = P.yaw + Math.PI * 0.8;          // hedefi kameranın arkasına koy
const e = EV.Enemies.make(G, def, { pos: { x: pp.x + Math.sin(behind) * 10, z: pp.z + Math.cos(behind) * 10 }, hp: 1e6, dmg: 0 });
e.behavior = 'passive'; e.speed = 0;
const yaw0 = P.yaw;
await new Promise((r) => setTimeout(r, 1500));
const r = { assistOn: EV.MobileAssist.isOn(), locked: P.lockTarget === e };
const want = Math.atan2(e.group.position.x - pp.x, e.group.position.z - pp.z);
r.camTurnedToTarget = Math.abs(EV.U.wrapAngle(P.yaw - want)) < 0.3 && Math.abs(EV.U.wrapAngle(P.yaw - yaw0)) > 1;
// 🎯 basılı tut → şarj → bırak
let tid = 50;
const touch = (type, target) => { const t = new Touch({ identifier: tid, target, clientX: 0, clientY: 0 }); target.dispatchEvent(new TouchEvent(type, { changedTouches: [t], touches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true })); };
const sh = root.querySelector('.mShoot');
touch('touchstart', sh);
await new Promise((r2) => setTimeout(r2, 1100));
r.charged = EV.Player.charge(G);
const d0 = G.stats.totalDmg;
touch('touchend', sh);
await new Promise((r2) => setTimeout(r2, 800));
r.chargedShotDmg = Math.round(G.stats.totalDmg - d0);
// 🤖 kapat
tid++;
const ab = root.querySelector('.mAssist');
touch('touchstart', ab); touch('touchend', ab);
await new Promise((r2) => setTimeout(r2, 200));
r.offReleases = !EV.MobileAssist.isOn() && P.lockTarget == null && ab.classList.contains('off');
touch('touchstart', ab); touch('touchend', ab);
r.skillBorder = getComputedStyle(root.querySelector('.m-skill1')).getPropertyValue('--sk');
return r;
