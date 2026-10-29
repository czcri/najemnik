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

export async function prectiZalohu(f: File): Promise<{ data: Data; varovani: string[] }> {
  const { varovani, ...z } = nactiZalohu(await f.text());
  const vychozi = vychoziNastaveni();
  return { data: { ...z, nastaveni: { ...vychozi, ...z.nastaveni, pravidla: { ...vychozi.pravidla, ...z.nastaveni.pravidla } } }, varovani };
}

// Připomínka zálohy: po 60 dnech bez zálohy (jen když jsou nějaká data).
export const ZALOHA_PO_DNECH = 60;

export function zalohaStara(posledni: string | null, dnes: string, maData: boolean) {
  if (!maData) return false;
  if (!posledni) return true;
  return (Date.parse(dnes) - Date.parse(posledni)) / 86400000 > ZALOHA_PO_DNECH;
}
