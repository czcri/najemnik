// Rozpracované formuláře přežijí přepnutí do jiné aplikace i to, že Android aplikaci na pozadí ukončí.
// usePamet funguje jako useState, ale hodnotu průběžně ukládá do localStorage.
// Při zavření formuláře / odchodu z obrazovky (odpojení komponenty) se koncept smaže;
// při ukončení aplikace se odpojení nestihne, takže koncept zůstane a po návratu se obnoví.
import { useEffect, useState } from 'react';

const PREFIX = 'koncept:';
const MAX_STARI_MS = 24 * 3600 * 1000;

function nacti<T>(klic: string): T | undefined {
  try {
    const z = JSON.parse(localStorage.getItem(PREFIX + klic) ?? 'null') as { cas: number; v: T } | null;
    if (z && Date.now() - z.cas < MAX_STARI_MS) return z.v;
  } catch { /* soukromý režim apod. – bez obnovy */ }
  return undefined;
}

function uloz(klic: string, v: unknown) {
  try {
    if (v === null || v === undefined || v === false) localStorage.removeItem(PREFIX + klic);
    else localStorage.setItem(PREFIX + klic, JSON.stringify({ cas: Date.now(), v }));
  } catch { /* plné úložiště – nevadí */ }
}

export function usePamet<T>(klic: string, vychozi: T | (() => T)) {
  const [v, setV] = useState<T>(() => {
    const ulozeno = nacti<T>(klic);
    return ulozeno !== undefined ? ulozeno : typeof vychozi === 'function' ? (vychozi as () => T)() : vychozi;
  });
  useEffect(() => { uloz(klic, v); }, [klic, v]);
  useEffect(() => () => uloz(klic, null), [klic]);
  return [v, setV] as const;
}

// Je při spuštění co obnovit? (pro hlášku a přeskočení úvodní obrazovky)
export function maKoncept() {
  try {
    return Object.keys(localStorage).some(k => k.startsWith(PREFIX) && nacti(k.slice(PREFIX.length)) !== undefined);
  } catch { return false; }
}
