// Typované vstupy do sdílené logiky v core/ (čisté JS, testované v node).
import * as logika from '../../../core/logika.js';
import * as vypisy from '../../../core/vypisy.js';
import * as parovani from '../../../core/parovani.js';
import * as stat from '../../../core/statistiky.js';
import * as hotovost from '../../../core/hotovost.js';
import * as dluhy from '../../../core/dluhy.js';
import type { Data, Najemnik, Platba, PravidlaImportu, Stav, UpravaNajmu, Vydaj, Zpusob } from '../types';

type F<T> = T;
export const parseCastka = logika.parseCastka as F<(t: string) => number | null>;
export const zmenNajem = logika.zmenNajem as unknown as (p: Najemnik['predpisy'], od: string, castka: number) => Najemnik['predpisy'];
export const aktualniNajem = logika.aktualniNajem as unknown as (n: Najemnik, dnes: string) => number;
export const castkaPredpisu = logika.castkaPredpisu as unknown as (p: Najemnik['predpisy'][number]) => number;
export const predpisVMesici = logika.predpisVMesici as unknown as (n: Najemnik, m: string) => Najemnik['predpisy'][number] | null;
export const stavNajemnika = logika.stavNajemnika as unknown as (n: Najemnik, p: Platba[], dnes: string, v?: Vydaj[]) => import('../data/store').StavNajemnika;
type Souhrn = { radky: (import('../data/store').StavNajemnika & { najemnik: Najemnik })[]; dluhCelkem: number; dluzniku: number; tentoMesicCelkem: number };
export const souhrn = logika.souhrn as unknown as (n: Najemnik[], p: Platba[], dnes: string, v?: Vydaj[]) => Souhrn;
export const jeUkonceny = logika.jeUkonceny as unknown as (n: Najemnik, dnes: string) => boolean;
export type NavrhPlatby = { zaMesic: string; castka: number; doplatek: boolean; zaplaceno: number; mel: number };
export const navrhPlatby = logika.navrhPlatby as unknown as (n: Najemnik, p: Platba[], dnes: string, v?: Vydaj[], zaMesic?: string | null) => NavrhPlatby;
export const obdobiPlatby = logika.obdobiPlatby as unknown as (p: Platba, n?: Najemnik) => string;
export const standardniNajem = logika.standardniNajem as unknown as (n: Najemnik, m: string) => number;
export const najemVMesici = logika.najemVMesici as unknown as (n: Najemnik, m: string) => number;
export const upravaVMesici = logika.upravaVMesici as unknown as (n: Najemnik, m: string) => UpravaNajmu | null;
export const nastavUpravu = logika.nastavUpravu as unknown as (n: Najemnik, od: string, doMesice: string | null, castka: number | null, duvod?: string) => UpravaNajmu[];
export const dalsiMesic = logika.dalsiMesic as (m: string) => string;
export const mesicZData = logika.mesicZData as (d: string) => string;
export const vytvorZalohu = logika.vytvorZalohu as unknown as (d: Data, cas: string) => object;
export const nactiZalohu = logika.nactiZalohu as unknown as (text: string) => Omit<Data, 'nastaveni'> & { nastaveni: Partial<Data['nastaveni']> };

export type Pohyb = {
  datum: string; castkaHal: number; protiucet: string; nazevProtiuctu: string;
  vs: string; ks: string; ss: string; zprava: string; typ: string; idBanky: string;
};
export type Vypis = { banka: 'fio' | 'cs' | 'kb'; ucet: string; pohyby: Pohyb[] };
export const jePdf = vypisy.jePdf as unknown as (b: Uint8Array) => boolean;
export const nactiCsvVypis = vypisy.nactiCsvVypis as unknown as (b: Uint8Array, nazev: string) => Vypis;
export const nactiKbPdf = vypisy.nactiKbPdf as unknown as (stranky: { x: number; y: number; str: string }[][]) => Vypis;
export const normalizujUcet = vypisy.normalizujUcet as unknown as (t: string, kod?: string) => string;

export type VysledekParovani = {
  klic: string; pohyb: Pohyb; stav: 'jiste' | 'navrh' | 'neprirazeno' | 'nenajem' | 'duplicita' | 'rucne';
  najemnikId: string | null; kandidati: string[]; duvod: string; zapamatovatUcet: boolean; nahraditPlatbuId?: string;
};
export type Rozhodnuti = { klic: string; akce: 'zapsat' | 'nahradit' | 'nenajem' | 'nenajemVzdy' | 'preskocit'; najemnikId: string | null; zapamatovatUcet: boolean };
export const sparuj = parovani.sparuj as unknown as (v: Vypis, n: Najemnik[], p: Platba[], pr: PravidlaImportu) => VysledekParovani[];
export const vychoziRozhodnuti = parovani.vychoziRozhodnuti as unknown as (v: VysledekParovani[]) => Rozhodnuti[];
export const prevedImport = parovani.prevedImport as unknown as (
  v: Vypis, vys: VysledekParovani[], r: Rozhodnuti[], n: Najemnik[], pr: PravidlaImportu, noveId: () => string,
) => { platby: Platba[]; smazatPlatby: string[]; najemnici: Najemnik[]; pravidla: PravidlaImportu };

export type StatMesic = { mesic: string; ucet: number; hotove: number; prijato: number; ocekavano: number; dluh: number; vcas: number; pozde: number; vubec: number };
export type Statistiky = {
  mesice: StatMesic[]; prijato: number; prijatoUcet: number; prijatoHotove: number; ocekavano: number;
  uspesnost: number | null; dluh: number; podleNajemniku: { najemnik: Najemnik; prijato: number; dluh: number; stav: Stav }[];
};
export const statistiky = stat.statistiky as unknown as (
  d: { najemnici: Najemnik[]; platby: Platba[]; vydaje: Vydaj[] }, od: string, doMesice: string, dnes: string,
  filtr?: { zpusob?: 'vse' | Zpusob; oznaceni?: string | null },
) => Statistiky;
export type PolozkaMesice = {
  najemnik: Najemnik; zaMesic: string; mel: number; zaplaceno: number; chybi: number; stav: 'nezaplaceno' | 'castecne' | 'zaplaceno';
  ocekavano: string | null; dnes: boolean; poTerminu: boolean;
};
export const seznamMesice = hotovost.seznamMesice as unknown as (n: Najemnik[], p: Platba[], v: Vydaj[], dnes: string, zpusob: Zpusob) =>
  { polozky: PolozkaMesice[]; celkem: number; zaplaceno: number; prevzato: number };
export const odkazKalendare = hotovost.odkazKalendare as unknown as (n: Najemnik, castka: number, odData: string) => string;
export const icsHotovosti = hotovost.icsHotovosti as unknown as (p: { najemnik: Najemnik; castka: number }[], odData: string, razitko: string) => string;
export const zpusobPlatby = stat.zpusobPlatby as unknown as (p: Platba, n?: Najemnik) => Zpusob;

export const dluhyZaMesic = dluhy.dluhyZaMesic as unknown as (n: Najemnik[], p: Platba[], v: Vydaj[], dnes: string, mesic: string) =>
  { najemnik: Najemnik; mel: number; zaplaceno: number; chybi: number }[];
export const dluhyVMesici = dluhy.dluhyVMesici as unknown as (n: Najemnik[], p: Platba[], v: Vydaj[], dnes: string, mesic: string) =>
  { najemnik: Najemnik; mel: number; prijato: number; predplaceno: number; dluh: number }[];
