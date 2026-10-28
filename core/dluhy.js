// Dluhy po měsících (záložky v Dlužnících) – čistá logika, testuje se v node.
import { stavNajemnika, mesicZData, obdobiPlatby } from './logika.js';

const dataNajemnika = (n, platby, vydaje) => [platby.filter(p => p.najemnikId === n.id), vydaje.filter(v => v.najemnikId === n.id)];

/**
 * „Za měsíc“: kdo k dnešku stále dluží za vybraný měsíc (pozdě zaplacené a vyrovnané se nezobrazí).
 * @returns [{ najemnik, mel, zaplaceno (za měsíc), chybi }], seřazeno od největšího
 */
export function dluhyZaMesic(najemnici, platby, vydaje, dnes, mesic) {
  const vysledek = [];
  for (const n of najemnici) {
    const [p, v] = dataNajemnika(n, platby, vydaje);
    const r = stavNajemnika(n, p, dnes, v).radky.find(x => x.mesic === mesic);
    if (r && r.chybi > 0) vysledek.push({ najemnik: n, mel: r.mel, zaplaceno: r.mel - r.chybi, chybi: r.chybi });
  }
  return vysledek.sort((a, b) => b.chybi - a.chybi);
}

/**
 * „V měsíci“: předpis měsíce (nájem + úpravy + výdaje) vs. co v tom měsíci skutečně přišlo (podle data,
 * bez ohledu na to, za který měsíc) + přebytek z předchozích měsíců (platba dopředu / přeplatek).
 * Nedoplatek z předchozích měsíců se sem nepřenáší (ten je v „Za měsíc“ / „Celkem“).
 * @returns [{ najemnik, mel, prijato, predplaceno, dluh }], seřazeno od největšího
 */
export function dluhyVMesici(najemnici, platby, vydaje, dnes, mesic) {
  const vysledek = [];
  for (const n of najemnici) {
    const [p, v] = dataNajemnika(n, platby, vydaje);
    const radky = stavNajemnika(n, p, dnes, v).radky;
    const prijatoV = m => p.filter(x => mesicZData(x.datum) === m).reduce((s, x) => s + x.castka, 0);
    let prebytek = 0;
    for (const r of radky) {
      if (r.mesic > mesic) break;
      // Platby z doby před začátkem nájmu patří do prvního měsíce.
      const prijato = prijatoV(r.mesic) + (r === radky[0] ? p.filter(x => mesicZData(x.datum) < r.mesic).reduce((s, x) => s + x.castka, 0) : 0);
      if (r.mesic === mesic) {
        const dluh = r.mel - prijato - prebytek;
        if (r.mel > 0 && dluh > 0) vysledek.push({ najemnik: n, mel: r.mel, prijato, predplaceno: prebytek, dluh });
        break;
      }
      prebytek = Math.max(0, prebytek + prijato - r.mel);
    }
  }
  return vysledek.sort((a, b) => b.dluh - a.dluh);
}
