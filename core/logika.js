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

// Za který měsíc platba je: uložené „za měsíc“, jinak odvozeně z data podle pravidla nájemníka
// (kdo platí dopředu, platí v září za říjen). Platby z dřívějších verzí pole nemají.
export function obdobiPlatby(platba, najemnik) {
  if (platba.zaMesic) return platba.zaMesic;
  const m = mesicZData(platba.datum);
  return najemnik?.platiDopredu ? dalsiMesic(m) : m;
}

// Standardní nájem měsíce podle předpisu (bez úprav).
export const standardniNajem = (najemnik, mesic) => { const p = predpisVMesici(najemnik, mesic); return p ? castkaPredpisu(p) : 0; };
// Úprava nájmu pro konkrétní měsíc (dohodnutá sleva / jiná částka): najemnik.upravy = [{ mesic, castka, duvod }].
export const upravaVMesici = (najemnik, mesic) => (najemnik.upravy ?? []).find(u => u.mesic === mesic) ?? null;
// Nájem, který se v měsíci skutečně platí: úprava, jinak předpis.
export const najemVMesici = (najemnik, mesic) => upravaVMesici(najemnik, mesic)?.castka ?? standardniNajem(najemnik, mesic);

// Nastaví (nebo zruší, je-li částka rovna standardu / null) úpravu nájmu pro měsíce od–do.
export function nastavUpravu(najemnik, od, doMesice, castka, duvod = '') {
  const mesice = rozsahMesicu(od, doMesice && doMesice >= od ? doMesice : od);
  const upravy = (najemnik.upravy ?? []).filter(u => !mesice.includes(u.mesic));
  for (const m of mesice) {
    if (castka === null || castka === standardniNajem(najemnik, m)) continue;
    upravy.push({ mesic: m, castka, ...(duvod ? { duvod } : {}) });
  }
  return upravy.sort((a, b) => a.mesic.localeCompare(b.mesic));
}

// vydaje = jednorázové výdaje / dluhy nájemníka { datum, castka, popis } – navyšují „měl zaplatit“ v měsíci data.
// Platby se počítají do měsíce, za který jsou (obdobiPlatby). Co v měsíci přebývá, doplní nejdřív
// nejstarší nezaplacené měsíce a zbytek je přeplatek. Platby za budoucí měsíce = předplaceno.
export function stavNajemnika(najemnik, platby, dnes, vydaje = []) {
  const aktualni = mesicZData(dnes);
  const ukonceny = !!najemnik.konec && najemnik.konec < aktualni;
  const posledni = ukonceny ? najemnik.konec : aktualni;
  const mesice = najemnik.zacatek <= posledni ? rozsahMesicu(najemnik.zacatek, posledni) : [];
  const zaplatil = platby.reduce((s, p) => s + p.castka, 0);

  const zaObdobi = new Map(), budouci = {};
  for (const p of platby) {
    let m = obdobiPlatby(p, najemnik);
    if (mesice.length && m < mesice[0]) m = mesice[0];
    if (!mesice.length || m > posledni) {
      if (ukonceny && mesice.length) m = posledni;
      else { budouci[m] = (budouci[m] ?? 0) + p.castka; continue; }
    }
    zaObdobi.set(m, (zaObdobi.get(m) ?? 0) + p.castka);
  }
  if (!mesice.length) {
    return { mel: 0, zaplatil, dluh: 0, tentoMesic: 0, preplatek: zaplatil, stav: zaplatil > 0 ? 'preplatek' : 'ok', radky: [], budouci };
  }

  // Výdaje do měsíce podle data (mimo rozsah ke krajnímu měsíci); výdaj s datem v budoucnu až v jeho měsíci.
  const vydajeVMesici = new Map();
  for (const v of vydaje) {
    let m = mesicZData(v.datum);
    if (m > posledni) continue;
    if (m < mesice[0]) m = mesice[0];
    vydajeVMesici.set(m, (vydajeVMesici.get(m) ?? 0) + v.castka);
  }

  // 1) každý měsíc nejdřív platbami za něj; 2) přebytky doplní nejstarší nezaplacené měsíce.
  let pool = 0;
  const radky = mesice.map(mesic => {
    const najem = najemVMesici(najemnik, mesic);
    const uprava = upravaVMesici(najemnik, mesic);
    const vydaj = vydajeVMesici.get(mesic) ?? 0;
    const mel = najem + vydaj;
    const zaplatilZa = zaObdobi.get(mesic) ?? 0;
    const pokryto = Math.min(mel, zaplatilZa);
    pool += zaplatilZa - pokryto;
    return { mesic, mel, najem, vydaj, uprava, zaplatil: zaplatilZa, pokryto };
  });
  for (const r of radky) {
    const doplnit = Math.min(r.mel - r.pokryto, pool);
    r.pokryto += doplnit;
    pool -= doplnit;
  }

  let kumMel = 0, kumZaplatil = 0;
  const vysledek = radky.map(r => {
    kumMel += r.mel;
    kumZaplatil += r.zaplatil;
    const chybi = r.mel - r.pokryto;
    const stav = chybi === 0 ? 'ok' : r.mesic === aktualni ? 'bezi' : 'dluh';
    const { pokryto, ...zbytek } = r;
    return { ...zbytek, prubeznyRozdil: kumMel - kumZaplatil, chybi, stav };
  });

  const mel = kumMel;
  const dluh = vysledek.filter(r => r.mesic < aktualni).reduce((s, r) => s + r.chybi, 0);
  const tentoMesic = vysledek.find(r => r.mesic === aktualni)?.chybi ?? 0;
  const preplatek = pool + Object.values(budouci).reduce((s, x) => s + x, 0);
  const stav = dluh > 0 ? 'dluh' : tentoMesic > 0 ? 'bezi' : preplatek > 0 ? 'preplatek' : 'ok';
  return { mel, zaplatil, dluh, tentoMesic, preplatek, stav, radky: vysledek, budouci };
}

// Návrh nové platby: za který měsíc a kolik.
// Měsíc: nejstarší nezaplacený ukončený měsíc (dluh), jinak běžný měsíc / u „platí dopředu“ příští,
// a pokud je už celý zaplacený, další nezaplacený. Částka: pravidelný nájem toho měsíce,
// nebo doplatek, když už za něj část přišla. zaMesic lze zadat (uživatel změnil měsíc).
// platby a vydaje = jen tohoto nájemníka.
export function navrhPlatby(najemnik, platby, dnes, vydaje = [], zaMesic = null) {
  const aktualni = mesicZData(dnes);
  const s = stavNajemnika(najemnik, platby, dnes, vydaje);
  const pokrytiMesice = m => {
    const r = s.radky.find(x => x.mesic === m);
    if (r) return { mel: r.mel, najem: r.najem, pokryto: r.mel - r.chybi };
    const najem = najemVMesici(najemnik, m) || aktualniNajem(najemnik, dnes);
    return { mel: najem, najem, pokryto: Math.min(najem, s.budouci?.[m] ?? 0) };
  };
  let m = zaMesic;
  if (!m) {
    m = s.radky.find(r => r.mesic < aktualni && r.chybi > 0)?.mesic;
    if (!m) {
      m = najemnik.platiDopredu ? dalsiMesic(aktualni) : aktualni;
      if (m < najemnik.zacatek) m = najemnik.zacatek;
      for (let i = 0; i < 24 && pokrytiMesice(m).pokryto >= pokrytiMesice(m).mel; i++) m = dalsiMesic(m);
    }
  }
  const p = pokrytiMesice(m);
  const chybi = p.mel - p.pokryto;
  if (p.pokryto > 0 && chybi > 0) return { zaMesic: m, castka: chybi, doplatek: true, zaplaceno: p.pokryto, mel: p.mel };
  return { zaMesic: m, castka: p.najem, doplatek: false, zaplaceno: p.pokryto, mel: p.mel };
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
