// mu-shots: bedende mutasyonlar — her aşama (hücre / sürüngen / memeli), iki donanım, +0 ve +9.
// Kanvas görüntüleri (kırpılmış PNG, base64) ve çizim çağrısı ölçümü döner.
// Görüntüleri dosyaya yazmak için: node tests/cdp-run.mjs ... > out.json && node tests/mu-decode.mjs out.json tests/mu-shots
const G = EV.Game, I = EV.Items;
T.start('normal');
EV.GFX.setPref('med');
EV.Player.rebuild(G);
// player.js spec.mutations satırı henüz yoksa (koordinatör ekleyecek) test için aynı veriyi enjekte et
const native = !!(G.player.bodySpec && Array.isArray(G.player.bodySpec.mutations));
if (!native) {
  const ob = EV.Creature.build;
  EV.Creature.build = (spec, kind) => { if (kind === 'player' && spec && !spec.mutations) spec.mutations = I.bodyMutations(G); return ob(spec, kind); };
}
const LOAD = {
  0: [['fangs', 'hooks', 'spines', 'stinger', 'antennae', 'glands'], ['mandibles', 'claws', 'sail', 'fin', 'eye', 'capsid']],
  1: [['fangs', 'sickle', 'plates', 'club', 'frill', 'scutes'], ['mandibles', 'talons', 'wings', 'rattle', 'crest', 'slime']],
  2: [['sabre', 'claws', 'quills', 'brush', 'antlers', 'fur'], ['tusks', 'talons', 'sail', 'whip', 'horns', 'musk']],
};
const out = { native, shots: {}, calls: {}, errors: [] };
window.addEventListener('error', (e) => out.errors.push(String(e.message)));
const cam = G.camera;
EV.Player.updateCamera = () => {};            // duraklatılmışken kamerayı test yönetir
const crop = document.createElement('canvas');
crop.width = 760; crop.height = 560;
const cx = crop.getContext('2d');

function equip(kinds, plus, rarBase) {
  I.SLOTS.forEach((s) => { G.inv.equip[s.id] = null; });
  (kinds || []).forEach((kind, i) => {
    const reg = I.KINDS[kind].region;
    const it = I.makeItem(reg, rarBase + (i % 3 === 2 ? 1 : 0), G.stageIndex);
    it.kind = kind;
    it.plus = plus;
    G.inv.equip[reg] = it;
  });
  EV.Build.recompute(G);
  I.refreshBody(G);
}

function view(yawOff) {
  const P = G.player, p = P.group.position, s = P.sizeScale, u = P.group.userData;
  P.group.rotation.y = 0;
  const cell = G.stageIndex === 0;
  const d = (cell ? 6.2 : 7.4) * s, a = yawOff;
  cam.position.set(p.x + Math.sin(a) * d, p.y + u.hipY + (cell ? 1.8 : 1.6) * s, p.z + Math.cos(a) * d);
  cam.lookAt(p.x, p.y + u.hipY * (cell ? 1 : 0.8), p.z - 0.3 * s);
  cam.updateMatrixWorld();
}

function snap(name) {
  G.renderer.render(G.scene, cam);
  const cv = G.renderer.domElement;
  const sx = (cv.width - crop.width) / 2, sy = (cv.height - crop.height) / 2;
  cx.drawImage(cv, sx, sy, crop.width, crop.height, 0, 0, crop.width, crop.height);
  out.shots[name] = crop.toDataURL('image/png');
  return G.renderer.info.render.calls;
}

for (const st of [0, 1, 2]) {
  G.stageIndex = st;
  G.startStage(false);
  for (let k = 0; k < 5 && T.handleModals({ pick: 'first' }); k++);
  G.pause();
  // oyuncunun yakınındaki düşmanları kaldır (görüntü temiz olsun, çağrı sayısı sabit kalsın)
  G.enemies.slice().forEach((e) => EV.Enemies.despawn(G, G.enemies.indexOf(e)));
  equip(null, 0, 0);
  view(0.95);
  const c0 = snap('s' + st + '-none');
  for (let li = 0; li < 2; li++) {
    equip(LOAD[st][li], 0, 0);
    view(li ? -1.0 : 0.95);
    const c1 = snap('s' + st + '-' + String.fromCharCode(97 + li) + '-p0');
    equip(LOAD[st][li], 9, 3);
    const c2 = snap('s' + st + '-' + String.fromCharCode(97 + li) + '-p9');
    out.calls['s' + st + li] = { none: c0, p0: c1, p9: c2 };
  }
  // aynı kamera açısından mutasyonsuz / +9 çağrı karşılaştırması
  equip(null, 0, 0); view(0.95); const n0 = snap('s' + st + '-none2');
  equip(LOAD[st][0], 9, 3); view(0.95); const n9 = (G.renderer.render(G.scene, cam), G.renderer.info.render.calls);
  let meshes = 0; G.player.group.traverse((o) => { if (o.isMesh) meshes++; });
  out.calls['s' + st + 'same'] = { none: n0, p9: n9, playerMeshes: meshes, verts: G.player.group.userData.mesh.geometry.attributes.position.count };
  delete out.shots['s' + st + '-none2'];
}
return out;
