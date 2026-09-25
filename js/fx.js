/* ============================================================
   fx.js — görsel efektler: patlama parçacıkları, halka,
   pençe/ısırık yayı (saldırı animasyonu), şimşek ışını.
   Oyun mantığı içermez; hepsi kendi kendine söner.
   ============================================================ */
window.EV = window.EV || {};

EV.FX = (function () {
  'use strict';

  const U = EV.U;
  let scene = null;
  const items = [];            // { mesh, life, max, update(fx, dt, k) }
  const MAX_BITS = 260;        // ekran kalabalıklaşınca parçacık sınırı
  let bitCount = 0;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);   // tüm parçacıklar paylaşır

  function init(sc) { scene = sc; }

  function push(mesh, life, update, isBit) {
    scene.add(mesh);
    items.push({ mesh, life, max: life, update, isBit: !!isBit });
    if (isBit) bitCount++;
  }

  /* ---- küçük küp patlaması ---- */
  function burst(pos, color, n, power) {
    n = Math.min(n || 10, MAX_BITS - bitCount);
    for (let i = 0; i < n; i++) {
      const s = U.rand(0.12, 0.32);
      const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.scale.set(s, s, s);
      m.position.copy(pos);
      const a = U.rand(0, Math.PI * 2), p = power || 7;
      const vel = new THREE.Vector3(Math.cos(a) * U.rand(1, p), U.rand(3, p), Math.sin(a) * U.rand(1, p));
      const spin = U.rand(-8, 8);
      push(m, U.rand(0.45, 1.0), (it, dt) => {
        vel.y -= 22 * dt;
        it.mesh.position.addScaledVector(vel, dt);
        it.mesh.rotation.x += spin * dt;
        it.mesh.rotation.y += spin * dt;
        it.mesh.material.opacity = U.clamp(it.life / 0.4, 0, 1);
      }, true);
    }
  }

  /* ---- genişleyen yer halkası ---- */
  function ring(pos, color, maxR, life) {
    const geo = new THREE.RingGeometry(0.4, 0.75, 28);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
    }));
    m.position.set(pos.x, pos.y + 0.35, pos.z);
    const R = maxR || 6;
    push(m, life || 0.5, (it) => {
      const k = 1 - it.life / it.max;
      const s = 0.4 + k * R;
      it.mesh.scale.set(s, 1, s);
      it.mesh.material.opacity = 0.85 * (1 - k);
    });
  }

  /* ---- saldırı yayı: pençe/ısırık/kamçı izini gösteren hilal ---- */
  function slash(pos, yaw, radius, arc, color, y) {
    const a = arc || 1.4;
    const geo = new THREE.RingGeometry(radius * 0.55, radius, 18, 1, -Math.PI / 2 - a / 2, a);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: color || 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false,
    }));
    m.position.set(pos.x, (y == null ? pos.y + 0.9 : y), pos.z);
    m.rotation.y = yaw;
    push(m, 0.2, (it) => {
      const k = 1 - it.life / it.max;
      it.mesh.material.opacity = 0.9 * (1 - k);
      it.mesh.scale.set(0.8 + k * 0.35, 1, 0.8 + k * 0.35);
    });
  }

  /* ---- şimşek ışını (zincir yetenekleri) ---- */
  function beam(from, to, color) {
    const d = from.distanceTo(to);
    if (d < 0.01) return;
    const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: color || 0x9fe0ff, transparent: true, opacity: 0.9 }));
    m.scale.set(0.14, 0.14, d);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to);
    push(m, 0.16, (it) => {
      it.mesh.material.opacity = 0.9 * (it.life / it.max);
      it.mesh.scale.x = it.mesh.scale.y = 0.08 + 0.12 * (it.life / it.max);
    });
  }

  function update(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.life -= dt;
      if (it.life <= 0) {
        scene.remove(it.mesh);
        if (it.mesh.geometry !== boxGeo) it.mesh.geometry.dispose();
        it.mesh.material.dispose();
        if (it.isBit) bitCount--;
        items.splice(i, 1);
        continue;
      }
      it.update(it, dt);
    }
  }

  function clear() {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      scene.remove(it.mesh);
      if (it.mesh.geometry !== boxGeo) it.mesh.geometry.dispose();
      it.mesh.material.dispose();
    }
    items.length = 0;
    bitCount = 0;
  }

  return { init, burst, ring, slash, beam, update, clear, get count() { return items.length; } };
})();
