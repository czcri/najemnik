// Automatické načítání plateb z banky přes službu najemnik-banka (spec. kap. 23).
// Služba drží jen frontu pohybů na účtu; párování a zápis dělá aplikace (data nájemníků jsou jen v telefonu).
import type { Nastaveni } from '../types';
import type { Vypis } from './core';

export type Banka = NonNullable<Nastaveni['banka']>;
export type UcetBanky = { banka: string; ucet?: string; posledni?: string; posledniPokus?: string; chyba: string | null };
export type StavBanky = { ucty: UcetBanky[]; fronta: number; vapid: string };

async function volej<T>(b: Banka, cesta: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(b.url.replace(/\/+$/, '') + cesta, { ...init, cache: 'no-store', headers: { 'X-Klic': b.klic, 'Content-Type': 'application/json' } });
  } catch {
    throw new Error('Služba banky není dostupná – zkontrolujte připojení k internetu.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.chyba ?? `Služba banky: chyba ${r.status}.`);
  return data as T;
}

export const stavBanky = (b: Banka) => volej<StavBanky>(b, '/stav');

// Nové pohyby z fronty; „teď“ = služba je nejdřív stáhne z banky (nejvýš 1× za minutu).
export async function pohybyZBanky(b: Banka, ted = false): Promise<Vypis[]> {
  const { vypisy } = await volej<{ vypisy: Vypis[] }>(b, ted ? '/nacist' : '/pohyby', ted ? { method: 'POST' } : {});
  return vypisy.map(v => ({ ...v, auto: true }));
}

// Zpracované pohyby (zapsané, „není nájem“, už zapsané dřív) služba odškrtne; přeskočené zůstanou ve frontě.
export const odskrtni = (b: Banka, klice: string[]) => volej<{ fronta: number }>(b, '/hotovo', { method: 'POST', body: JSON.stringify({ klice }) });

// Odkaz pro napojení telefonu: …/#/nastaveni?banka=<adresa služby>&klic=<klíč aplikace>
export function zOdkazu(parametry: URLSearchParams): Banka | null {
  const url = parametry.get('banka'), klic = parametry.get('klic');
  return url && klic && /^(https:\/\/|http:\/\/localhost[:/])/.test(url) ? { url, klic } : null;
}

const bajty = (b64u: string) => {
  const s = atob(b64u.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64u.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};

export const lzeUpozornit = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function zapniUpozorneni(b: Banka) {
  if (!lzeUpozornit()) throw new Error('Tady upozornění nejdou. Otevřete Nájemník nainstalovaný na ploše telefonu (Chrome → Přidat na plochu).');
  if (await Notification.requestPermission() !== 'granted') throw new Error('Upozornění nejsou povolená – povolte je pro Nájemník v nastavení telefonu.');
  const { vapid } = await stavBanky(b);
  const reg = await navigator.serviceWorker.ready;
  const odber = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bajty(vapid) });
  await volej(b, '/odber', { method: 'POST', body: JSON.stringify({ odber: { endpoint: odber.endpoint } }) });
}

export async function vypniUpozorneni(b: Banka) {
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  const odber = await reg?.pushManager?.getSubscription();
  if (!odber) return;
  await volej(b, '/odber', { method: 'DELETE', body: JSON.stringify({ endpoint: odber.endpoint }) }).catch(() => {});
  await odber.unsubscribe();
}
