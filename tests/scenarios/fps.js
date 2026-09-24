// FPS kamera: V ile aç, kamera göz hizasında, gövde gizli, nişan/saldırı öne; V ile geri
T.start('normal');
T.sim(1, { dt: 1 / 30, bot: false });
const G = EV.Game, P = G.player, cam = G.camera;
const key = (c) => { window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); window.dispatchEvent(new KeyboardEvent('keyup', { code: c })); };
const r = {};
G.enemies.slice().forEach((e) => { if (!e.ally && e.alive) EV.Enemies.despawn(G, G.enemies.indexOf(e)); });
key('KeyV');
T.sim(0.3, { dt: 1 / 30, bot: false });
r.fpsOn = P.fps === true && P.group.visible === false;
const pp = P.group.position;
r.camAtEye = +cam.position.distanceTo(pp).toFixed(2) + ' (boy ' + P.group.userData.height.toFixed(2) + ')';
// önüne düşman koy: nişangah üstüne gelsin, sol tık vursun
const def = EV.MOBS.ENEMIES[0][1];
const e = EV.Enemies.make(G, def, { pos: { x: pp.x + Math.sin(P.yaw) * 3, z: pp.z + Math.cos(P.yaw) * 3 }, hp: 1e5, dmg: 0 });
e.behavior = 'passive'; e.speed = 0;
P.pitch = 0.25;
T.sim(0.2, { dt: 1 / 30, bot: false });
r.hoverInFront = P.hover === e;
const h0 = e.hp;
EV.Input.mouse.left = true;
T.sim(1, { dt: 1 / 30, bot: false });
EV.Input.mouse.left = false;
r.meleeHits = e.hp < h0;
// uzak şarjlı atış FPS'te de
EV.Input.mouse.right = true; EV.Input.mouse.left = true;
T.sim(1.1, { dt: 1 / 30, bot: false });
const h1 = e.hp;
EV.Input.mouse.left = false;
T.sim(0.6, { dt: 1 / 30, bot: false });
EV.Input.mouse.right = false;
r.chargedShotHits = e.hp < h1;
r.saved = localStorage.getItem('evolve_fps');
key('KeyV');
T.sim(0.3, { dt: 1 / 30, bot: false });
r.backToTps = P.fps === false && P.group.visible === true && cam.position.distanceTo(pp) > 3;
key('KeyV');   // ekran görüntüsü FPS'te olsun
T.sim(0.3, { dt: 1 / 30, bot: false });
P.pitch = 0.1;
T.sim(0.1, { dt: 1 / 30, bot: false });
return r;
