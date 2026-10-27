import type { Nastaveni, Sablona } from '../types';

export const VYCHOZI_SABLONY: Sablona[] = [
  { id: 'pripominka', nazev: 'Přátelská připomínka', text: 'Dobrý den {osloveni}, jen připomínám nájem za {mesic} ve výši {najem}. Číslo účtu {ucet}, VS {vs}. Děkuji.' },
  { id: 'po-splatnosti', nazev: 'Upomínka po splatnosti', text: 'Dobrý den {osloveni}, evidujeme neuhrazený nájem, dlužná částka činí {dluh}. Prosím o úhradu do {termin} na účet {ucet}, VS {vs}. Děkuji.' },
  { id: 'durazna', nazev: 'Důrazná upomínka', text: 'Dobrý den {osloveni}, i přes předchozí upozornění dosud nebyl uhrazen dluh {dluh}. Pokud nebude uhrazen do {termin}, budu nucen řešit situaci dalšími kroky.' },
  { id: 'potvrzeni', nazev: 'Potvrzení platby', text: 'Dobrý den {osloveni}, potvrzuji přijetí platby. Aktuálně máte vše uhrazeno. Děkuji.' },
];

export const vychoziNastaveni = (): Nastaveni => ({
  sablony: VYCHOZI_SABLONY,
  ucty: [],
  pravidla: { nenajemUcty: [], ignorovane: [] },
  importy: [],
  posledniZaloha: null,
});
