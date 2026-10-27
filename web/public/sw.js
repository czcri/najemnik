// Offline: aplikace se po prvním načtení spouští z mezipaměti telefonu.
// Stránka (index.html) se zkouší nejdřív ze sítě, aby se nová verze projevila hned;
// ostatní soubory mají v názvu otisk obsahu, takže stačí mezipaměť.
const MEZIPAMET = 'najemnik-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== MEZIPAMET).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith('http')) return;
  const stranka = r.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(MEZIPAMET);
    if (stranka) {
      try {
        const odpoved = await fetch(r);
        cache.put(r, odpoved.clone());
        return odpoved;
      } catch {
        return (await cache.match(r, { ignoreSearch: true })) ?? (await cache.match('./')) ?? Response.error();
      }
    }
    const ulozena = await cache.match(r);
    if (ulozena) return ulozena;
    const odpoved = await fetch(r);
    if (odpoved.ok || odpoved.type === 'opaque') cache.put(r, odpoved.clone());
    return odpoved;
  })());
});
