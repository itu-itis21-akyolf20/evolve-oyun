/* ============================================================
   evocine.js — evrim sinematiği: koza → geçiş → yumurtadan çıkış

   1) SARILMA (1.5 sn): oyun durur; bedenin etrafında ışıyan iplik
      halkaları yükselir, organik bir koza örülür; beden içeride
      parlar ve küçülür; kamera yaklaşıp etrafında döner.
   2) GEÇİŞ: beyaz parlama; arkasında dünya yeni çağa kurulur
      (onSwitch), koza yeni bedenin yerine taşınır.
   3) ÇIKIŞ (1.9 sn): koza nabız gibi atar, çatlar; kabuk parçaları
      savrulur, yeni beden içinden büyüyerek çıkar; kamera arkaya döner.
   Bitince onDone (başlangıç kartı vb.). Işık eklenmez (tüm materyaller
   yeniden derlenmesin): parlaklık emissive ve toplamalı karışımla.
   ============================================================ */
window.EV = window.EV || {};

EV.EvoCine = (function () {
  'use strict';

  const U = EV.U;
  const WRAP = 1.5, GAP = 0.35, HATCH = 1.9;
  const CRACK = 0.7;                                  // çıkış evresinde çatlama anı
  let cine = null;
  let flashEl = null;

  function flash(on) {
    if (!flashEl) {
      flashEl = document.createElement('div');
      flashEl.id = 'evoFlash';
      (document.getElementById('app') || document.body).appendChild(flashEl);
    }
    flashEl.style.opacity = on ? '1' : '0';
  }

  /** Organik koza: gürültüyle bozulmuş elipsoit. */
  function cocoonMesh(r, h) {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const pale = new THREE.Color(0xf6d890), vein = new THREE.Color(0x9a5a12), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.07 * Math.sin(x * 7 + y * 5) * Math.cos(z * 6 - y * 4) + 0.04 * Math.sin(y * 13);
      p.setXYZ(i, x * r * n, (y * 0.5 + 0.5) * h * n, z * r * n);
      // damarlar: uzunlamasına ince koyu çizgiler + dolanan lif
      const a = Math.atan2(z, x);
      const v = Math.abs(Math.sin(a * 5 + y * 2.2)) < 0.12 || Math.abs(Math.sin(a * 3 - y * 6)) < 0.07 ? 1 : 0;
      c.copy(pale).lerp(vein, v * 0.75 + (1 - (y * 0.5 + 0.5)) * 0.2);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xff9a2a, emissiveIntensity: 0.2, roughness: 0.4,
      metalness: 0, flatShading: true, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(g, m);
    // ışıyan hale: arka yüzleri toplamalı çizilen biraz büyük kabuk
    const halo = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false }));
    halo.scale.setScalar(1.16);
    mesh.add(halo);
    mesh.userData.halo = halo;
    return mesh;
  }

  /** Yukarıdan inen ışık huzmesi. */
  function beamMesh(r, h) {
    const g = new THREE.CylinderGeometry(r * 0.9, r * 1.6, h * 5, 18, 1, true);
    g.translate(0, h * 2.5, 0);
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  }

  function threads(r, h) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.95, depthWrite: false });
    for (let i = 0; i < 7; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 5, 32), mat);
      t.rotation.x = Math.PI / 2 + U.rand(-0.35, 0.35);
      t.rotation.y = U.rand(-0.35, 0.35);
      t.userData = { k: i / 6, spin: U.rand(2, 4) * (i % 2 ? 1 : -1) };
      grp.add(t);
    }
    grp.userData = { r, h, mat };
    return grp;
  }

  function shards(pos, r, h, mat) {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.55, 0), mat);
      m.scale.set(1, 1.3, 0.35);
      m.position.set(pos.x + Math.cos(a) * r * 0.6, pos.y + h * U.rand(0.3, 0.7), pos.z + Math.sin(a) * r * 0.6);
      m.lookAt(pos.x, m.position.y, pos.z);
      m.userData.v = new THREE.Vector3(Math.cos(a) * U.rand(5, 9), U.rand(4, 8), Math.sin(a) * U.rand(5, 9));
      m.userData.w = new THREE.Vector3(U.rand(-6, 6), U.rand(-6, 6), U.rand(-6, 6));
      out.push(m);
    }
    return out;
  }

  /** Oyuncunun boyuna göre koza ölçüsü. */
  function size(P) {
    const u = P.group.userData, c = u.cap;
    const len = (c.hl + c.r) * 0.95;
    return { r: Math.max(len, c.r * 1.25, 0.8), h: Math.max(u.height * 1.25, 1.5) };
  }

  function play(game, opts) {
    const P = game.player;
    const s = size(P);
    const scene = game.scene;
    const coc = cocoonMesh(s.r, s.h);
    const thr = threads(s.r, s.h);
    const beam = beamMesh(s.r, s.h);
    coc.position.copy(P.group.position);
    thr.position.copy(P.group.position);
    beam.position.copy(P.group.position);
    scene.add(coc);
    scene.add(thr);
    scene.add(beam);
    cine = { game, opts, t: 0, phase: 'wrap', coc, thr, beam, s, shards: [], switched: false, cracked: false, spark: 0,
      yaw0: P.yaw, orbit: 0, dist0: game.stage().cam.dist * P.sizeScale * P.zoom };
    document.body.classList.add('cine');
    U.audio.levelUp();
  }

  const easeOutBack = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

  function camera(game, k, closer) {
    const P = game.player, cam = game.camera;
    const c = P.group.position;
    const h = P.group.userData.height;
    cine.orbit += (1 - k * 0.6) * 0.9 * cine.dt;
    const a = cine.yaw0 + cine.orbit;
    const dist = cine.dist0 * (1 - 0.38 * closer);
    const cy = c.y + h * 0.55;
    cam.position.set(c.x - Math.sin(a) * dist, cy + dist * 0.32, c.z - Math.cos(a) * dist);
    cam.lookAt(c.x, cy, c.z);
    cam.updateMatrixWorld();
    P.yaw = a;
  }

  /** Işımayı kapat: animate() glow=null iken emissive'i kendiliğinden sıfırlamıyor. */
  function unglow(group) {
    EV.Creature.setGlow(group, null);
    const m = group.userData.mats && group.userData.mats.solid;
    if (m && m.emissive) m.emissive.setRGB(0, 0, 0);
  }

  function update(game, dt) {
    if (!cine) return;
    cine.dt = dt;
    cine.t += dt;
    cine.anim = (cine.anim || 0) + dt;
    const P = game.player;
    const { coc, thr, s, beam } = cine;
    // yükselen kıvılcımlar
    cine.spark -= dt;
    if (cine.spark <= 0 && !cine.cracked) {
      cine.spark = 0.12;
      const p = coc.position;
      EV.FX.burst(new THREE.Vector3(p.x + U.rand(-1, 1) * cine.s.r, p.y + U.rand(0.2, 0.8) * cine.s.h, p.z + U.rand(-1, 1) * cine.s.r), 0xffd060, 2, 3);
    }
    EV.Creature.animate(game.player.group, dt, 0, cine.anim);     // oyun dururken de nefes alsın

    if (cine.phase === 'wrap') {
      const k = Math.min(1, cine.t / WRAP);
      // iplikler aşağıdan yukarı sarılır, koza belirginleşir
      thr.children.forEach((t) => {
        const y = Math.min(1, k * 1.4 - t.userData.k * 0.4);
        t.position.y = Math.max(0, y) * s.h * 0.9 + 0.1;
        const rr = s.r * (1.35 - 0.3 * k) * Math.sin(Math.PI * (0.15 + Math.max(0, y) * 0.75));
        t.scale.setScalar(Math.max(0.05, rr));
        t.rotation.z += dt * t.userData.spin;
        t.visible = y > 0;
      });
      coc.material.opacity = Math.min(0.95, Math.max(0, (k - 0.25) * 1.4));
      coc.material.emissiveIntensity = 0.25 + k * 0.7 + Math.sin(cine.t * 14) * 0.08;
      coc.userData.halo.material.opacity = k * 0.35;
      beam.material.opacity = k * 0.22;
      coc.scale.set(1, Math.min(1, 0.15 + k * 1.1), 1);
      P.group.scale.setScalar(1 - 0.18 * k);
      EV.Creature.setGlow(P.group, { r: 0.6 * k, g: 0.45 * k, b: 0.15 * k });
      camera(game, k, k * 0.55);
      if (k >= 1) {
        cine.phase = 'gap';
        cine.t = 0;
        flash(true);
      }
    } else if (cine.phase === 'gap') {
      camera(game, 1, 0.55);
      if (!cine.switched && cine.t > 0.12) {
        cine.switched = true;
        unglow(P.group);
        cine.opts.onSwitch();                             // dünya yeniden kurulur, yeni beden
        const np = game.player.group.position;
        coc.position.copy(np);
        thr.position.copy(np);
        beam.position.copy(np);
        EV.UI.updateBoss(game, game.camera);                 // eski aşamanın boss çubuğu kalmasın
        const ns = size(game.player);
        cine.s = ns;
        coc.scale.set(ns.r / s.r, ns.h / s.h, ns.r / s.r);
        game.player.group.scale.setScalar(0.001);
        cine.yaw0 = game.player.yaw;
        cine.dist0 = game.stage().cam.dist * game.player.sizeScale * game.player.zoom;
        cine.orbit = 0;
      }
      if (cine.t >= GAP) {
        cine.phase = 'hatch';
        cine.t = 0;
        flash(false);
      }
    } else if (cine.phase === 'hatch') {
      const k = Math.min(1, cine.t / HATCH);
      const P2 = game.player;
      if (!cine.cracked) {
        // nabız: giderek hızlanan atışlar
        const beat = 1 + Math.max(0, Math.sin(cine.t * (8 + cine.t * 18))) * 0.06 * (cine.t / CRACK);
        coc.scale.x = coc.scale.z = beat * (cine.s.r / s.r);
        coc.material.emissiveIntensity = 0.9 + cine.t * 1.1;
        coc.userData.halo.material.opacity = 0.35 + Math.max(0, Math.sin(cine.t * 20)) * 0.25;
        thr.children.forEach((t) => { t.rotation.z += dt * t.userData.spin * 2; });
        if (cine.t >= CRACK) {
          cine.cracked = true;
          cine.shards = shards(coc.position, cine.s.r, cine.s.h, coc.material);
          cine.shards.forEach((m) => game.scene.add(m));
          coc.visible = false;
          thr.visible = false;
          beam.material.opacity = 0.45;
          EV.FX.burst(coc.position.clone().setY(coc.position.y + cine.s.h * 0.5), 0xffe08a, 26, 12);
          EV.FX.ring(coc.position, 0xffe08a, cine.s.r * 4, 0.9);
          U.audio.evolve();
          if (cine.opts.onCrack) cine.opts.onCrack();
        }
      } else {
        const e = Math.min(1, (cine.t - CRACK) / (HATCH - CRACK - 0.25));
        P2.group.scale.setScalar(Math.max(0.05, 0.3 + 0.7 * easeOutBack(e)));
        cine.shards.forEach((m) => {
          m.userData.v.y -= 18 * dt;
          m.position.addScaledVector(m.userData.v, dt);
          m.rotation.x += m.userData.w.x * dt; m.rotation.y += m.userData.w.y * dt;
        });
        coc.material.opacity = Math.max(0, 0.92 * (1 - e));
        beam.material.opacity = 0.45 * (1 - e);
      }
      camera(game, 0.4 + 0.6 * k, 0.55 * (1 - k));
      if (k >= 1) finish(game);
    }
  }

  function finish(game) {
    const c = cine;
    cine = null;
    const scene = game.scene;
    [c.coc, c.thr, c.beam].concat(c.shards).forEach((m) => scene.remove(m));
    c.coc.geometry.dispose();
    c.coc.material.dispose();
    c.coc.userData.halo.material.dispose();
    c.beam.geometry.dispose();
    c.beam.material.dispose();
    document.body.classList.remove('cine');
    EV.UI.updateBoss(game, game.camera);
    c.thr.children.forEach((t) => t.geometry.dispose());
    c.thr.userData.mat.dispose();
    c.shards.forEach((m) => m.geometry.dispose());
    game.player.group.scale.setScalar(1);
    unglow(game.player.group);
    flash(false);
    c.opts.onDone();
  }

  return { play, update, get active() { return !!cine; } };
})();
