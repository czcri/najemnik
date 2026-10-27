// Čtení bankovních výpisů (Fio CSV, ČS CSV, KB PDF) – čistá logika bez DOM, testuje se v node.
// Výsledek každé čtečky: { banka, ucet, pohyby: [Pohyb] }
// Pohyb: { datum 'RRRR-MM-DD', castkaHal (haléře, + příchozí / − odchozí), protiucet 'číslo/kód' | '',
//          nazevProtiuctu, vs, ks, ss, zprava, typ, idBanky }

// ---------- pomocné ----------
export function dekoduj(bajty) {
  const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  const text = new TextDecoder('utf-8').decode(b);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export const jePdf = bajty => {
  const b = bajty instanceof Uint8Array ? bajty : new Uint8Array(bajty);
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
};

// CSV se středníky a uvozovkami ("" = uvozovka uvnitř hodnoty).
export function parseCsv(text, oddelovac = ';') {
  const radky = [];
  let radek = [], hodnota = '', vUvozovkach = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (vUvozovkach) {
      if (c === '"' && text[i + 1] === '"') { hodnota += '"'; i++; }
      else if (c === '"') vUvozovkach = false;
      else hodnota += c;
    } else if (c === '"') vUvozovkach = true;
    else if (c === oddelovac) { radek.push(hodnota); hodnota = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      radek.push(hodnota); hodnota = '';
      if (radek.some(h => h !== '')) radky.push(radek);
      radek = [];
    } else hodnota += c;
  }
  radek.push(hodnota);
  if (radek.some(h => h !== '')) radky.push(radek);
  return radky;
}

// „-11411,77“, „110 000,00“, „11 086.09“ → haléře (celé číslo)
export function castkaNaHalere(text) {
  const t = String(text).replace(/[\s ]/g, '').replace(',', '.');
  if (!/^[-+]?\d+(\.\d{1,2})?$/.test(t)) throw new Error(`Neplatná částka „${text}“`);
  return Math.round(Number(t) * 100);
}

// „29.09.2026“ → „2026-09-29“
export function datumZCz(text) {
  const m = String(text).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) throw new Error(`Neplatné datum „${text}“`);
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// Číslo účtu do jednotného tvaru „[předčíslí-]číslo/kód“ bez úvodních nul.
export function normalizujUcet(text, kodBanky = '') {
  let t = String(text ?? '').replace(/\s/g, '');
  if (!t) return '';
  let kod = kodBanky;
  const lomitko = t.indexOf('/');
  if (lomitko >= 0) { kod = t.slice(lomitko + 1); t = t.slice(0, lomitko); }
  let [predcisli, cislo] = t.includes('-') ? t.split('-') : ['', t];
  predcisli = predcisli.replace(/^0+/, '');
  cislo = cislo.replace(/^0+/, '');
  if (!cislo || !/^\d+$/.test(cislo) || (predcisli && !/^\d+$/.test(predcisli))) return '';
  kod = String(kod).replace(/\D/g, '');
  return `${predcisli ? predcisli + '-' : ''}${cislo}${kod ? '/' + kod.padStart(4, '0') : ''}`;
}

export const normalizujSymbol = s => String(s ?? '').replace(/\D/g, '').replace(/^0+/, '');

function sloupce(hlavicka) {
  const index = {};
  hlavicka.forEach((nazev, i) => { const n = nazev.trim(); if (!(n in index)) index[n] = i; });
  return (radek, nazev) => (index[nazev] === undefined ? '' : (radek[index[nazev]] ?? '').trim());
}

// ---------- Fio – CSV „Pohyby na účtu“ ----------
export function jeFioCsv(radky) {
  const h = radky[0] ?? [];
  return h.includes('Objem') && h.includes('Protiúčet') && h.includes('Kód banky');
}

export function nactiFioCsv(text, nazevSouboru = '') {
  const radky = parseCsv(text);
  if (!jeFioCsv(radky)) throw new Error('Soubor není CSV výpis z Fio banky.');
  const s = sloupce(radky[0]);
  const m = nazevSouboru.match(/Pohyby_na_uctu-(\d+(?:-\d+)?)/i);
  const pohyby = radky.slice(1).map(r => ({
    datum: datumZCz(s(r, 'Datum')),
    castkaHal: castkaNaHalere(s(r, 'Objem')),
    protiucet: normalizujUcet(s(r, 'Protiúčet'), s(r, 'Kód banky')),
    nazevProtiuctu: s(r, 'Název protiúčtu'),
    vs: normalizujSymbol(s(r, 'VS')),
    ks: normalizujSymbol(s(r, 'KS')),
    ss: normalizujSymbol(s(r, 'SS')),
    zprava: s(r, 'Zpráva pro příjemce') || s(r, 'Poznámka'),
    typ: s(r, 'Typ'),
    idBanky: s(r, 'ID pohybu'),
  }));
  // Číslo vlastního účtu je jen v názvu souboru – když chybí, musí ho doplnit uživatel.
  return { banka: 'fio', ucet: m ? normalizujUcet(m[1], '2010') : '', pohyby };
}

// ---------- Česká spořitelna – CSV z Georga ----------
export function jeCsCsv(radky) {
  const h = radky[0] ?? [];
  return h.includes('Datum zaúčtování') && h.includes('Číslo účtu vlastníka');
}

export function nactiCsCsv(text) {
  const radky = parseCsv(text);
  if (!jeCsCsv(radky)) throw new Error('Soubor není CSV výpis z České spořitelny.');
  const s = sloupce(radky[0]);
  const ucty = new Set(radky.slice(1).map(r => normalizujUcet(s(r, 'Číslo účtu vlastníka'))));
  if (ucty.size > 1) throw new Error('Výpis obsahuje více účtů – exportujte každý účet zvlášť.');
  const pohyby = radky.slice(1).map(r => ({
    datum: datumZCz(s(r, 'Datum zaúčtování')),
    castkaHal: castkaNaHalere(s(r, 'Částka')),
    protiucet: normalizujUcet(s(r, 'Protiúčet'), s(r, 'Bankovní kód protiúčtu')),
    nazevProtiuctu: s(r, 'Název protiúčtu'),
    vs: normalizujSymbol(s(r, 'Variabilní symbol')),
    ks: normalizujSymbol(s(r, 'Konstantní symbol')),
    ss: normalizujSymbol(s(r, 'Specifický symbol')),
    zprava: s(r, 'Zpráva pro příjemce'),
    typ: s(r, 'Typ transakce'),
    idBanky: '',
  }));
  return { banka: 'cs', ucet: [...ucty][0] ?? '', pohyby };
}

// ---------- Komerční banka – PDF periodický výpis ----------
// Vstup: stránky jako pole textových položek { x, y, str } (y roste nahoru, jak je vrací pdf.js).

function radkyStranky(polozky, tolerance = 2) {
  const serazene = polozky.filter(p => p.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const radky = [];
  for (const p of serazene) {
    const posledni = radky.at(-1);
    if (posledni && Math.abs(posledni.y - p.y) <= tolerance) posledni.polozky.push(p);
    else radky.push({ y: p.y, polozky: [p] });
  }
  radky.forEach(r => r.polozky.sort((a, b) => a.x - b.x));
  return radky;
}

const DATUM = /^\d{2}\.\d{2}\.\d{4}$/;
const CASTKA = /^-?\d{1,3}(?:[  ]\d{3})*,\d{2}$/;
const STITKY = new Set(['Zpráva pro příjemce:', 'Popis pro mě:', 'Zpráva pro mě:']);

export function nactiKbPdf(stranky) {
  let ucet = '';
  let sl = null; // pozice sloupců z hlavičky tabulky
  const pohyby = [];

  for (const polozky of stranky) {
    const radky = radkyStranky(polozky);
    let blok = null, vTabulce = false;
    const uzavri = () => { if (blok) pohyby.push(zpracujKbBlok(blok, sl)); blok = null; };

    for (const r of radky) {
      const texty = r.polozky.map(p => p.str.trim());
      if (!ucet) {
        const i = texty.indexOf('k účtu:');
        if (i >= 0 && texty[i + 1]) ucet = normalizujUcet(texty[i + 1]);
      }
      const popis = r.polozky.find(p => p.str.trim() === 'Popis transakce');
      if (popis) {
        uzavri();
        const x = t => r.polozky.find(p => p.str.trim().startsWith(t))?.x;
        sl = { popis: popis.x, nazev: x('Název protiúčtu'), symboly: x('VS') - 60 };
        vTabulce = 'hlavicka'; // hlavička tabulky má ještě další řádky (zúčtování, Datum transakce…)
        continue;
      }
      if (!vTabulce) continue;
      const prvni = r.polozky[0];
      const zacinaVlevo = prvni.x < sl.popis - 5;
      const sDatem = zacinaVlevo && DATUM.test(prvni.str.trim());
      const sCastkou = r.polozky.some(p => p.x >= sl.symboly && CASTKA.test(p.str.trim()));
      if (sDatem && sCastkou) {
        // Nová transakce: datum zúčtování + částka na stejném řádku.
        uzavri();
        blok = { y: r.y, radky: [r] };
        vTabulce = true;
      } else if (vTabulce === 'hlavicka') {
        continue;
      } else if (zacinaVlevo && !sDatem) {
        // KONEČNÝ ZŮSTATEK apod. – konec tabulky na této stránce.
        uzavri();
        vTabulce = false;
      } else if (texty.includes('Pokračování na další straně')) {
        uzavri();
        vTabulce = false;
      } else if (blok && blok.y - r.y < 30) {
        // Pokračování transakce (i řádek s datem transakce v prvním sloupci).
        blok.radky.push(r);
        blok.y = r.y;
      } else uzavri();
    }
    uzavri(); // transakce nepokračují přes konec stránky
  }
  if (!ucet) throw new Error('Ve výpisu KB nebylo nalezeno číslo účtu.');
  return { banka: 'kb', ucet, pohyby };
}

function zpracujKbBlok(blok, sl) {
  const sloupec = p => (p.x < sl.popis - 5 ? 'datum' : p.x < sl.nazev - 5 ? 'popis' : p.x < sl.symboly ? 'nazev' : 'vpravo');
  const popisy = [], nazvy = [], symboly = [];
  let datum = '', castka = null;
  blok.radky.forEach((r, i) => {
    for (const p of r.polozky) {
      const t = p.str.trim();
      const s = sloupec(p);
      if (s === 'datum' && i === 0) datum = t;
      else if (s === 'popis') popisy.push({ radek: i, t });
      else if (s === 'nazev') nazvy.push({ radek: i, t });
      else if (s === 'vpravo') {
        if (i === 0 && CASTKA.test(t)) castka = t;
        else symboly.push({ radek: i, t });
      }
    }
  });
  if (!DATUM.test(datum) || castka === null) throw new Error(`Nečitelná transakce ve výpisu KB (${datum || 'bez data'}).`);

  // Popis: 1. řádek = typ, další = identifikace; po štítku „Zpráva pro příjemce:“ text zprávy.
  const typ = popisy.find(p => p.radek === 0)?.t ?? '';
  const identifikace = [], zprava = [];
  let stitek = null;
  for (const p of popisy.filter(p => p.radek > 0)) {
    if (STITKY.has(p.t)) { stitek = p.t; continue; }
    if (stitek === 'Zpráva pro příjemce:') zprava.push(p.t);
    else if (!stitek) identifikace.push(p.t);
  }
  const symbol = radek => normalizujSymbol(symboly.find(s => s.radek === radek)?.t);
  // Protiúčet je obvykle na 2. řádku; u plateb bez názvu (okamžité úhrady) už na 1. řádku místo názvu.
  const jeUcet = t => /^[\d-]+\/\d{4}$/.test(t.replace(/\s/g, ''));
  const protiucet = normalizujUcet(nazvy.find(n => jeUcet(n.t))?.t ?? '');

  return {
    datum: datumZCz(datum),
    castkaHal: castkaNaHalere(castka),
    protiucet,
    nazevProtiuctu: nazvy.find(n => n.radek === 0 && !jeUcet(n.t))?.t ?? '',
    vs: symbol(0), ks: symbol(1), ss: symbol(2),
    zprava: zprava.join(' '),
    typ,
    idBanky: identifikace.join(' '),
  };
}

// ---------- rozpoznání formátu CSV ----------
export function nactiCsvVypis(bajty, nazevSouboru) {
  const text = dekoduj(bajty);
  const radky = parseCsv(text);
  if (jeFioCsv(radky)) return nactiFioCsv(text, nazevSouboru);
  if (jeCsCsv(radky)) return nactiCsCsv(text);
  throw new Error('Neznámý formát výpisu. Podporované: Fio CSV, Česká spořitelna CSV, Komerční banka PDF.');
}
