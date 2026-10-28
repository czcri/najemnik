// Čisté výpočty – bez DOM a bez úložiště, testují se v node (tests/).
// Měsíc = 'RRRR-MM', datum = 'RRRR-MM-DD', částky = celé koruny.

export const mesicZData = datum => datum.slice(0, 7);

export function dalsiMesic(m) {
  let [r, mm] = m.split('-').map(Number);
  if (++mm > 12) { mm = 1; r++; }
  return `${r}-${String(mm).padStart(2, '0')}`;
}

export function rozsahMesicu(od, doMesice) {
  const out = [];
  for (let m = od; m <= doMesice; m = dalsiMesic(m)) out.push(m);
  return out;
}

export const castkaPredpisu = predpis => predpis.slozky.reduce((s, x) => s + x.castka, 0);

// Předpis platný v daném měsíci = ten s nejpozdějším „od“, které není po měsíci.
export function predpisVMesici(najemnik, mesic) {
  let platny = null;
  for (const p of najemnik.predpisy) {
    if (p.od <= mesic && (!platny || p.od > platny.od)) platny = p;
  }
  return platny;
}

// Aktuální nájem; u nájmu, který teprve začne, první předpis.
export function aktualniNajem(najemnik, dnes) {
  const p = predpisVMesici(najemnik, mesicZData(dnes))
    ?? [...najemnik.predpisy].sort((a, b) => a.od.localeCompare(b.od))[0];
  return p ? castkaPredpisu(p) : 0;
}

// Změna nájmu od měsíce: stejný měsíc se přepíše, ostatní zůstanou.
export function zmenNajem(predpisy, od, castka) {
  return [...predpisy.filter(p => p.od !== od), { od, slozky: [{ nazev: 'Nájem', castka }] }]
    .sort((a, b) => a.od.localeCompare(b.od));
}

// vydaje = jednorázové výdaje / dluhy nájemníka { datum, castka, popis } – navyšují „měl zaplatit“ v měsíci data.
export function stavNajemnika(najemnik, platby, dnes, vydaje = []) {
  const aktualni = mesicZData(dnes);
  const posledni = najemnik.konec && najemnik.konec < aktualni ? najemnik.konec : aktualni;
  const mesice = najemnik.zacatek <= posledni ? rozsahMesicu(najemnik.zacatek, posledni) : [];
  const zaplatil = platby.reduce((s, p) => s + p.castka, 0);
  if (!mesice.length) {
    const preplatek = zaplatil;
    return { mel: 0, zaplatil, dluh: 0, tentoMesic: 0, preplatek, stav: preplatek > 0 ? 'preplatek' : 'ok', radky: [] };
  }

  // Platby a výdaje do měsíců podle data; mimo rozsah nájmu ke krajnímu měsíci.
  const doMesicu = polozky => {
    const mapa = new Map();
    for (const p of polozky) {
      let m = mesicZData(p.datum);
      if (mesice.length) {
        if (m < mesice[0]) m = mesice[0];
        if (m > mesice.at(-1)) m = mesice.at(-1);
      }
      mapa.set(m, (mapa.get(m) ?? 0) + p.castka);
    }
    return mapa;
  };
  const podleMesice = doMesicu(platby);
  // Výdaj s datem v budoucnu se započítá až v jeho měsíci.
  const vydajeVMesici = doMesicu(vydaje.filter(v => mesicZData(v.datum) <= posledni));

  let kumMel = 0, kumZaplatil = 0, melUkoncene = 0;
  const radky = mesice.map(mesic => {
    const predpis = predpisVMesici(najemnik, mesic);
    const najem = predpis ? castkaPredpisu(predpis) : 0;
    const vydaj = vydajeVMesici.get(mesic) ?? 0;
    const mel = najem + vydaj;
    const zaplatilVMesici = podleMesice.get(mesic) ?? 0;
    kumMel += mel;
    kumZaplatil += zaplatilVMesici;
    if (mesic < aktualni) melUkoncene += mel;
    // Kolik z tohoto měsíce ještě chybí, když se všechny platby započtou od nejstaršího.
    const chybi = Math.max(0, Math.min(mel, kumMel - zaplatil));
    const stav = chybi === 0 ? 'ok' : mesic === aktualni ? 'bezi' : 'dluh';
    return { mesic, mel, najem, vydaj, zaplatil: zaplatilVMesici, prubeznyRozdil: kumMel - kumZaplatil, chybi, stav };
  });

  const mel = kumMel;
  const dluh = Math.max(0, melUkoncene - zaplatil);
  const tentoMesic = Math.max(0, mel - zaplatil - dluh);
  const preplatek = Math.max(0, zaplatil - mel);
  const stav = dluh > 0 ? 'dluh' : tentoMesic > 0 ? 'bezi' : preplatek > 0 ? 'preplatek' : 'ok';
  return { mel, zaplatil, dluh, tentoMesic, preplatek, stav, radky };
}

// Předvyplněná částka nové platby: pravidelný měsíční nájem; jen když už v aktuálním měsíci
// část přišla (platby s datem v tomto měsíci), doplatek do celého předpisu měsíce (nájem + výdaje).
// platby a vydaje = jen tohoto nájemníka.
export function navrhPlatby(najemnik, platby, dnes, vydaje = []) {
  const najem = aktualniNajem(najemnik, dnes);
  const mesic = mesicZData(dnes);
  const radek = stavNajemnika(najemnik, platby, dnes, vydaje).radky.find(r => r.mesic === mesic);
  const zaplaceno = platby.filter(p => mesicZData(p.datum) === mesic).reduce((s, p) => s + p.castka, 0);
  const chybi = radek ? radek.mel - zaplaceno : 0;
  if (zaplaceno > 0 && chybi > 0) return { castka: chybi, doplatek: true, zaplaceno, mel: radek.mel };
  return { castka: najem, doplatek: false, zaplaceno, mel: radek?.mel ?? najem };
}

export const jeUkonceny = (najemnik, dnes) => !!najemnik.konec && najemnik.konec < mesicZData(dnes);

const PORADI = { dluh: 0, bezi: 1, preplatek: 2, ok: 3 };

export function souhrn(najemnici, platby, dnes, vydaje = []) {
  const radky = najemnici.map(n => ({
    najemnik: n,
    ukonceny: jeUkonceny(n, dnes),
    ...stavNajemnika(n, platby.filter(p => p.najemnikId === n.id), dnes, vydaje.filter(v => v.najemnikId === n.id)),
  }));
  radky.sort((a, b) => PORADI[a.stav] - PORADI[b.stav]
    || b.dluh - a.dluh || b.tentoMesic - a.tentoMesic
    || a.najemnik.jmeno.localeCompare(b.najemnik.jmeno, 'cs'));
  return {
    radky,
    dluhCelkem: radky.reduce((s, r) => s + r.dluh, 0),
    dluzniku: radky.filter(r => r.dluh > 0).length,
    tentoMesicCelkem: radky.reduce((s, r) => s + r.tentoMesic, 0),
  };
}

// Výzva k záloze svítí od 1. dne měsíce, dokud se v tomto měsíci nezálohovalo.
export const potrebaZalohy = (posledniZaloha, dnes, maData) =>
  maData && (!posledniZaloha || mesicZData(posledniZaloha) < mesicZData(dnes));

// „12 500“, „12 500 Kč“ → 12500; jinak null.
export function parseCastka(text) {
  const t = String(text).replace(/[\s ]/g, '').replace(/Kč$/i, '').replace(/,-$/, '');
  return /^\d{1,9}$/.test(t) && +t > 0 ? +t : null;
}

export const ZALOHA_VERZE = 2;

// Kolekce v záloze. Verze 1 (pilot) měla jen najemnici a platby.
export const KOLEKCE = ['najemnici', 'platby', 'vydaje', 'upominky'];

// data = { najemnici, platby, vydaje, upominky, nastaveni }
export function vytvorZalohu(data, cas) {
  const z = { aplikace: 'najemnik', verze: ZALOHA_VERZE, vytvoreno: cas };
  for (const k of KOLEKCE) z[k] = data[k] ?? [];
  z.nastaveni = data.nastaveni ?? {};
  return z;
}

// Zkontroluje soubor zálohy; vrací { najemnici, platby, vydaje, upominky, nastaveni }, nebo vyhodí chybu s českou zprávou.
export function nactiZalohu(text) {
  let z;
  try { z = JSON.parse(text); } catch { throw new Error('Soubor není záloha Nájemníka (neplatný formát).'); }
  if (z?.aplikace !== 'najemnik' || !Array.isArray(z.najemnici) || !Array.isArray(z.platby)) {
    throw new Error('Soubor není záloha Nájemníka.');
  }
  if (z.verze > ZALOHA_VERZE) throw new Error('Záloha je z novější verze aplikace – nejdřív aplikaci aktualizujte.');
  const ids = new Set();
  for (const n of z.najemnici) {
    if (!n.id || !n.jmeno || !/^\d{4}-\d{2}$/.test(n.zacatek) || !Array.isArray(n.predpisy)) {
      throw new Error('Záloha obsahuje poškozeného nájemníka.');
    }
    ids.add(n.id);
  }
  const kontrola = (seznam, nazev) => {
    for (const p of seznam) {
      if (!p.id || !ids.has(p.najemnikId) || !/^\d{4}-\d{2}-\d{2}$/.test(p.datum) || (nazev !== 'upomínku' && !Number.isInteger(p.castka))) {
        throw new Error(`Záloha obsahuje poškozenou ${nazev}.`);
      }
    }
  };
  kontrola(z.platby, 'platbu');
  kontrola(z.vydaje ?? [], 'položku výdaje');
  kontrola(z.upominky ?? [], 'upomínku');
  return {
    najemnici: z.najemnici, platby: z.platby, vydaje: z.vydaje ?? [], upominky: z.upominky ?? [],
    nastaveni: z.nastaveni ?? {},
  };
}
