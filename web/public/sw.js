// Offline: aplikace se spouští z mezipaměti telefonu.
// Každé sestavení má vlastní mezipaměť: při instalaci se stáhnou VŠECHNY soubory verze (podle
// soubory.json z buildu) a teprve když je hotovo, nová verze převezme řízení a stará mezipaměť se smaže.
// Stránka (index.html) se zkouší nejdřív ze sítě, aby se nová verze projevila hned;
// do mezipaměti se ukládají jen bezchybné odpovědi.
const SESTAVENI = '__SESTAVENI__'; // nahradí se při buildu (vite.config.ts)
const MEZIPAMET = `najemnik-${SESTAVENI}`;
const ZAKLAD = ['./', 'manifest.webmanifest', 'ikony/ikona-192.png', 'ikony/ikona-512.png', 'ikony/ikona-maskable-512.png',
  'logo/simply-software-pod.svg', 'logo/simply-software-pod-svetle.svg', 'logo/simply-software-vedle.svg', 'logo/simply-software-vedle-svetle.svg'];

async function souboryVerze() {
  const odpoved = await fetch('soubory.json', { cache: 'no-store' });
  if (!odpoved.ok) return [];
  const manifest = await odpoved.json();
  const soubory = new Set();
  for (const polozka of Object.values(manifest)) {
    if (polozka.file) soubory.add(polozka.file);
    for (const k of ['css', 'assets']) for (const f of polozka[k] ?? []) soubory.add(f);
  }
  return [...soubory];
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(MEZIPAMET);
    const soubory = [...ZAKLAD, ...(await souboryVerze())];
    // Když se něco nestáhne (výpadek sítě), instalace selže a dál běží stará, kompletní verze.
    await cache.addAll(soubory.map(f => new Request(f, { cache: 'no-store' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== MEZIPAMET).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith('http')) return;
  e.respondWith((async () => {
    const cache = await caches.open(MEZIPAMET);
    if (r.mode === 'navigate') {
      try {
        // no-store: GitHub Pages posílá max-age=600, jinak by se po vydání až 10 minut spouštěla stará verze.
        const odpoved = await fetch(r, { cache: 'no-store' });
        if (odpoved.ok) {
          cache.put('./', odpoved.clone());
          return odpoved;
        }
      } catch { /* offline */ }
      return (await cache.match('./')) ?? fetch(r);
    }
    const ulozena = await cache.match(r, { ignoreSearch: true });
    if (ulozena) return ulozena;
    const odpoved = await fetch(r);
    if (odpoved.ok || odpoved.type === 'opaque') cache.put(r, odpoved.clone());
    return odpoved;
  })());
});
