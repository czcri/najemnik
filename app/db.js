// Úložiště v telefonu (IndexedDB). Data nikam neodcházejí.
const NAZEV = 'najemnik';
const VERZE = 1;

let spojeni;
function otevri() {
  spojeni ??= new Promise((ok, chyba) => {
    const r = indexedDB.open(NAZEV, VERZE);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('najemnici', { keyPath: 'id' });
      db.createObjectStore('platby', { keyPath: 'id' }).createIndex('najemnikId', 'najemnikId');
      db.createObjectStore('meta');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => chyba(r.error);
  });
  return spojeni;
}

async function transakce(stores, rezim, prace) {
  const db = await otevri();
  return new Promise((ok, chyba) => {
    const tx = db.transaction(stores, rezim);
    let vysledek;
    tx.oncomplete = () => ok(vysledek);
    tx.onerror = tx.onabort = () => chyba(tx.error);
    vysledek = prace(tx);
  });
}

const pozadavek = r => new Promise((ok, chyba) => { r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error); });

export async function vsechny(store) {
  const db = await otevri();
  return pozadavek(db.transaction(store).objectStore(store).getAll());
}

export const uloz = (store, obj) => transakce(store, 'readwrite', tx => { tx.objectStore(store).put(obj); });
export const smaz = (store, id) => transakce(store, 'readwrite', tx => { tx.objectStore(store).delete(id); });

export async function meta(klic) {
  const db = await otevri();
  return pozadavek(db.transaction('meta').objectStore('meta').get(klic));
}
export const nastavMeta = (klic, hodnota) => transakce('meta', 'readwrite', tx => { tx.objectStore('meta').put(hodnota, klic); });

// Smaže nájemníka i všechny jeho platby najednou.
export const smazNajemnika = id => transakce(['najemnici', 'platby'], 'readwrite', tx => {
  tx.objectStore('najemnici').delete(id);
  const index = tx.objectStore('platby').index('najemnikId');
  index.openKeyCursor(IDBKeyRange.only(id)).onsuccess = e => {
    const c = e.target.result;
    if (c) { tx.objectStore('platby').delete(c.primaryKey); c.continue(); }
  };
});

// Obnova ze zálohy: vše smazat a nahrát znovu v jedné transakci.
export const nahradVse = (najemnici, platby) => transakce(['najemnici', 'platby'], 'readwrite', tx => {
  const n = tx.objectStore('najemnici'), p = tx.objectStore('platby');
  n.clear(); p.clear();
  najemnici.forEach(x => n.put(x));
  platby.forEach(x => p.put(x));
});
