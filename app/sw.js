// Offline: aplikace se načítá z mezipaměti telefonu. Při každém vydání zvýšit VERZE.
const VERZE = 'najemnik-2';
const SOUBORY = [
  './', 'index.html', 'styly.css', 'app.js', 'logika.js', 'db.js', 'manifest.webmanifest',
  'ikony/ikona-192.png', 'ikony/ikona-512.png', 'ikony/ikona-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERZE).then(c => c.addAll(SOUBORY)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(klice => Promise.all(klice.filter(k => k !== VERZE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r ?? fetch(e.request)));
});
