// Rozpracované formuláře přežijí přepnutí do jiné aplikace i to, že Android aplikaci na pozadí ukončí.
// usePamet funguje jako useState, ale hodnotu průběžně ukládá do localStorage.
// Při zavření formuláře / odchodu z obrazovky (odpojení komponenty) se koncept smaže;
// při ukončení aplikace se odpojení nestihne, takže koncept zůstane a po návratu se obnoví.
// „otisk“ = podoba upravovaného záznamu v okamžiku, kdy úprava začala: když se záznam mezitím
// změnil nebo zmizel (smazání, import, obnova ze zálohy), starý koncept se zahodí a nic nepřepíše.
import { useEffect, useState } from 'react';

const PREFIX = 'koncept:';
const MAX_STARI_MS = 24 * 3600 * 1000;

type Zaznam<T> = { cas: number; v: T; o?: string };

function precti<T>(klic: string): Zaznam<T> | null {
  try {
    const z = JSON.parse(localStorage.getItem(PREFIX + klic) ?? 'null') as Zaznam<T> | null;
    if (z && Date.now() - z.cas < MAX_STARI_MS) return z;
  } catch { /* soukromý režim apod. – bez obnovy */ }
  return null;
}

function uloz(klic: string, v: unknown, otisk?: string) {
  try {
    if (v === null || v === undefined || v === false) localStorage.removeItem(PREFIX + klic);
    else localStorage.setItem(PREFIX + klic, JSON.stringify({ cas: Date.now(), v, o: otisk }));
  } catch { /* plné úložiště – nevadí */ }
}

// Otisk záznamu pro usePamet (stabilní řetězec).
export const otisk = (x: unknown) => JSON.stringify(x ?? null);

export function usePamet<T>(klic: string, vychozi: T | (() => T), otiskZaznamu?: string) {
  const [v, setV] = useState<T>(() => {
    const z = precti<T>(klic);
    if (z && (otiskZaznamu === undefined || z.o === otiskZaznamu)) return z.v;
    return typeof vychozi === 'function' ? (vychozi as () => T)() : vychozi;
  });
  useEffect(() => { uloz(klic, v, otiskZaznamu); }, [klic, v, otiskZaznamu]);
  useEffect(() => () => uloz(klic, null), [klic]);
  return [v, setV] as const;
}

// Je při spuštění co obnovit? Zároveň uklidí prošlé koncepty (obsahují i osobní údaje).
export function maKoncept() {
  try {
    let neco = false;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(PREFIX)) continue;
      if (precti(k.slice(PREFIX.length))) neco = true;
      else localStorage.removeItem(k);
    }
    return neco;
  } catch { return false; }
}

// Po obnově ze zálohy / smazání nájemníka: zahodit všechny rozpracované zápisy.
export function vymazKoncepty() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch { /* nevadí */ }
}
