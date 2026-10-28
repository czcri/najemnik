// Akceptační scénáře ze specifikace (kap. 8) + okrajové případy. Spuštění: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stavNajemnika, souhrn, zmenNajem, aktualniNajem, potrebaZalohy, parseCastka, navrhPlatby, obdobiPlatby, nastavUpravu, najemVMesici,
  vytvorZalohu, nactiZalohu, rozsahMesicu,
} from '../core/logika.js';

const DNES = '2026-10-15';
const test1 = () => ({
  id: 'n1', jmeno: 'Test', oznaceni: 'Byt 1', zacatek: '2026-08', konec: null,
  predpisy: [{ od: '2026-08', slozky: [{ nazev: 'Nájem', castka: 10000 }] }],
});
const platba = (id, datum, castka) => ({ id, najemnikId: 'n1', datum, castka, poznamka: '' });
const stavy = s => s.radky.map(r => `${r.mesic}:${r.stav}`);

test('rozsah měsíců přes konec roku', () => {
  assert.deepEqual(rozsahMesicu('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
});

test('1: nový nájemník bez plateb', () => {
  const s = stavNajemnika(test1(), [], DNES);
  assert.equal(s.mel, 30000);
  assert.equal(s.zaplatil, 0);
  assert.equal(s.dluh, 20000);
  assert.equal(s.tentoMesic, 10000);
  assert.equal(s.stav, 'dluh');
  assert.deepEqual(stavy(s), ['2026-08:dluh', '2026-09:dluh', '2026-10:bezi']);
});

test('2: platba 10 000 za nejstarší měsíc (srpen)', () => {
  const s = stavNajemnika(test1(), [{ ...platba('p1', '2026-10-05', 10000), zaMesic: '2026-08' }], DNES);
  assert.equal(s.dluh, 10000);
  assert.equal(s.tentoMesic, 10000);
  assert.deepEqual(stavy(s), ['2026-08:ok', '2026-09:dluh', '2026-10:bezi']);
});

test('2b: platba bez „za měsíc“ (z dřívějších verzí) se počítá do měsíce podle data', () => {
  const s = stavNajemnika(test1(), [platba('p1', '2026-10-05', 10000)], DNES);
  assert.deepEqual(stavy(s), ['2026-08:dluh', '2026-09:dluh', '2026-10:ok']);
  assert.equal(s.dluh, 20000);
  assert.equal(s.tentoMesic, 0);
});

test('3: pozdní doplatek za starší měsíce; přebytek doplní nejstarší nezaplacené', () => {
  const s = stavNajemnika(test1(), [
    { ...platba('p1', '2026-10-05', 10000), zaMesic: '2026-08' },
    { ...platba('p2', '2026-10-10', 15000), zaMesic: '2026-09' },   // 5 000 navíc → říjen
  ], DNES);
  assert.equal(s.dluh, 0);
  assert.equal(s.tentoMesic, 5000);
  assert.equal(s.stav, 'bezi');
  assert.deepEqual(stavy(s), ['2026-08:ok', '2026-09:ok', '2026-10:bezi']);
  assert.equal(s.radky[2].chybi, 5000);
  // sloupec Zaplatil = platby za daný měsíc; průběžný rozdíl podle nich
  assert.deepEqual(s.radky.map(r => r.zaplatil), [10000, 15000, 0]);
  assert.deepEqual(s.radky.map(r => r.prubeznyRozdil), [0, -5000, 5000]);
});

test('přebytek běžného měsíce doplní nejdřív nejstarší dluh', () => {
  const s = stavNajemnika(test1(), [{ ...platba('p1', '2026-10-05', 25000), zaMesic: '2026-10' }], DNES);
  assert.deepEqual(stavy(s), ['2026-08:ok', '2026-09:dluh', '2026-10:ok']);
  assert.equal(s.dluh, 5000);
});

test('platba dopředu: v září za říjen; pravidlo nájemníka posune i platby bez „za měsíc“', () => {
  const n = test1();
  const zari = '2026-09-25';
  const s = stavNajemnika(n, [platba('p1', '2026-08-03', 10000), { ...platba('p2', '2026-09-20', 10000), zaMesic: '2026-10' }], zari);
  assert.equal(s.dluh, 0);
  assert.equal(s.tentoMesic, 10000, 'září nezaplaceno');
  assert.equal(s.preplatek, 10000, 'říjen předplacen');
  assert.deepEqual(s.budouci, { '2026-10': 10000 });
  const dopredu = { ...n, platiDopredu: true };
  // srpnová platba bez „za měsíc“ → za září, zářijová → za říjen
  const d = stavNajemnika(dopredu, [platba('p1', '2026-08-03', 10000), platba('p2', '2026-09-20', 10000)], '2026-10-15');
  assert.deepEqual(d.radky.map(r => r.zaplatil), [0, 10000, 10000]);
});

test('4: přeplatek', () => {
  const s = stavNajemnika(test1(), [platba('p1', '2026-10-05', 10000), platba('p2', '2026-10-10', 25000)], DNES);
  assert.equal(s.preplatek, 5000);
  assert.equal(s.dluh, 0);
  assert.equal(s.tentoMesic, 0);
  assert.equal(s.stav, 'preplatek');
  assert.ok(s.radky.every(r => r.stav === 'ok'));
});

test('6: změna nájmu od listopadu nemění říjen', () => {
  const n = test1();
  n.predpisy = zmenNajem(n.predpisy, '2026-11', 11000);
  const plat = [platba('p1', '2026-10-05', 30000)];
  const rijen = stavNajemnika(n, plat, DNES);
  assert.equal(rijen.mel, 30000);
  assert.equal(rijen.stav, 'ok');
  assert.equal(aktualniNajem(n, DNES), 10000);
  const listopad = stavNajemnika(n, plat, '2026-11-01');
  assert.equal(listopad.mel, 41000);
  assert.equal(listopad.dluh, 0);
  assert.equal(listopad.tentoMesic, 11000);
  assert.equal(aktualniNajem(n, '2026-11-01'), 11000);
});

test('6b: neuhrazený říjen přejde 1. 11. do dluhu', () => {
  const s = stavNajemnika(test1(), [platba('p1', '2026-09-05', 20000)], '2026-11-01');
  assert.equal(s.dluh, 10000);
  assert.equal(s.tentoMesic, 10000);
});

test('změna nájmu ve stejném měsíci přepíše předpis', () => {
  const p = zmenNajem(zmenNajem(test1().predpisy, '2026-11', 11000), '2026-11', 12000);
  assert.deepEqual(p.map(x => x.od), ['2026-08', '2026-11']);
  assert.equal(p[1].slozky[0].castka, 12000);
});

test('ukončený nájem: další předpisy nenaskakují', () => {
  const n = { ...test1(), konec: '2026-09' };
  const s = stavNajemnika(n, [], '2026-12-01');
  assert.equal(s.mel, 20000);
  assert.equal(s.dluh, 20000);
  assert.equal(s.tentoMesic, 0);
});

test('nájem začínající v budoucnu', () => {
  const n = { ...test1(), zacatek: '2026-12' };
  n.predpisy = [{ od: '2026-12', slozky: [{ nazev: 'Nájem', castka: 9000 }] }];
  const s = stavNajemnika(n, [], DNES);
  assert.equal(s.mel, 0);
  assert.equal(s.stav, 'ok');
  assert.equal(aktualniNajem(n, DNES), 9000);
});

test('platba před začátkem nájmu se započte do prvního měsíce', () => {
  const s = stavNajemnika(test1(), [platba('p1', '2026-07-28', 10000)], DNES);
  assert.equal(s.radky[0].zaplatil, 10000);
  assert.equal(s.radky[0].stav, 'ok');
});

test('souhrn: dlužníci nahoře, součty', () => {
  const a = { ...test1(), id: 'a', jmeno: 'Adam' };
  const b = { ...test1(), id: 'b', jmeno: 'Bára' };
  const plat = [{ id: 'x', najemnikId: 'a', datum: '2026-10-01', castka: 30000 }];
  const s = souhrn([a, b], plat, DNES);
  assert.deepEqual(s.radky.map(r => r.najemnik.jmeno), ['Bára', 'Adam']);
  assert.equal(s.dluhCelkem, 20000);
  assert.equal(s.dluzniku, 1);
  assert.equal(s.tentoMesicCelkem, 10000);
});

test('výzva k záloze', () => {
  assert.equal(potrebaZalohy(null, DNES, true), true);
  assert.equal(potrebaZalohy(null, DNES, false), false);
  assert.equal(potrebaZalohy('2026-10-01', DNES, true), false);
  assert.equal(potrebaZalohy('2026-10-31', '2026-11-01', true), true);
});

test('parsování částky', () => {
  assert.equal(parseCastka('12 500'), 12500);
  assert.equal(parseCastka('12 500 Kč'), 12500);
  assert.equal(parseCastka('8000,-'), 8000);
  assert.equal(parseCastka('12,50'), null);
  assert.equal(parseCastka('0'), null);
  assert.equal(parseCastka('-5'), null);
  assert.equal(parseCastka(''), null);
});

test('7: záloha tam a zpět, poškozená záloha se odmítne', () => {
  const n = [test1()];
  const p = [platba('p1', '2026-10-05', 10000)];
  const text = JSON.stringify(vytvorZalohu({ najemnici: n, platby: p }, '2026-11-01T10:00:00Z'));
  assert.deepEqual(nactiZalohu(text), { najemnici: n, platby: p, vydaje: [], upominky: [], nastaveni: {} });
  assert.throws(() => nactiZalohu('{"a":1}'), /není záloha/);
  assert.throws(() => nactiZalohu('nesmysl'), /není záloha/);
  const spatna = JSON.parse(text);
  spatna.platby[0].najemnikId = 'neexistuje';
  assert.throws(() => nactiZalohu(JSON.stringify(spatna)), /poškozenou platbu/);
});

test('návrh platby: za který měsíc a kolik', () => {
  const n = test1();
  // dluh za srpen → navrhne srpen, celý nájem
  assert.deepEqual(pick(navrhPlatby(n, [], DNES)), ['2026-08', 10000, false]);
  // srpen napůl → doplatek srpna
  assert.deepEqual(pick(navrhPlatby(n, [{ ...platba('p', '2026-09-01', 4000), zaMesic: '2026-08' }], DNES)), ['2026-08', 6000, true]);
  // bez dluhu: běžný měsíc; po částečné platbě doplatek (vč. výdaje v měsíci)
  const novy = { ...n, zacatek: '2026-10', predpisy: [{ od: '2026-10', slozky: [{ nazev: 'Nájem', castka: 10000 }] }] };
  assert.deepEqual(pick(navrhPlatby(novy, [], DNES)), ['2026-10', 10000, false]);
  assert.deepEqual(pick(navrhPlatby(novy, [platba('p', '2026-10-03', 4000)], DNES)), ['2026-10', 6000, true]);
  assert.equal(navrhPlatby(novy, [platba('p', '2026-10-03', 4000)], DNES, [{ datum: '2026-10-02', castka: 500 }]).castka, 6500);
  // říjen zaplacen → listopad (platba dopředu)
  assert.deepEqual(pick(navrhPlatby(novy, [platba('p', '2026-10-03', 10000)], DNES)), ['2026-11', 10000, false]);
  // nájemník „platí dopředu“ → příští měsíc
  assert.deepEqual(pick(navrhPlatby({ ...novy, platiDopredu: true }, [], DNES)), ['2026-11', 10000, false]);
  // uživatel vybral jiný měsíc
  assert.deepEqual(pick(navrhPlatby(novy, [platba('p', '2026-10-03', 4000)], DNES, [], '2026-12')), ['2026-12', 10000, false]);
});
const pick = x => [x.zaMesic, x.castka, x.doplatek];


test('za který měsíc platba je', () => {
  assert.equal(obdobiPlatby({ datum: '2026-09-25', zaMesic: '2026-10' }, {}), '2026-10');
  assert.equal(obdobiPlatby({ datum: '2026-09-25' }, {}), '2026-09');
  assert.equal(obdobiPlatby({ datum: '2026-12-25' }, { platiDopredu: true }), '2027-01');
});

test('úprava nájmu pro měsíc (sleva) a návrat ke standardu', () => {
  const n = test1();
  const upravy = nastavUpravu(n, '2026-09', null, 8000, 'sleva – oprava topení');
  assert.deepEqual(upravy, [{ mesic: '2026-09', castka: 8000, duvod: 'sleva – oprava topení' }]);
  const s = stavNajemnika({ ...n, upravy }, [], DNES);
  assert.equal(s.mel, 28000);
  assert.deepEqual(s.radky[1].uprava, { mesic: '2026-09', castka: 8000, duvod: 'sleva – oprava topení' });
  assert.equal(s.radky[1].najem, 8000);
  assert.equal(s.radky[0].uprava, null);
  // na více měsíců
  const vic = nastavUpravu(n, '2026-10', '2026-12', 9000, '');
  assert.deepEqual(vic.map(u => u.mesic), ['2026-10', '2026-11', '2026-12']);
  assert.equal(najemVMesici({ ...n, upravy: vic }, '2026-12'), 9000);
  assert.equal(najemVMesici({ ...n, upravy: vic }, '2027-01'), 10000, 'po období zase standard');
  // částka = standard → úprava se zruší; null → zrušit
  assert.deepEqual(nastavUpravu({ ...n, upravy }, '2026-09', null, 10000), []);
  assert.deepEqual(nastavUpravu({ ...n, upravy: vic }, '2026-11', null, null).map(u => u.mesic), ['2026-10', '2026-12']);
  // návrh platby počítá s upravenou částkou (budoucí měsíc)
  const novy = { ...n, zacatek: '2026-10', predpisy: [{ od: '2026-10', slozky: [{ nazev: 'Nájem', castka: 10000 }] }] };
  const p = navrhPlatby({ ...novy, upravy: nastavUpravu(novy, '2026-11', null, 7000) }, [platba('p', '2026-10-03', 10000)], DNES);
  assert.deepEqual([p.zaMesic, p.castka], ['2026-11', 7000]);
});
