// Akceptační scénáře ze specifikace (kap. 8) + okrajové případy. Spuštění: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stavNajemnika, souhrn, zmenNajem, aktualniNajem, potrebaZalohy, parseCastka,
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

test('2: platba 10 000', () => {
  const s = stavNajemnika(test1(), [platba('p1', '2026-10-05', 10000)], DNES);
  assert.equal(s.dluh, 10000);
  assert.equal(s.tentoMesic, 10000);
  assert.deepEqual(stavy(s), ['2026-08:ok', '2026-09:dluh', '2026-10:bezi']);
});

test('3: pozdní doplatek srovná starší měsíce', () => {
  const s = stavNajemnika(test1(), [platba('p1', '2026-10-05', 10000), platba('p2', '2026-10-10', 15000)], DNES);
  assert.equal(s.dluh, 0);
  assert.equal(s.tentoMesic, 5000);
  assert.equal(s.stav, 'bezi');
  assert.deepEqual(stavy(s), ['2026-08:ok', '2026-09:ok', '2026-10:bezi']);
  assert.equal(s.radky[2].chybi, 5000);
  // průběžný rozdíl podle data plateb
  assert.deepEqual(s.radky.map(r => r.prubeznyRozdil), [10000, 20000, 5000]);
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
