// Kontrolní seznam plateb aktuálního měsíce (spec. kap. 13) – strany Hotovost / Na účet na hlavní kartě.
// Počítá s platbami „za“ měsíc, který se v aktuálním měsíci platí (u „platí dopředu“ za příští),
// vůči předpisu toho měsíce (nájem + výdaje);
// starší dluh se tu neřeší (je v Dlužnících). Nový měsíc tak začíná s plným seznamem sám od sebe.
import { stavNajemnika, mesicZData, obdobiPlatby, dalsiMesic, predpisVMesici, castkaPredpisu } from './logika.js';

const pad = n => String(n).padStart(2, '0');
const dnuVMesici = mesic => { const [r, m] = mesic.split('-').map(Number); return new Date(Date.UTC(r, m, 0)).getUTCDate(); };

/**
 * @param zpusob 'hotove' | 'ucet' – výchozí způsob placení nájemníka
 * @returns { polozky: [{ najemnik, zaMesic, mel, zaplaceno, chybi, stav, ocekavano, poTerminu, dnes }], zaplaceno, celkem, prevzato }
 *   stav: 'nezaplaceno' | 'castecne' | 'zaplaceno'; ocekavano = 'RRRR-MM-DD' | null
 */
export function seznamMesice(najemnici, platby, vydaje, dnes, zpusob) {
  const mesic = mesicZData(dnes);
  const posledniDen = dnuVMesici(mesic);
  const vsechny = [];
  for (const n of najemnici) {
    if ((n.zpusobPlaceni ?? 'ucet') !== zpusob) continue;
    const vlastni = platby.filter(p => p.najemnikId === n.id);
    const zaMesic = n.platiDopredu ? dalsiMesic(mesic) : mesic;
    if (zaMesic < n.zacatek || (n.konec && n.konec < zaMesic)) continue; // nájem ještě nezačal / už skončil
    const radek = stavNajemnika(n, vlastni, dnes, vydaje.filter(v => v.najemnikId === n.id)).radky.find(r => r.mesic === zaMesic);
    const predpis = predpisVMesici(n, zaMesic);
    const mel = radek ? radek.mel : predpis ? castkaPredpisu(predpis) : 0;
    if (mel <= 0) continue;
    const zaplaceno = vlastni.filter(p => obdobiPlatby(p, n) === zaMesic).reduce((s, p) => s + p.castka, 0);
    const chybi = Math.max(0, mel - zaplaceno);
    const den = Number.isInteger(n.denHotovosti) ? Math.min(Math.max(n.denHotovosti, 1), posledniDen) : null;
    const ocekavano = den ? `${mesic}-${pad(den)}` : null;
    vsechny.push({
      najemnik: n, mel, zaplaceno, chybi, zaMesic,
      stav: chybi === 0 ? 'zaplaceno' : zaplaceno > 0 ? 'castecne' : 'nezaplaceno',
      ocekavano,
      dnes: ocekavano === dnes,
      poTerminu: !!ocekavano && ocekavano < dnes && chybi > 0,
    });
  }
  const polozky = vsechny
    .filter(x => x.stav !== 'zaplaceno')
    .sort((a, b) => (a.ocekavano ?? '9999') .localeCompare(b.ocekavano ?? '9999') || a.najemnik.jmeno.localeCompare(b.najemnik.jmeno, 'cs'));
  return {
    polozky,
    celkem: vsechny.length,
    zaplaceno: vsechny.filter(x => x.stav === 'zaplaceno').length,
    prevzato: vsechny.reduce((s, x) => s + Math.min(x.zaplaceno, x.mel), 0),
  };
}

// Odkaz „přidat do Google Kalendáře“: opakovaná celodenní událost každý měsíc v daný den.
export function odkazKalendare(najemnik, castka, odData) {
  const d = odData.replace(/-/g, '');
  const dalsi = new Date(`${odData}T12:00:00Z`);
  dalsi.setUTCDate(dalsi.getUTCDate() + 1);
  const d2 = dalsi.toISOString().slice(0, 10).replace(/-/g, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Hotovost – ${najemnik.jmeno} (${castka} Kč)`,
    details: `Nájem ${najemnik.oznaceni}. Po převzetí odškrtnout v aplikaci Nájemník.`,
    dates: `${d}/${d2}`,
    recur: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${najemnik.denHotovosti}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// Soubor .ics se všemi připomínkami (pro jiné kalendáře); upozornění ráno v 8:00.
export function icsHotovosti(polozky, odData, razitko) {
  const radky = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Najemnik//CS', 'CALSCALE:GREGORIAN'];
  for (const { najemnik, castka } of polozky) {
    if (!Number.isInteger(najemnik.denHotovosti)) continue;
    const zacatek = `${odData.slice(0, 8)}${pad(Math.min(najemnik.denHotovosti, 28))}`.replace(/-/g, '');
    radky.push(
      'BEGIN:VEVENT',
      `UID:hotovost-${najemnik.id}@najemnik`,
      `DTSTAMP:${razitko}`,
      `DTSTART;VALUE=DATE:${zacatek}`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${najemnik.denHotovosti}`,
      `SUMMARY:Hotovost – ${najemnik.jmeno} (${castka} Kč)`,
      `DESCRIPTION:Nájem ${najemnik.oznaceni}. Po převzetí odškrtnout v aplikaci Nájemník.`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Hotovost', 'TRIGGER:PT8H', 'END:VALARM',
      'END:VEVENT',
    );
  }
  radky.push('END:VCALENDAR');
  return radky.join('\r\n') + '\r\n';
}
