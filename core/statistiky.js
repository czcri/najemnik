// Statistiky (spec. kap. 12) – čistá logika, testuje se v node.
import { stavNajemnika, mesicZData, rozsahMesicu } from './logika.js';

// Skutečný způsob platby: výpis / ručně zapsaný převod = účet, hotově = hotovost.
// Platby bez zdroje (z pilotu) se řídí tím, jak nájemník obvykle platí.
export function zpusobPlatby(platba, najemnik) {
  const typ = platba.zdroj?.typ;
  if (typ === 'hotove') return 'hotove';
  if (typ === 'vypis' || typ === 'prevod') return 'ucet';
  return najemnik?.zpusobPlaceni === 'hotove' ? 'hotove' : 'ucet';
}

export function posledniDen(mesic) {
  const [r, m] = mesic.split('-').map(Number);
  return `${mesic}-${String(new Date(Date.UTC(r, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

/**
 * @param data { najemnici, platby, vydaje }
 * @param od, doMesice 'RRRR-MM' (doMesice se omezí na aktuální měsíc)
 * @param filtr { zpusob: 'vse' | 'ucet' | 'hotove', oznaceni: string | null }
 */
export function statistiky(data, od, doMesice, dnes, filtr = {}) {
  const zpusob = filtr.zpusob ?? 'vse';
  const aktualni = mesicZData(dnes);
  const konec = doMesice > aktualni ? aktualni : doMesice;
  const mesice = od <= konec ? rozsahMesicu(od, konec) : [];

  // Filtr nemovitosti a způsobu placení nájemníka (pro očekávané částky a dluhy).
  const najemnici = data.najemnici.filter(n =>
    (!filtr.oznaceni || n.oznaceni === filtr.oznaceni)
    && (zpusob === 'vse' || (n.zpusobPlaceni ?? 'ucet') === zpusob));
  const vsichniPodleId = new Map(data.najemnici.map(n => [n.id, n]));
  const vybraniId = new Set(najemnici.map(n => n.id));

  // Příjmy: podle skutečného způsobu platby (filtr nemovitosti podle nájemníka).
  const platbyVObdobi = data.platby.filter(p => {
    const n = vsichniPodleId.get(p.najemnikId);
    return n && (!filtr.oznaceni || n.oznaceni === filtr.oznaceni)
      && mesicZData(p.datum) >= od && mesicZData(p.datum) <= konec
      && (zpusob === 'vse' || zpusobPlatby(p, n) === zpusob);
  });

  const stavy = najemnici.map(n => {
    const platby = data.platby.filter(p => p.najemnikId === n.id);
    const vydaje = (data.vydaje ?? []).filter(v => v.najemnikId === n.id);
    const stav = stavNajemnika(n, platby, dnes, vydaje);
    const melKumulativne = new Map();
    let kum = 0;
    for (const r of stav.radky) { kum += r.mel; melKumulativne.set(r.mesic, kum); }
    const melDo = m => {
      let posledni = 0;
      for (const [mesic, hodnota] of melKumulativne) if (mesic <= m) posledni = hodnota;
      return posledni;
    };
    const zaplatilDo = den => platby.filter(p => p.datum <= den).reduce((s, p) => s + p.castka, 0);
    return { n, stav, platby, melDo, zaplatilDo, melVMesici: new Map(stav.radky.map(r => [r.mesic, r.mel])) };
  });

  const poMesicich = mesice.map(mesic => {
    const vMesici = platbyVObdobi.filter(p => mesicZData(p.datum) === mesic);
    const ucet = vMesici.filter(p => zpusobPlatby(p, vsichniPodleId.get(p.najemnikId)) === 'ucet').reduce((s, p) => s + p.castka, 0);
    const hotove = vMesici.filter(p => zpusobPlatby(p, vsichniPodleId.get(p.najemnikId)) === 'hotove').reduce((s, p) => s + p.castka, 0);
    const ocekavano = stavy.reduce((s, x) => s + (x.melVMesici.get(mesic) ?? 0), 0);
    const den = posledniDen(mesic);
    // Běžící měsíc ještě není splatný: dluh k dnešku = předpisy ukončených měsíců − dosavadní platby.
    const dluh = mesic === aktualni
      ? stavy.reduce((s, x) => s + x.stav.dluh, 0)
      : stavy.reduce((s, x) => s + Math.max(0, x.melDo(mesic) - x.zaplatilDo(den)), 0);

    // Dochvilnost: jen u ukončených měsíců a nájemníků, kteří v měsíci něco měli platit.
    let vcas = 0, pozde = 0, vubec = 0;
    if (mesic < aktualni) {
      for (const x of stavy) {
        if (!(x.melVMesici.get(mesic) > 0)) continue;
        const potreba = x.melDo(mesic);
        if (x.zaplatilDo(den) >= potreba) vcas++;
        else if (x.stav.zaplatil >= potreba) pozde++;
        else vubec++;
      }
    }
    return { mesic, ucet, hotove, prijato: ucet + hotove, ocekavano, dluh, vcas, pozde, vubec };
  });

  const prijatoUcet = poMesicich.reduce((s, m) => s + m.ucet, 0);
  const prijatoHotove = poMesicich.reduce((s, m) => s + m.hotove, 0);
  const prijato = prijatoUcet + prijatoHotove;
  const ocekavano = poMesicich.reduce((s, m) => s + m.ocekavano, 0);

  return {
    mesice: poMesicich,
    prijato, prijatoUcet, prijatoHotove, ocekavano,
    uspesnost: ocekavano ? prijato / ocekavano : null,
    dluh: stavy.reduce((s, x) => s + x.stav.dluh, 0),
    podleNajemniku: stavy.map(x => ({
      najemnik: x.n,
      prijato: platbyVObdobi.filter(p => p.najemnikId === x.n.id).reduce((s, p) => s + p.castka, 0),
      dluh: x.stav.dluh,
      stav: x.stav.stav,
    })).concat(
      // Platby nájemníků mimo filtr způsobu placení (např. hotovostní nájemník poslal převod).
      zpusob === 'vse' ? [] : data.najemnici
        .filter(n => !vybraniId.has(n.id) && platbyVObdobi.some(p => p.najemnikId === n.id))
        .map(n => ({ najemnik: n, prijato: platbyVObdobi.filter(p => p.najemnikId === n.id).reduce((s, p) => s + p.castka, 0), dluh: 0, stav: 'ok' })),
    ),
  };
}
