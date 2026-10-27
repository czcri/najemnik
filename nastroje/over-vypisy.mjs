// Kontrola čteček na skutečných výpisech ve vzory-vypisu/ (lokálně, nic se neodesílá ani neukládá).
// Vypisuje jen souhrny (počty, součty), žádná jména. U KB PDF ověří součet pohybů proti zůstatkům.
// Spuštění: node nastroje/over-vypisy.mjs [složka] [--detail]
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { jePdf, nactiCsvVypis, nactiKbPdf, castkaNaHalere } from '../core/vypisy.js';

const slozka = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'vzory-vypisu';
const detail = process.argv.includes('--detail');
const kc = hal => (hal / 100).toLocaleString('cs-CZ', { minimumFractionDigits: 2 });

async function strankyPdf(bajty) {
  const doc = await getDocument({ data: bajty, verbosity: 0 }).promise;
  const stranky = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const obsah = await (await doc.getPage(i)).getTextContent();
    stranky.push(obsah.items.map(p => ({ x: p.transform[4], y: p.transform[5], str: p.str })));
  }
  return stranky;
}

function zustatky(stranky) {
  // Hodnoty na stejném řádku (a stejné stránce) jako štítek.
  const radekZa = stitek => {
    for (const polozky of stranky) {
      const texty = polozky.filter(p => p.str.trim());
      const s = texty.find(p => p.str.trim() === stitek);
      if (s) return texty.filter(p => Math.abs(p.y - s.y) < 2 && p.x > s.x).sort((a, b) => a.x - b.x).map(p => p.str.trim());
    }
    return [];
  };
  const castka = stitek => { const v = radekZa(stitek).find(t => /\d,\d{2}$/.test(t)); return v ? castkaNaHalere(v) : null; };
  // Rekapitulace na konci výpisu: „Celkový počet transakcí  7  18“, „Obraty na účtu  1 458 500,00  -1 523 813,38“
  const [pocetPrip, pocetOdep] = radekZa('Celkový počet transakcí').map(Number);
  const [obratPrip] = radekZa('Obraty na účtu').map(castkaNaHalere);
  return { pocatecni: castka('Počáteční zůstatek'), konecny: castka('Konečný zůstatek'), pocetPrip, pocetOdep, obratPrip };
}

let chyby = 0;
for (const soubor of (await readdir(slozka)).sort()) {
  const bajty = new Uint8Array(await readFile(path.join(slozka, soubor)));
  let vypis, kontrola = '';
  try {
    if (jePdf(bajty)) {
      const stranky = await strankyPdf(bajty);
      try { vypis = nactiKbPdf(stranky); } catch (e) { console.log(`– ${soubor}: PDF nečteno (${e.message})`); continue; }
      const z = zustatky(stranky);
      const soucet = vypis.pohyby.reduce((s, p) => s + p.castkaHal, 0);
      if (z.pocatecni !== null && z.konecny !== null) {
        const ok = z.pocatecni + soucet === z.konecny;
        if (!ok) chyby++;
        kontrola = ok ? '✔ součet pohybů sedí na zůstatky' : `✖ součet ${kc(soucet)} ≠ změna zůstatku ${kc(z.konecny - z.pocatecni)}`;
      }
      if (z.pocetPrip !== undefined) {
        const prip = vypis.pohyby.filter(p => p.castkaHal > 0);
        const ok = prip.length === z.pocetPrip && vypis.pohyby.length - prip.length === z.pocetOdep
          && prip.reduce((s, p) => s + p.castkaHal, 0) === z.obratPrip;
        if (!ok) chyby++;
        kontrola += ok ? ', ✔ počty a obraty sedí na rekapitulaci' : `, ✖ rekapitulace: ${z.pocetPrip}/${z.pocetOdep} transakcí, přišlo ${kc(z.obratPrip)}`;
      }
    } else {
      vypis = nactiCsvVypis(bajty, soubor);
    }
  } catch (e) {
    chyby++;
    console.log(`✖ ${soubor}: ${e.message}`);
    continue;
  }
  const prichozi = vypis.pohyby.filter(p => p.castkaHal > 0);
  console.log(`${vypis.banka.toUpperCase()} ${vypis.ucet || '(účet neznámý)'} – ${soubor}`);
  console.log(`   pohybů ${vypis.pohyby.length}, příchozích ${prichozi.length} (${kc(prichozi.reduce((s, p) => s + p.castkaHal, 0))} Kč), ` +
    `s protiúčtem ${prichozi.filter(p => p.protiucet).length}, s VS ${prichozi.filter(p => p.vs).length}, se zprávou ${prichozi.filter(p => p.zprava).length} ${kontrola}`);
  if (detail) for (const p of prichozi) console.log('   ', p.datum, kc(p.castkaHal), p.protiucet || '-', `VS:${p.vs || '-'}`, p.typ);
}
process.exit(chyby ? 1 : 0);
