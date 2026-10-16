// Bitácora de Ruta — service worker: app offline + caché de mapas y consultas
const V = 'bitacora-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'tiles').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Teselas del mapa: caché primero (sirve sin señal en ruta)
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(caches.open('tiles').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch { return hit || Response.error(); }
    }));
    return;
  }
  // App y librerías: caché primero, actualiza en segundo plano
  if (url.origin === location.origin || /unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // APIs (clima, cambio, fotos): red primero, si no hay señal usa lo último guardado
  if (/open-meteo|er-api|dolarapi|wikipedia|wikimedia/.test(url.hostname)) {
    e.respondWith(fetch(req).then(r => { const cl = r.clone(); caches.open(V).then(c => c.put(req, cl)); return r; }).catch(() => caches.match(req)));
  }
});
