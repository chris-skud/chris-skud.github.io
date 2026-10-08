/* Minimal service worker: cache the app shell so it runs offline + installs as
 * a PWA. Bump CACHE when any listed file changes. */
const CACHE = 'guitarra-v2';
const ASSETS = [
  './', './index.html', './style.css?v=1',
  './theory.js?v=1', './audio.js?v=1', './storage.js?v=1', './drills.js?v=1',
  './fretboard.js?v=2', './metronome.js?v=1', './app.js?v=1',
  './manifest.json', './icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for our own assets; network for everything else.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
