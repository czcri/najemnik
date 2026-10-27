// Datový model (spec. kap. 4, 11, 12). Výpočty jsou v core/ (JS, testované v node).

export type Slozka = { nazev: string; castka: number };
export type Predpis = { od: string; slozky: Slozka[] }; // od = 'RRRR-MM'
export type Zpusob = 'ucet' | 'hotove';

export type Najemnik = {
  id: string;
  jmeno: string;
  oznaceni: string;
  zacatek: string; // 'RRRR-MM'
  konec: string | null;
  predpisy: Predpis[];
  telefon?: string;
  email?: string;
  poznamka?: string;
  osloveni?: string;
  vs?: string;
  zpusobPlaceni?: Zpusob;
  uctyPlatce?: string[]; // účty, ze kterých platí
  ucetProPlatby?: string; // můj účet, kam platí
  poznamkaDluh?: { text: string; datum: string };
};

export type ZdrojPlatby =
  | { typ: 'hotove' }
  | { typ: 'prevod' }
  | {
      typ: 'vypis';
      klic: string;
      banka: 'fio' | 'cs' | 'kb';
      ucet: string;
      castkaHal: number;
      protiucet?: string;
      nazevProtiuctu?: string;
      vs?: string;
    };

export type Platba = {
  id: string;
  najemnikId: string;
  datum: string; // 'RRRR-MM-DD'
  castka: number;
  poznamka?: string;
  zdroj?: ZdrojPlatby; // chybí u plateb z pilotu
};

export type Vydaj = { id: string; najemnikId: string; datum: string; castka: number; popis: string };

export type Kanal = 'sms' | 'whatsapp' | 'email';
export type Upominka = { id: string; najemnikId: string; datum: string; kanal: Kanal; text: string; sablona?: string };

export type Sablona = { id: string; nazev: string; text: string };
export type MujUcet = { ucet: string; banka: string; nazev: string };
export type PravidlaImportu = { nenajemUcty: string[]; ignorovane: string[] };
export type ZaznamImportu = { soubor: string; datum: string; pocet: number };

export type Nastaveni = {
  sablony: Sablona[];
  ucty: MujUcet[];
  pravidla: PravidlaImportu;
  importy: ZaznamImportu[];
  posledniZaloha: string | null;
};

export type Data = {
  najemnici: Najemnik[];
  platby: Platba[];
  vydaje: Vydaj[];
  upominky: Upominka[];
  nastaveni: Nastaveni;
};

export type Stav = 'dluh' | 'bezi' | 'ok' | 'preplatek';
