// Záloha do souboru v telefonu / sdílení jinam / obnova.
import { nactiZalohu, vytvorZalohu } from './core';
import { dnes } from './format';
import { vychoziNastaveni } from '../data/vychozi';
import type { Data } from '../types';

function soubor(data: Data) {
  const text = JSON.stringify(vytvorZalohu(data, new Date().toISOString()), null, 1);
  return new File([text], `najemnik-zaloha-${dnes()}.json`, { type: 'application/json' });
}

export function stahniZalohu(data: Data) {
  const f = soubor(data);
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(f), download: f.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export const lzeSdilet = () => {
  try { return !!navigator.canShare?.({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }); } catch { return false; }
};

// true = odesláno, false = uživatel zrušil
export async function sdilejZalohu(data: Data) {
  try {
    await navigator.share({ files: [soubor(data)], title: 'Záloha Nájemník', text: `Záloha aplikace Nájemník ${dnes()}` });
    return true;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return false;
    throw e;
  }
}

export async function prectiZalohu(f: File): Promise<Data> {
  const z = nactiZalohu(await f.text());
  return { ...z, nastaveni: { ...vychoziNastaveni(), ...z.nastaveni } };
}
