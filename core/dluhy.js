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
 * za tento nebo starší měsíc) + co bylo za tento měsíc zaplaceno předem + volný přebytek z dřívějška.
 * Platba přijatá v měsíci za budoucí měsíc se počítá až v něm. Nedoplatek z dřívějška se do měsíce
 * jako dluh nepřenáší, ale nejdřív „spotřebuje“ pozdější přebytek (peníze na starý dluh nejsou předplatné).
 * @returns [{ najemnik, mel, prijato, predplaceno, dluh }], seřazeno od největšího
 */
export function dluhyVMesici(najemnici, platby, vydaje, dnes, mesic) {
  const vysledek = [];
  for (const n of najemnici) {
    const [p, v] = dataNajemnika(n, platby, vydaje);
    const radky = stavNajemnika(n, p, dnes, v).radky;
    if (!radky.length) continue;
    const zacatek = radky[0].mesic;
    // Měsíc přijetí (platby před začátkem nájmu do prvního měsíce) a měsíc, za který platba je.
    const polozky = p.map(x => {
      const prijat = mesicZData(x.datum) < zacatek ? zacatek : mesicZData(x.datum);
      const za = obdobiPlatby(x, n);
      return { prijat, za: za < zacatek ? zacatek : za, castka: x.castka };
    });
    let bilance = 0;
    for (const r of radky) {
      if (r.mesic > mesic) break;
      const prijato = polozky.filter(x => x.prijat === r.mesic && x.za <= r.mesic).reduce((s, x) => s + x.castka, 0);
      const predem = polozky.filter(x => x.prijat < r.mesic && x.za === r.mesic).reduce((s, x) => s + x.castka, 0);
      const volnyPrebytek = Math.max(0, bilance);
      if (r.mesic === mesic) {
        const dluh = r.mel - prijato - predem - volnyPrebytek;
        if (r.mel > 0 && dluh > 0) vysledek.push({ najemnik: n, mel: r.mel, prijato, predplaceno: predem + volnyPrebytek, dluh });
        break;
      }
      bilance += prijato + predem - r.mel;
    }
  }
  return vysledek.sort((a, b) => b.dluh - a.dluh);
}
