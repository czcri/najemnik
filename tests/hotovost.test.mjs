// Seznam hotovosti / plateb na účet za aktuální měsíc (spec. kap. 13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seznamMesice, odkazKalendare, icsHotovosti } from '../core/hotovost.js';

const najem = (id, castka, o = {}) => ({
  id, jmeno: id, oznaceni: 'Byt', zacatek: '2026-08', konec: null,
  predpisy: [{ od: '2026-08', slozky: [{ nazev: 'Nájem', castka }] }], zpusobPlaceni: 'hotove', ...o,
});
const platba = (najemnikId, datum, castka) => ({ id: najemnikId + datum, najemnikId, datum, castka });
const N = [
  najem('Bára', 8000, { denHotovosti: 15 }),
  najem('Adam', 10000, { denHotovosti: 5 }),
  najem('Cyril', 9000),                                   // bez dne → na konec
  najem('Dana', 7000, { denHotovosti: 31 }),              // 31. v listopadu → 30.
  najem('Účetní', 12000, { zpusobPlaceni: 'ucet', denHotovosti: 1 }),
  najem('Konec', 5000, { konec: '2026-09' }),             // ukončený nájem
];

test('jen hotovostní nájemníci, řazeno podle dne, bez dne na konci', () => {
  const s = seznamMesice(N, [], [], '2026-11-10', 'hotove');
  assert.deepEqual(s.polozky.map(p => p.najemnik.id), ['Adam', 'Bára', 'Dana', 'Cyril']);
  assert.equal(s.polozky.find(p => p.najemnik.id === 'Dana').ocekavano, '2026-11-30');
  assert.equal(s.polozky[0].poTerminu, true);
  assert.equal(s.polozky[1].poTerminu, false);
  assert.equal(s.celkem, 4);
});

test('tři stavy: částečně zůstává, zaplaceno zmizí; platba převodem se také počítá', () => {
  const s = seznamMesice(N, [platba('Adam', '2026-11-05', 10000), platba('Bára', '2026-11-02', 3000)], [], '2026-11-10', 'hotove');
  assert.deepEqual(s.polozky.map(p => [p.najemnik.id, p.stav, p.chybi]), [
    ['Bára', 'castecne', 5000], ['Dana', 'nezaplaceno', 7000], ['Cyril', 'nezaplaceno', 9000],
  ]);
  assert.equal(s.zaplaceno, 1);
  assert.equal(s.prevzato, 13000);
});

test('1. dne nového měsíce je seznam zase plný; starší dluh se neřeší', () => {
  const platby = [platba('Adam', '2026-11-05', 10000)];
  assert.equal(seznamMesice(N, platby, [], '2026-11-30', 'hotove').polozky.some(p => p.najemnik.id === 'Adam'), false);
  const prosinec = seznamMesice(N, platby, [], '2026-12-01', 'hotove');
  assert.equal(prosinec.polozky.find(p => p.najemnik.id === 'Adam').chybi, 10000, 'jen nájem prosince, ne říjnový dluh');
});

test('výdaj v měsíci navýší částku; den hotovosti dnes', () => {
  const s = seznamMesice(N, [], [{ najemnikId: 'Adam', datum: '2026-11-03', castka: 500 }], '2026-11-05', 'hotove');
  const adam = s.polozky.find(p => p.najemnik.id === 'Adam');
  assert.equal(adam.chybi, 10500);
  assert.equal(adam.dnes, true);
  assert.equal(adam.poTerminu, false);
});

test('platí dopředu: v listopadu se čeká platba za prosinec; zářijová platba „za říjen“ se počítá za říjen', () => {
  const dopredu = { ...N[1], platiDopredu: true };
  const s = seznamMesice([dopredu], [], [], '2026-11-10', 'hotove');
  assert.equal(s.polozky[0].zaMesic, '2026-12');
  const zaplaceno = seznamMesice([dopredu], [{ ...platba('Adam', '2026-11-04', 10000), zaMesic: '2026-12' }], [], '2026-11-10', 'hotove');
  assert.equal(zaplaceno.polozky.length, 0);
  // běžný nájemník: platba v říjnu „za listopad“ se do listopadu počítá
  const s2 = seznamMesice([N[1]], [{ ...platba('Adam', '2026-10-28', 10000), zaMesic: '2026-11' }], [], '2026-11-10', 'hotove');
  assert.equal(s2.polozky.length, 0);
});

test('strana Na účet', () => {
  assert.deepEqual(seznamMesice(N, [], [], '2026-11-10', 'ucet').polozky.map(p => p.najemnik.id), ['Účetní']);
});

test('kalendář: odkaz s opakováním a soubor .ics', () => {
  const odkaz = odkazKalendare(N[1], 10000, '2026-11-05');
  assert.match(odkaz, /recur=RRULE%3AFREQ%3DMONTHLY%3BBYMONTHDAY%3D5/);
  assert.match(odkaz, /dates=20261105%2F20261106/);
  const ics = icsHotovosti([{ najemnik: N[1], castka: 10000 }, { najemnik: N[2], castka: 9000 }], '2026-11-01', '20261101T000000Z');
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 1, 'nájemník bez dne se přeskočí');
  assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=5/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261105/);
});

test('revize: seznam Hotovost počítá i přebytek z dřívějška (shoda s návrhem platby)', () => {
  const n = { ...najem('X', 10000), zacatek: '2026-09' };
  const s = seznamMesice([n], [{ ...platba('X', '2026-09-05', 15000), zaMesic: '2026-09' }], [], '2026-10-10', 'hotove');
  assert.equal(s.polozky[0].chybi, 5000);
});
