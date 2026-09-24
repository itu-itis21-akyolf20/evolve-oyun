/* ============================================================
   mobile/boot.js — mobil sürümü masaüstü kodundan kurar

   index.html tek doğruluk kaynağıdır: arayüz iskeleti ve script
   sırası oradan okunur, böylece oyuna eklenen her şey mobilde de
   kendiliğinden gelir. Ardından mobil katman (bridge + controls)
   yüklenir. fetch file:// üzerinde çalışmadığından mobil sürüm
   linkten (GitHub Pages / yerel sunucu) açılır.
   ============================================================ */
(function () {
  'use strict';

  const MOBILE_SCRIPTS = ['mobile/bridge.js', 'mobile/controls.js', 'mobile/assist.js'];
  const status = document.getElementById('mBoot');

  function fail(msg) {
    status.textContent = msg;
    status.classList.add('err');
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error(src + ' yüklenemedi'));
      document.body.appendChild(s);
    });
  }

  async function boot() {
    if (location.protocol === 'file:') {
      fail('Mobil sürüm linkten açılır (ör. …github.io/evolve-oyun/mobile.html).');
      return;
    }
    let html;
    try {
      const r = await fetch('index.html', { cache: 'no-cache' });
      if (!r.ok) throw new Error('index.html: ' + r.status);
      html = await r.text();
    } catch (err) {
      fail('Oyun yüklenemedi: ' + err.message);
      return;
    }

    // aynı kaynaktan gelen kendi sayfamız; scriptler ayrıca sırayla yüklenir
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // index.html'deki stil dosyaları (mobile.html'de henüz yoksa) — yeni eklenenler mobilde de gelsin
    doc.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
      const href = l.getAttribute('href');
      if (!document.querySelector('link[href="' + href + '"]')) {
        const n = document.createElement('link');
        n.rel = 'stylesheet';
        n.href = href;
        document.head.insertBefore(n, document.querySelector('link[href="mobile/mobile.css"]'));
      }
    });
    const scripts = Array.from(doc.querySelectorAll('script[src]'), (s) => s.getAttribute('src'));
    doc.querySelectorAll('script').forEach((s) => s.remove());
    document.body.className = (doc.body.className + ' mobile').trim();
    status.remove();
    document.body.insertAdjacentHTML('afterbegin', doc.body.innerHTML);

    try {
      for (const src of scripts.concat(MOBILE_SCRIPTS)) await loadScript(src);
    } catch (err) {
      document.body.insertAdjacentHTML('beforeend', '<div id="mBoot" class="err"></div>');
      document.getElementById('mBoot').textContent = 'Oyun yüklenemedi: ' + err.message;
    }
  }

  boot();
})();
