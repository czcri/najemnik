// Upomínky: doplnění šablon a odkazy na SMS / WhatsApp / e-mail.
import { aktualniNajem, mesicZData } from './core';
import { datumCz, kc, nazevMesice, posunDny } from './format';
import type { Kanal, Najemnik, Nastaveni } from '../types';

export const ZNACKY = ['osloveni', 'jmeno', 'dluh', 'tento_mesic', 'mesic', 'najem', 'nemovitost', 'ucet', 'vs', 'termin'] as const;

export function doplnSablonu(text: string, n: Najemnik, s: { dluh: number; tentoMesic: number }, dnes: string, nastaveni: Nastaveni) {
  const hodnoty: Record<string, string> = {
    osloveni: n.osloveni || n.jmeno,
    jmeno: n.jmeno,
    dluh: kc(s.dluh + s.tentoMesic),
    tento_mesic: kc(s.tentoMesic),
    mesic: nazevMesice(mesicZData(dnes)),
    najem: kc(aktualniNajem(n, dnes)),
    nemovitost: n.oznaceni,
    ucet: n.ucetProPlatby || nastaveni.ucty[0]?.ucet || '—',
    vs: n.vs || '—',
    termin: datumCz(posunDny(dnes, 14)),
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => hodnoty[k] ?? m);
}

// Telefon pro wa.me: jen číslice, české číslo bez předvolby doplní 420.
export function mezinarodniCislo(tel: string) {
  let t = tel.replace(/[^\d+]/g, '');
  if (t.startsWith('+')) return t.slice(1);
  if (t.startsWith('00')) return t.slice(2);
  if (t.length === 9) t = '420' + t;
  return t;
}

export function odkaz(kanal: Kanal, n: Najemnik, text: string) {
  const enc = encodeURIComponent(text);
  if (kanal === 'sms') return `sms:${(n.telefon ?? '').replace(/\s/g, '')}?body=${enc}`;
  if (kanal === 'whatsapp') return `https://wa.me/${mezinarodniCislo(n.telefon ?? '')}?text=${enc}`;
  return `mailto:${n.email ?? ''}?subject=${encodeURIComponent('Nájem')}&body=${enc}`;
}
