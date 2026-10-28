// Upomínky: doplnění šablon a odkazy na SMS / WhatsApp / e-mail.
import { mesicZData, najemVMesici } from './core';
import { datumCz, kc, nazevMesice, posunDny } from './format';
import type { Kanal, Najemnik, Nastaveni } from '../types';

// Zprávy jdou do SMS / WhatsApp / e-mailu: pevné mezery z formátu částek (140 000 Kč) by v SMS
// dorazily jako „?“. Proto obyčejné mezery a pro SMS i obyčejné pomlčky a uvozovky.
export const bezPevnychMezer = (t: string) => t.replace(/[\u00a0\u202f\u2007]/g, ' ');
export const proSms = (t: string) => bezPevnychMezer(t)
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/[\u201e\u201c\u201d]/g, '"')
  .replace(/[\u201a\u2018\u2019]/g, "'")
  .replace(/\u2026/g, '...');

export const ZNACKY = ['osloveni', 'jmeno', 'dluh', 'tento_mesic', 'mesic', 'najem', 'nemovitost', 'ucet', 'vs', 'termin'] as const;

export function doplnSablonu(text: string, n: Najemnik, s: { dluh: number; tentoMesic: number }, dnes: string, nastaveni: Nastaveni) {
  const hodnoty: Record<string, string> = {
    osloveni: n.osloveni || n.jmeno,
    jmeno: n.jmeno,
    dluh: kc(s.dluh + s.tentoMesic),
    tento_mesic: kc(s.tentoMesic),
    mesic: nazevMesice(mesicZData(dnes)),
    najem: kc(najemVMesici(n, mesicZData(dnes))),
    nemovitost: n.oznaceni,
    ucet: n.ucetProPlatby || nastaveni.ucty[0]?.ucet || '—',
    vs: n.vs || '—',
    termin: datumCz(posunDny(dnes, 14)),
  };
  return bezPevnychMezer(text.replace(/\{(\w+)\}/g, (m, k: string) => hodnoty[k] ?? m));
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
  const enc = encodeURIComponent(kanal === 'sms' ? proSms(text) : bezPevnychMezer(text));
  if (kanal === 'sms') return `sms:${(n.telefon ?? '').replace(/\s/g, '')}?body=${enc}`;
  if (kanal === 'whatsapp') return `https://wa.me/${mezinarodniCislo(n.telefon ?? '')}?text=${enc}`;
  return `mailto:${n.email ?? ''}?subject=${encodeURIComponent('Nájem')}&body=${enc}`;
}
