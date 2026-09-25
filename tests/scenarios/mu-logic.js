// mu-logic: eski kayıt → mutasyon göçü, bozuk veri, her türün her bedende kurulması,
// vericiler (tüm yaratıklar), av düşüşü, bodyMutations sözleşmesi, hitbox/çizim sabitliği
T.start('normal');
const G = EV.Game, I = EV.Items, C = EV.Creature;
const fails = [], info = {};
const check = (n, c, x) => { if (!c) fails.push({ n, x }); };

/* ---------- 1. eski kayıt (fang/hide/organ/relic/claw/tail, plus, bv, set, unique adları) ---------- */
{
  const old = {
    bag: [{ slot: 'fang', rarity: 2, ilvl: 1, plus: 4, bv: 2, set: 'kurt', affixes: [{ k: 'dmg', roll: 0.9 }, { k: 'crit', roll: 0.8 }, { k: 'atkSpd', roll: 0.7 }], unique: null },
      null, { slot: 'organ', rarity: 4, ilvl: 3, plus: 9, bv: 1, affixes: [{ k: 'cdr', roll: 1 }], unique: 'Öfke Bezesi' }],
    chest: [{ slot: 'relic', rarity: 4, ilvl: 5, plus: 2, bv: 0, affixes: [], unique: 'Kâhin Kemiği' }, { slot: 'claw', rarity: 0, ilvl: 0, affixes: [] }],
    equip: { fang: { slot: 'fang', rarity: 4, ilvl: 2, plus: 7, affixes: [{ k: 'dmg', roll: 1 }], unique: 'Kemik Kıran' },
      hide: { slot: 'hide', rarity: 3, ilvl: 2, plus: 1, set: 'kaya', affixes: [{ k: 'armor', roll: 1 }], unique: null },
      organ: { slot: 'organ', rarity: 1, ilvl: 1, affixes: [{ k: 'speed', roll: 1 }] },
      relic: { slot: 'relic', rarity: 2, ilvl: 1, affixes: [] }, claw: { slot: 'claw', rarity: 3, ilvl: 2, affixes: [] },
      tail: { slot: 'tail', rarity: 4, ilvl: 2, plus: 3, affixes: [], unique: 'Sürü Anası' } },
    essence: 1234,
  };
  const inv = I.deserialize(JSON.parse(JSON.stringify(old)));
  info.migrated = { bag: inv.bag.filter(Boolean).map((x) => x.slot + ':' + x.kind + ':+' + x.plus + ':' + x.name),
    equip: I.SLOTS.map((s) => s.id + '=' + (inv.equip[s.id] ? inv.equip[s.id].name + ' [' + inv.equip[s.id].kind + ']' : '-')) };
  check('4 depot items', inv.bag.filter(Boolean).length === 4);
  check('6 equipped', I.SLOTS.every((s) => inv.equip[s.id]));
  check('fang→jaw unique kept', inv.equip.jaw.unique && inv.equip.jaw.unique.name === 'Kemik Kıran Çene' && inv.equip.jaw.plus === 7);
  check('organ→back', inv.equip.back && inv.equip.back.slot === 'back');
  check('relic→head', inv.equip.head.slot === 'head' && inv.equip.claws.slot === 'claws');
  check('tail unique alias', inv.equip.tail.unique && inv.equip.tail.unique.name === 'Sürü Anası Çıngırağı');
  check('set kept', inv.equip.hide.set === 'kaya' && inv.bag[0].set === 'kurt');
  check('plus kept', inv.bag[0].plus === 4 && inv.bag[1].plus === 9);
  check('affix kept', inv.bag[0].affixes.map((a) => a.k).join() === 'dmg,crit,atkSpd');
  check('unique alias bag', inv.bag[1].unique.name === 'Öfke Dikenleri' && inv.bag[2].unique.name === 'Kâhin Boynuzu');
  check('essence', inv.essence === 1234);
  // yeni biçimde gidiş-dönüş
  const again = I.deserialize(JSON.parse(JSON.stringify(I.serialize(inv))));
  const sig = (x) => x ? [x.slot, x.kind, x.rarity, x.plus, x.name, x.set].join('|') : '-';
  check('roundtrip', I.SLOTS.every((s) => sig(inv.equip[s.id]) === sig(again.equip[s.id])) && inv.bag.map(sig).join() === again.bag.map(sig).join());
  // stat eşitliği: eski eşya → mutasyon modları sonlu
  G.inv = inv; EV.Build.recompute(G);
  check('stats finite', Object.values(G.player.stats).every((v) => typeof v !== 'number' || Number.isFinite(v)));
}

/* ---------- 2. bozuk veri ---------- */
{
  const bad = [null, 5, 'x', [], { bag: 'x', equip: 'y' }, { bag: [{ slot: '__proto__' }, { slot: 'jaw', kind: 'constructor', src: 'toString', di: -5 }, { slot: 'back', kind: 'fangs', src: 'porcupine', di: 99 }, 7, 'a'] },
    { equip: { jaw: { slot: 'hide', rarity: 9 }, fang: { slot: 'fang' } } }, { bag: Array.from({ length: 5000 }, () => ({ slot: 'jaw' })) }];
  bad.forEach((d, i) => {
    try {
      const inv = I.deserialize(d);
      check('bad ' + i + ' shape', inv.bag.length === I.depotSize && I.SLOTS.every((s) => s.id in inv.equip));
      inv.bag.filter(Boolean).forEach((x) => check('bad ' + i + ' kind', I.KINDS[x.kind] && I.KINDS[x.kind].region === x.slot, x));
    } catch (err) { fails.push({ n: 'bad ' + i + ' threw', x: String(err) }); }
  });
  // creature.js: bozuk mutasyon tarifi çökertmez
  const spec = JSON.parse(JSON.stringify(EV.CFG.STAGES[2].body));
  spec.mutations = [null, 3, { kind: '__proto__' }, { kind: 'horns', plus: 'x', rarity: 99, color: 'abc' }, { kind: 'horns', plus: 9 }, { kind: 'quills', plus: -4, color: 1e20, glow: 'y' }];
  try { const g = C.build(spec, 'player'); check('bad spec builds', !!g.userData.mesh); C.dispose(g); } catch (err) { fails.push({ n: 'bad spec threw', x: String(err) }); }
}

/* ---------- 3. her tür × her beden ---------- */
{
  const bodies = {
    cell: EV.CFG.STAGES[0].body, reptile: EV.CFG.STAGES[1].body, mammal: EV.CFG.STAGES[2].body,
    biped: Object.assign({}, EV.CFG.STAGES[1].body, { parts: { legs: 2, tail: 'long' } }),
    snake: Object.assign({}, EV.CFG.STAGES[1].body, { parts: { legs: 0, tail: 'serpent' } }),
    notail: Object.assign({}, EV.CFG.STAGES[1].body, { parts: { legs: 4, tail: 'none' } }),
    noflag: Object.assign({}, EV.CFG.STAGES[0].body, { parts: { flagella: 0 } }),
  };
  const warn = console.warn; let warns = 0; console.warn = function () { warns++; return warn.apply(console, arguments); };
  info.verts = {};
  Object.keys(bodies).forEach((b) => {
    const base = C.build(JSON.parse(JSON.stringify(bodies[b])), 'player');
    const v0 = base.userData.mesh.geometry.attributes.position.count, cap0 = JSON.stringify(base.userData.cap), bones0 = base.userData.mesh.skeleton.bones.length;
    C.dispose(base);
    Object.keys(I.KINDS).forEach((kind) => {
      [0, 9].forEach((plus) => {
        const spec = JSON.parse(JSON.stringify(bodies[b]));
        spec.mutations = [{ region: I.KINDS[kind].region, kind, plus, rarity: plus ? 4 : 0, color: 0xff9a2a, glow: plus ? 1 : 0 }];
        const g = C.build(spec, 'player');
        let meshes = 0; g.traverse((o) => { if (o.isMesh && !o.material.transparent) meshes++; });
        const v = g.userData.mesh.geometry.attributes.position.count;
        check(b + ' ' + kind + ' adds verts', v > v0, [v0, v]);
        check(b + ' ' + kind + ' 1 opaque mesh', meshes === 1, meshes);
        if (b !== 'mammal') check(b + ' ' + kind + ' same hitbox', JSON.stringify(g.userData.cap) === cap0);   // memeli kürkü rastgele: kapsül her kurulumda biraz değişir
        check(b + ' ' + kind + ' same bones', g.userData.mesh.skeleton.bones.length === bones0);
        check(b + ' ' + kind + ' finite', Number.isFinite(g.userData.mesh.geometry.boundingSphere.radius));
        C.animate(g, 0.016, 0.5, 1); C.setGlow(g, { r: 0.1, g: 0, b: 0 }); C.animate(g, 0.016, 0.5, 1.1); C.deathPose(g, 0.5);
        if (plus) info.verts[b + ':' + kind] = v - v0;
        C.dispose(g);
      });
    });
  });
  console.warn = warn;
  check('no build warnings', warns === 0, warns);
}

/* ---------- 4. vericiler ve av düşüşü ---------- */
{
  const M = EV.MOBS;
  const all = [].concat(...M.ENEMIES, ...M.MINIS, M.ALPHAS, M.APEX, M.TREASURE);
  const missing = all.filter((d) => !I.donorParts(d.id)).map((d) => d.id);
  check('every creature donates', missing.length === 0, missing);
  G.stageIndex = 2; G.inv = I.freshInv();
  const IC = EV.CFG.ITEMS, dc = IC.dropChance;
  IC.dropChance = 10;                               // her av düşürsün
  const pos = G.player.group.position.clone();
  const r = I.onKill(G, { def: M.find(2, 'porcupine'), group: { position: pos }, variant: 1 });
  IC.dropChance = dc;
  check('porcupine drops quills', r && r.items.length === 1 && r.items[0].src === 'porcupine' && ['Kirpi Dikeni', 'Dikenli Kuyruk'].includes(I.partInfo(r.items[0]).part), r && r.items.map((x) => x.name));
  const ra = I.onKill(G, { def: M.APEX[2], isApex: true, group: { position: pos } });
  check('apex drops 2 distinct', ra.items.length === 2 && ra.items[0].rarity >= 2 && I.partInfo(ra.items[0]).part !== I.partInfo(ra.items[1]).part, ra.items.map((x) => x.name));
  const rn = I.onKill(G, { def: { id: 'nemesis' }, isNemesis: true, group: { position: pos } });
  check('nemesis part', rn.items.length === 1 && rn.items[0].src === 'nemesis', rn.items.map((x) => x.name));
  info.groundAfter = I.groundCount;
  I.clear(G);
  check('ground → depot', I.depotCount(G.inv) === 4, I.depotCount(G.inv));
  // bodyMutations sözleşmesi
  I.equipFrom(G, 'bag', G.inv.bag.findIndex((x) => x && x.slot === 'back'));
  const bm = I.bodyMutations(G);
  info.bodyMutations = bm;
  check('contract', bm.length === 1 && bm[0].region === 'back' && typeof bm[0].color === 'number' && (bm[0].glow === 0 || bm[0].glow === 1));
  // üretim: her bölge kendi türünden
  G.inv.essence = 1e6;
  I.SLOTS.forEach((s) => { for (let k = 0; k < 20; k++) { const it = I.craft(G, s.id); if (it) { check('craft region ' + s.id, it.slot === s.id && I.KINDS[it.kind].region === s.id); G.inv.bag[G.inv.bag.indexOf(it)] = null; } } });
  check('craft alias', I.craft(G, 'fang').slot === 'jaw');
}
return { fails, info: { migrated: info.migrated, bodyMutations: info.bodyMutations, maxVerts: Math.max(...Object.values(info.verts)) } };
