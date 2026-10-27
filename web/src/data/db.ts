// Úložiště v telefonu (IndexedDB). Data nikam neodcházejí.
import type { Data, Nastaveni } from '../types';
import { vychoziNastaveni } from './vychozi';

const NAZEV = 'najemnik-v2';
const VERZE = 1;
const KOLEKCE = ['najemnici', 'platby', 'vydaje', 'upominky'] as const;
type Kolekce = (typeof KOLEKCE)[number];

let spojeni: Promise<IDBDatabase> | undefined;
function otevri(): Promise<IDBDatabase> {
  spojeni ??= new Promise((ok, chyba) => {
    const r = indexedDB.open(NAZEV, VERZE);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const k of KOLEKCE) db.createObjectStore(k, { keyPath: 'id' });
      db.createObjectStore('meta');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => chyba(r.error);
  });
  return spojeni;
}

const pozadavek = <T>(r: IDBRequest<T>) =>
  new Promise<T>((ok, chyba) => { r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error); });

async function zapis(stores: string[], prace: (tx: IDBTransaction) => void) {
  const db = await otevri();
  return new Promise<void>((ok, chyba) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.oncomplete = () => ok();
    tx.onerror = tx.onabort = () => chyba(tx.error);
    prace(tx);
  });
}

export async function nactiVse(): Promise<Data> {
  const db = await otevri();
  const tx = db.transaction([...KOLEKCE, 'meta']);
  const [najemnici, platby, vydaje, upominky, nastaveni] = await Promise.all([
    ...KOLEKCE.map(k => pozadavek(tx.objectStore(k).getAll())),
    pozadavek(tx.objectStore('meta').get('nastaveni')),
  ]);
  return { najemnici, platby, vydaje, upominky, nastaveni: { ...vychoziNastaveni(), ...(nastaveni as Partial<Nastaveni>) } } as Data;
}

export const uloz = (k: Kolekce, ...objekty: { id: string }[]) =>
  zapis([k], tx => objekty.forEach(o => tx.objectStore(k).put(o)));

export const smaz = (k: Kolekce, ...ids: string[]) =>
  zapis([k], tx => ids.forEach(id => tx.objectStore(k).delete(id)));

export const ulozNastaveni = (n: Nastaveni) => zapis(['meta'], tx => { tx.objectStore('meta').put(n, 'nastaveni'); });

// Nájemník se smaže i se všemi platbami, výdaji a upomínkami.
export async function smazNajemnika(id: string, data: Data) {
  await zapis([...KOLEKCE], tx => {
    tx.objectStore('najemnici').delete(id);
    for (const k of ['platby', 'vydaje', 'upominky'] as const) {
      data[k].filter(x => x.najemnikId === id).forEach(x => tx.objectStore(k).delete(x.id));
    }
  });
}

// Více změn najednou (import výpisu): vše, nebo nic.
export const davka = (zmeny: { uloz?: Partial<Record<Kolekce, { id: string }[]>>; smaz?: Partial<Record<Kolekce, string[]>>; nastaveni?: Nastaveni }) =>
  zapis([...KOLEKCE, 'meta'], tx => {
    for (const [k, seznam] of Object.entries(zmeny.uloz ?? {})) seznam?.forEach(o => tx.objectStore(k).put(o));
    for (const [k, seznam] of Object.entries(zmeny.smaz ?? {})) seznam?.forEach(id => tx.objectStore(k).delete(id));
    if (zmeny.nastaveni) tx.objectStore('meta').put(zmeny.nastaveni, 'nastaveni');
  });

// Obnova ze zálohy: všechno smazat a nahrát znovu v jedné transakci.
export const nahradVse = (data: Data) =>
  zapis([...KOLEKCE, 'meta'], tx => {
    for (const k of KOLEKCE) {
      tx.objectStore(k).clear();
      (data[k] as { id: string }[]).forEach(o => tx.objectStore(k).put(o));
    }
    tx.objectStore('meta').put(data.nastaveni, 'nastaveni');
  });

// Převzetí dat z pilotní verze (databáze 'najemnik'), jen když je nová databáze prázdná.
export async function prevezmiZPilotu(): Promise<boolean> {
  const db = await otevri();
  const pocet = await pozadavek(db.transaction('najemnici').objectStore('najemnici').count());
  if (pocet > 0) return false;
  const existujici = (await indexedDB.databases?.()) ?? [];
  if (!existujici.some(d => d.name === 'najemnik')) return false;

  const stara = await new Promise<IDBDatabase>((ok, chyba) => {
    const r = indexedDB.open('najemnik');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => chyba(r.error);
  });
  try {
    if (!stara.objectStoreNames.contains('najemnici')) return false;
    const tx = stara.transaction(['najemnici', 'platby', 'meta']);
    const [najemnici, platby, posledniZaloha] = await Promise.all([
      pozadavek(tx.objectStore('najemnici').getAll()),
      pozadavek(tx.objectStore('platby').getAll()),
      pozadavek(tx.objectStore('meta').get('posledniZaloha')),
    ]);
    if (!najemnici.length) return false;
    await davka({
      uloz: { najemnici, platby },
      nastaveni: { ...vychoziNastaveni(), posledniZaloha: (posledniZaloha as string) ?? null },
    });
    return true;
  } finally {
    stara.close();
  }
}
