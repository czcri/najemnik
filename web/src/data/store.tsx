// Stav aplikace: data z telefonu + akce, které je mění (vždy nejdřív uložit, pak znovu načíst).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as db from './db';
import { vychoziNastaveni } from './vychozi';
import { vymazKoncepty } from '../lib/pamet';
import { stavNajemnika, souhrn, aktualniNajem, jeUkonceny } from '../lib/core';
import { dnes as dnesniDatum } from '../lib/format';
import type { Data, Najemnik, Nastaveni, Platba, Stav, Upominka, Vydaj } from '../types';

export type StavNajemnika = {
  mel: number; zaplatil: number; dluh: number; tentoMesic: number; preplatek: number; stav: Stav;
  budouci?: Record<string, number>;
  radky: { mesic: string; mel: number; najem: number; vydaj: number; uprava: import('../types').UpravaNajmu | null; zaplatil: number; prubeznyRozdil: number; chybi: number; stav: 'ok' | 'bezi' | 'dluh' }[];
};
export type Prehled = StavNajemnika & { najemnik: Najemnik; ukonceny: boolean; najem: number };

type Akce = {
  ulozNajemnika: (n: Najemnik) => Promise<void>;
  smazNajemnika: (id: string) => Promise<void>;
  ulozPlatbu: (p: Platba) => Promise<void>;
  smazPlatbu: (id: string) => Promise<void>;
  ulozVydaj: (v: Vydaj) => Promise<void>;
  smazVydaj: (id: string) => Promise<void>;
  pridejUpominku: (u: Upominka) => Promise<void>;
  ulozNastaveni: (n: Nastaveni) => Promise<void>;
  nahradVse: (d: Data) => Promise<void>;
  davka: typeof db.davka;
};

type Kontext = {
  data: Data;
  nacteno: boolean;
  chyba: string | null;
  dnes: string;
  akce: Akce;
  stav: (id: string) => StavNajemnika;
  prehled: Prehled[];
  souhrn: { dluhCelkem: number; dluzniku: number; tentoMesicCelkem: number };
  prevzatoZPilotu: boolean;
};

const PRAZDNA: Data = { najemnici: [], platby: [], vydaje: [], upominky: [], nastaveni: vychoziNastaveni() };
const Ctx = createContext<Kontext | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(PRAZDNA);
  const [nacteno, setNacteno] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [prevzato, setPrevzato] = useState(false);
  const [dnes, setDnes] = useState(dnesniDatum());

  const obnov = useCallback(async () => setData(await db.nactiVse()), []);

  useEffect(() => {
    (async () => {
      try {
        navigator.storage?.persist?.();
        setPrevzato(await db.prevezmiZPilotu());
        await obnov();
      } catch (e) {
        setChyba(e instanceof Error ? e.message : String(e));
      } finally {
        setNacteno(true);
      }
    })();
    // Po návratu do aplikace (další den / měsíc) přepočítat.
    const viditelnost = () => { if (document.visibilityState === 'visible') setDnes(dnesniDatum()); };
    document.addEventListener('visibilitychange', viditelnost);
    return () => document.removeEventListener('visibilitychange', viditelnost);
  }, [obnov]);

  const akce = useMemo<Akce>(() => {
    const s = <A extends unknown[]>(f: (...a: A) => Promise<unknown>) => async (...a: A) => { await f(...a); await obnov(); };
    return {
      ulozNajemnika: s((n: Najemnik) => db.uloz('najemnici', n)),
      smazNajemnika: s(async (id: string) => { await db.smazNajemnika(id, await db.nactiVse()); vymazKoncepty(); }),
      ulozPlatbu: s((p: Platba) => db.uloz('platby', p)),
      smazPlatbu: s((id: string) => db.smaz('platby', id)),
      ulozVydaj: s((v: Vydaj) => db.uloz('vydaje', v)),
      smazVydaj: s((id: string) => db.smaz('vydaje', id)),
      pridejUpominku: s((u: Upominka) => db.uloz('upominky', u)),
      ulozNastaveni: s((n: Nastaveni) => db.ulozNastaveni(n)),
      nahradVse: s(async (d: Data) => { await db.nahradVse(d); vymazKoncepty(); }),
      davka: s(db.davka) as typeof db.davka,
    };
  }, [obnov]);

  const hodnota = useMemo<Kontext>(() => {
    const cache = new Map<string, StavNajemnika>();
    const stav = (id: string): StavNajemnika => {
      if (!cache.has(id)) {
        const n = data.najemnici.find(x => x.id === id);
        cache.set(id, n
          ? stavNajemnika(n, data.platby.filter(p => p.najemnikId === id), dnes, data.vydaje.filter(v => v.najemnikId === id))
          : { mel: 0, zaplatil: 0, dluh: 0, tentoMesic: 0, preplatek: 0, stav: 'ok', radky: [] });
      }
      return cache.get(id)!;
    };
    const s = souhrn(data.najemnici, data.platby, dnes, data.vydaje);
    const prehled: Prehled[] = s.radky.map(r => ({ ...r, ukonceny: jeUkonceny(r.najemnik, dnes), najem: aktualniNajem(r.najemnik, dnes) }));
    return {
      data, nacteno, chyba, dnes, akce, stav, prehled, prevzatoZPilotu: prevzato,
      souhrn: { dluhCelkem: s.dluhCelkem, dluzniku: s.dluzniku, tentoMesicCelkem: s.tentoMesicCelkem },
    };
  }, [data, nacteno, chyba, dnes, akce, prevzato]);

  return <Ctx.Provider value={hodnota}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData mimo DataProvider');
  return c;
}
