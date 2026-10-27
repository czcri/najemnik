// Párování plateb z výpisu na nájemníky (spec. kap. 11) – vymyšlená data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparuj, prevedImport, vychoziRozhodnuti, klicePohybu, prazdnaPravidla } from '../app/parovani.js';

const MUJ = '2200000001/2010';
const pohyb = (o = {}) => ({
  datum: '2026-10-05', castkaHal: 1200000, protiucet: '', nazevProtiuctu: '', vs: '', ks: '', ss: '',
  zprava: '', typ: 'Příjem', idBanky: '', ...o,
});
const vypis = (...pohyby) => ({ banka: 'fio', ucet: MUJ, pohyby });
const jana = { id: 'jana', jmeno: 'Jana Nováková', vs: '1001', ucetProPlatby: MUJ, uctyPlatce: ['111/0800'] };
const petr = { id: 'petr', jmeno: 'Petr Dvořák', vs: '1002', ucetProPlatby: MUJ, uctyPlatce: [] };
const eva = { id: 'eva', jmeno: 'Eva Malá', vs: '', ucetProPlatby: '131-1/0100', uctyPlatce: ['333/0300'] };
const NAJ = [jana, petr, eva];
const jeden = (p, opt = {}) => sparuj(vypis(p), opt.najemnici ?? NAJ, opt.platby ?? [], opt.pravidla)[0];

test('známý účet plátce → jistě, i bez VS', () => {
  const v = jeden(pohyb({ protiucet: '111/0800' }));
  assert.equal(v.stav, 'jiste');
  assert.equal(v.najemnikId, 'jana');
  assert.equal(v.zapamatovatUcet, false);
});

test('VS bez známého účtu → jistě + nabídnout zapamatování účtu', () => {
  const v = jeden(pohyb({ protiucet: '222/5500', vs: '0001002' }));
  assert.equal(v.stav, 'jiste');
  assert.equal(v.najemnikId, 'petr');
  assert.equal(v.zapamatovatUcet, true);
});

test('rozpor účtu a VS → návrh s oběma kandidáty', () => {
  const v = jeden(pohyb({ protiucet: '111/0800', vs: '1002' }));
  assert.equal(v.stav, 'navrh');
  assert.deepEqual(v.kandidati, ['jana', 'petr']);
});

test('platba na jiný můj účet, než kam nájemník platí → jen návrh', () => {
  const v = jeden(pohyb({ protiucet: '333/0300' }));
  assert.equal(v.stav, 'navrh');
  assert.equal(v.najemnikId, 'eva');
  assert.match(v.duvod, /jiný účet/);
});

test('shoda jména (i obrácené pořadí, bez diakritiky) → návrh', () => {
  const v = jeden(pohyb({ protiucet: '999/0100', nazevProtiuctu: 'NOVAKOVA, JANA' }));
  assert.equal(v.stav, 'navrh');
  assert.equal(v.najemnikId, 'jana');
  assert.equal(v.zapamatovatUcet, true);
});

test('neznámý plátce → nepřiřazeno; nikdy jen podle částky', () => {
  const v = jeden(pohyb({ protiucet: '999/0100', nazevProtiuctu: 'Někdo jiný', castkaHal: 1200000 }));
  assert.equal(v.stav, 'neprirazeno');
  assert.equal(v.najemnikId, null);
});

test('účet označený „není nájem“', () => {
  const v = jeden(pohyb({ protiucet: '999/0100' }), { pravidla: { nenajemUcty: ['999/0100'], ignorovane: [] } });
  assert.equal(v.stav, 'nenajem');
});

test('odchozí platby a úroky se nepárují', () => {
  const r = sparuj(vypis(pohyb({ castkaHal: -50000, protiucet: '111/0800' }), pohyb({ castkaHal: 35, typ: 'Připsaný úrok' })), NAJ, []);
  assert.equal(r.length, 0);
});

test('z jednoho účtu platí dva nájemníci → rozhodne VS', () => {
  const a = { ...jana, uctyPlatce: ['555/0800'] }, b = { ...petr, uctyPlatce: ['555/0800'] };
  assert.equal(jeden(pohyb({ protiucet: '555/0800', vs: '1002' }), { najemnici: [a, b] }).najemnikId, 'petr');
  const bezVs = jeden(pohyb({ protiucet: '555/0800' }), { najemnici: [a, b] });
  assert.equal(bezVs.stav, 'navrh');
  assert.deepEqual(bezVs.kandidati, ['jana', 'petr']);
});

test('klíče: stejné pohyby v jednom výpisu se rozliší, ID banky má přednost', () => {
  const p = pohyb({ protiucet: '111/0800' });
  const k = klicePohybu(MUJ, [p, p, pohyb({ idBanky: 'ABC' })]);
  assert.equal(new Set(k).size, 3);
  assert.equal(k[2], `${MUJ}|id|ABC`);
});

test('import → platby, zapamatování účtu, opakovaný import = duplicita', () => {
  const v = vypis(
    pohyb({ protiucet: '222/5500', vs: '1002', zprava: 'najem rijen', castkaHal: 1200050 }), // jistě petr (VS), haléře
    pohyb({ protiucet: '999/0100', nazevProtiuctu: 'Pojišťovna' }),                       // neznámý
    pohyb({ protiucet: '777/0100', nazevProtiuctu: 'Banka úvěr' }),                       // neznámý
  );
  const vysledky = sparuj(v, NAJ, []);
  const rozhodnuti = vychoziRozhodnuti(vysledky);
  assert.deepEqual(rozhodnuti.map(r => r.akce), ['zapsat', 'preskocit', 'preskocit']);
  rozhodnuti[1].akce = 'nenajemVzdy';
  rozhodnuti[2].akce = 'nenajem';

  let id = 0;
  const z = prevedImport(v, vysledky, rozhodnuti, NAJ, prazdnaPravidla(), () => `p${++id}`);
  assert.equal(z.platby.length, 1);
  assert.deepEqual(
    { ...z.platby[0], zdroj: undefined },
    { id: 'p1', najemnikId: 'petr', datum: '2026-10-05', castka: 12001, poznamka: 'najem rijen', zdroj: undefined },
  );
  assert.equal(z.platby[0].zdroj.castkaHal, 1200050);
  assert.deepEqual(z.najemnici.map(n => [n.id, n.uctyPlatce]), [['petr', ['222/5500']]]);
  assert.deepEqual(z.pravidla.nenajemUcty, ['999/0100']);
  assert.equal(z.pravidla.ignorovane.length, 2);

  // druhý import téhož výpisu
  const najemnici2 = NAJ.map(n => z.najemnici.find(x => x.id === n.id) ?? n);
  const znovu = sparuj(v, najemnici2, z.platby, z.pravidla);
  assert.deepEqual(znovu.map(x => x.stav), ['duplicita', 'duplicita', 'duplicita']);
  assert.equal(vychoziRozhodnuti(znovu).length, 0);

  // nová platba od Petra příští měsíc → už podle zapamatovaného účtu, bez VS
  const dalsi = sparuj(vypis(pohyb({ datum: '2026-11-03', protiucet: '222/5500' })), najemnici2, z.platby, z.pravidla)[0];
  assert.equal(dalsi.stav, 'jiste');
  assert.equal(dalsi.najemnikId, 'petr');
});
