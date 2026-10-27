// Párování příchozích plateb z výpisu na nájemníky (spec. kap. 11) – čistá logika, testuje se v node.
//
// Nájemník má navíc (nepovinně): vs, ucetProPlatby (můj účet, kam platí), uctyPlatce (účty, ze kterých platí).
// Pravidla (uložená v aplikaci): { nenajemUcty: [protiúčty, které nikdy nejsou nájem], ignorovane: [klíče pohybů] }.
import { normalizujSymbol } from './vypisy.js';

export const prazdnaPravidla = () => ({ nenajemUcty: [], ignorovane: [] });

// Jednoznačný klíč pohybu – aby opakovaný import nezapsal platbu dvakrát.
// Stejné pohyby v jednom výpisu (stejný den, částka, plátce) se rozliší pořadím.
export function klicePohybu(ucet, pohyby) {
  const pocty = new Map();
  return pohyby.map(p => {
    const zaklad = p.idBanky
      ? `${ucet}|id|${p.idBanky}`
      : `${ucet}|${p.datum}|${p.castkaHal}|${p.protiucet}|${p.vs}|${p.zprava}`;
    const n = (pocty.get(zaklad) ?? 0) + 1;
    pocty.set(zaklad, n);
    return n === 1 ? zaklad : `${zaklad}|${n}`;
  });
}

const bezDiakritiky = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slova = s => bezDiakritiky(s).split(/[^a-z0-9]+/).filter(w => w.length >= 3);

// Všechna slova jména nájemníka (aspoň 3 znaky) se objeví v názvu plátce nebo ve zprávě.
function sediJmeno(najemnik, pohyb) {
  const jmeno = slova(najemnik.jmeno);
  if (!jmeno.length) return false;
  const text = new Set(slova(`${pohyb.nazevProtiuctu} ${pohyb.zprava}`));
  return jmeno.every(w => text.has(w));
}

// Pohyby, které nemá smysl párovat: odchozí, a příchozí bez plátce (úroky, vklady bez údajů).
export const jePrichoziPlatba = p => p.castkaHal > 0 && !!(p.protiucet || p.nazevProtiuctu || p.vs);

/**
 * @returns pole { klic, pohyb, stav, najemnikId, kandidati, duvod, zapamatovatUcet }
 *   stav: 'jiste' | 'navrh' | 'neprirazeno' | 'nenajem' | 'duplicita'
 */
export function sparuj(vypis, najemnici, platby, pravidla = prazdnaPravidla()) {
  const klice = klicePohybu(vypis.ucet, vypis.pohyby);
  const znameKlice = new Set([...platby.map(p => p.zdroj?.klic).filter(Boolean), ...pravidla.ignorovane]);
  const nenajem = new Set(pravidla.nenajemUcty);
  const vysledky = [];

  vypis.pohyby.forEach((pohyb, i) => {
    if (!jePrichoziPlatba(pohyb)) return;
    const klic = klice[i];
    const v = { klic, pohyb, stav: 'neprirazeno', najemnikId: null, kandidati: [], duvod: '', zapamatovatUcet: false };
    vysledky.push(v);

    if (znameKlice.has(klic)) { v.stav = 'duplicita'; v.duvod = 'Už zapsáno dřívějším importem.'; return; }

    const podleUctu = pohyb.protiucet ? najemnici.filter(n => (n.uctyPlatce ?? []).includes(pohyb.protiucet)) : [];
    const vs = normalizujSymbol(pohyb.vs);
    const podleVs = vs ? najemnici.filter(n => n.vs && normalizujSymbol(n.vs) === vs) : [];
    const naJinyUcet = n => !!n.ucetProPlatby && !!vypis.ucet && n.ucetProPlatby !== vypis.ucet;
    const jiste = (n, duvod, zapamatovat = false) => {
      v.najemnikId = n.id;
      v.kandidati = [n.id];
      if (naJinyUcet(n)) {
        v.stav = 'navrh';
        v.duvod = `${duvod}, ale platba přišla na jiný účet, než kam nájemník platí.`;
      } else {
        v.stav = 'jiste';
        v.duvod = duvod + '.';
      }
      v.zapamatovatUcet = zapamatovat && !!pohyb.protiucet;
    };

    if (podleUctu.length === 1 && (podleVs.length === 0 || podleVs[0] === podleUctu[0])) {
      return jiste(podleUctu[0], podleVs.length ? 'Účet plátce i VS' : 'Známý účet plátce');
    }
    if (podleUctu.length > 1) {
      // Z jednoho účtu platí víc nájemníků – rozhodne VS.
      const oba = podleUctu.filter(n => podleVs.includes(n));
      if (oba.length === 1) return jiste(oba[0], 'Účet plátce i VS');
      v.stav = 'navrh';
      v.kandidati = podleUctu.map(n => n.id);
      v.najemnikId = podleUctu[0].id;
      v.duvod = 'Z tohoto účtu platí více nájemníků – vyberte.';
      return;
    }
    if (podleUctu.length === 1 && podleVs.length) {
      v.stav = 'navrh';
      v.najemnikId = podleUctu[0].id;
      v.kandidati = [podleUctu[0].id, ...podleVs.map(n => n.id)];
      v.duvod = 'Rozpor: účet plátce patří jinému nájemníkovi než VS – vyberte.';
      return;
    }
    if (nenajem.has(pohyb.protiucet)) { v.stav = 'nenajem'; v.duvod = 'Plátce je označen „není nájem“.'; return; }
    if (podleVs.length === 1) return jiste(podleVs[0], 'Variabilní symbol', true);
    if (podleVs.length > 1) {
      v.stav = 'navrh';
      v.kandidati = podleVs.map(n => n.id);
      v.najemnikId = podleVs[0].id;
      v.duvod = 'Stejný VS má více nájemníků – vyberte.';
      return;
    }
    const podleJmena = najemnici.filter(n => sediJmeno(n, pohyb));
    if (podleJmena.length) {
      v.stav = 'navrh';
      v.kandidati = podleJmena.map(n => n.id);
      v.najemnikId = podleJmena[0].id;
      v.zapamatovatUcet = !!pohyb.protiucet;
      v.duvod = 'Shoda jména plátce – zkontrolujte.';
      return;
    }
    v.duvod = 'Plátce neznámý.';
  });
  return vysledky;
}

/**
 * Převede potvrzené rozhodnutí uživatele na změny dat.
 * rozhodnuti: pole { klic, akce: 'zapsat' | 'nenajem' | 'nenajemVzdy' | 'preskocit', najemnikId, zapamatovatUcet }
 * @returns { platby: nové platby, najemnici: změnění nájemníci, pravidla: nová pravidla }
 */
export function prevedImport(vypis, vysledky, rozhodnuti, najemnici, pravidla, noveId) {
  const podleKlice = new Map(vysledky.map(v => [v.klic, v]));
  const zmeneni = new Map();
  const nova = { nenajemUcty: [...pravidla.nenajemUcty], ignorovane: [...pravidla.ignorovane] };
  const platby = [];

  for (const r of rozhodnuti) {
    const v = podleKlice.get(r.klic);
    if (!v || v.stav === 'duplicita') continue;
    const { pohyb } = v;
    if (r.akce === 'zapsat') {
      const n = zmeneni.get(r.najemnikId) ?? najemnici.find(x => x.id === r.najemnikId);
      if (!n) throw new Error('Neznámý nájemník.');
      platby.push({
        id: noveId(),
        najemnikId: n.id,
        datum: pohyb.datum,
        castka: Math.round(pohyb.castkaHal / 100),
        poznamka: pohyb.zprava.slice(0, 200),
        zdroj: {
          klic: v.klic, banka: vypis.banka, ucet: vypis.ucet, castkaHal: pohyb.castkaHal,
          protiucet: pohyb.protiucet, nazevProtiuctu: pohyb.nazevProtiuctu, vs: pohyb.vs,
        },
      });
      if (r.zapamatovatUcet && pohyb.protiucet && !(n.uctyPlatce ?? []).includes(pohyb.protiucet)) {
        zmeneni.set(n.id, { ...n, uctyPlatce: [...(n.uctyPlatce ?? []), pohyb.protiucet] });
      }
    } else if (r.akce === 'nenajem' || r.akce === 'nenajemVzdy') {
      if (!nova.ignorovane.includes(v.klic)) nova.ignorovane.push(v.klic);
      if (r.akce === 'nenajemVzdy' && pohyb.protiucet && !nova.nenajemUcty.includes(pohyb.protiucet)) {
        nova.nenajemUcty.push(pohyb.protiucet);
      }
    }
    // 'preskocit' = nic, při dalším importu se zeptá znovu
  }
  return { platby, najemnici: [...zmeneni.values()], pravidla: nova };
}

// Výchozí rozhodnutí pro náhled: jisté zapsat, „není nájem“ ignorovat, návrhy a neznámé čekají na potvrzení.
export const vychoziRozhodnuti = vysledky => vysledky
  .filter(v => v.stav !== 'duplicita')
  .map(v => ({
    klic: v.klic,
    akce: v.stav === 'jiste' ? 'zapsat' : v.stav === 'nenajem' ? 'nenajem' : 'preskocit',
    najemnikId: v.najemnikId,
    zapamatovatUcet: v.zapamatovatUcet,
  }));
