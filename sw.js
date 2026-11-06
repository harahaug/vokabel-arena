// Offline-Cache: App-Dateien + (einmal geladene) Texterkennung
const V = 'vokabelarena-v1';
const APP = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(APP)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url), same = u.origin === location.origin;
  const ocr = /jsdelivr|unpkg|tessdata|projectnaptha|cdnjs/.test(u.hostname);
  if (!same && !ocr) return;
  e.respondWith(
    same ? fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request))
      : caches.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; }))
  );
});
