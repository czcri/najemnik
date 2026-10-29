// Dluhy „za měsíc“ a „v měsíci“ (záložky v Dlužnících).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dluhyZaMesic, dluhyVMesici } from '../core/dluhy.js';

const najem = (id, castka = 20000) => ({
  id, jmeno: id, oznaceni: 'Byt', zacatek: '2026-08', konec: null,
  predpisy: [{ od: '2026-08', slozky: [{ nazev: 'Nájem', castka }] }],
});
const platba = (najemnikId, datum, castka, zaMesic) => ({ id: najemnikId + datum + castka, najemnikId, datum, castka, ...(zaMesic ? { zaMesic } : {}) });
const DNES = '2026-11-15';

test('v měsíci: nájem 20 000, v září přišlo 18 000 → dluh 2 000', () => {
  const r = dluhyVMesici([najem('A')], [platba('A', '2026-09-10', 18000)], [], DNES, '2026-09');
  assert.deepEqual(r.map(x => [x.najemnik.id, x.dluh, x.prijato]), [['A', 2000, 18000]]);
});

test('v měsíci: platba dopředu (v září 40 000 za září i říjen) → dluh ani v září, ani v říjnu', () => {
  const p = [platba('A', '2026-09-05', 20000, '2026-09'), platba('A', '2026-09-05', 20000, '2026-10')];
  assert.deepEqual(dluhyVMesici([najem('A')], p, [], DNES, '2026-09'), []);
  assert.deepEqual(dluhyVMesici([najem('A')], p, [], DNES, '2026-10'), []);
  // jedna platba 40 000 (i bez určení měsíce), nájem od září → přebytek kryje říjen
  const odZari = { ...najem('A'), zacatek: '2026-09' };
  const jedna = [platba('A', '2026-09-05', 40000)];
  assert.deepEqual(dluhyVMesici([odZari], jedna, [], DNES, '2026-09'), []);
  assert.deepEqual(dluhyVMesici([odZari], jedna, [], DNES, '2026-10'), []);
  // v listopadu už přebytek není → dluh v listopadu (běží)
  assert.equal(dluhyVMesici([odZari], jedna, [], DNES, '2026-11')[0].dluh, 20000);
  // srpen nezaplacen, v září 40 000 bez určení → doplatí srpen + září; říjen tím předplacený NENÍ
  assert.equal(dluhyVMesici([najem('A')], jedna, [], DNES, '2026-10')[0].dluh, 20000);
  // nedoplatek ze září se do října nepřenáší
  assert.equal(dluhyVMesici([najem('A')], [platba('A', '2026-09-05', 15000), platba('A', '2026-10-05', 20000)], [], DNES, '2026-10').length, 0);
});

test('v měsíci: pozdní doplatek staršího měsíce se počítá do měsíce, kdy přišel', () => {
  const p = [platba('A', '2026-10-03', 20000, '2026-10'), platba('A', '2026-10-20', 5000, '2026-08')];
  assert.deepEqual(dluhyVMesici([najem('A')], p, [], DNES, '2026-10'), []);
  assert.equal(dluhyVMesici([najem('A')], [platba('A', '2026-10-20', 5000, '2026-08')], [], DNES, '2026-10')[0].dluh, 15000);
});

test('za měsíc: jen kdo k dnešku stále dluží; pozdě vyrovnaný se neukazuje', () => {
  const p = [
    platba('A', '2026-08-05', 20000, '2026-08'),
    platba('B', '2026-08-05', 15000, '2026-08'),
    platba('B', '2026-10-01', 5000, '2026-08'),   // B doplatil srpen pozdě → vyrovnáno
    platba('C', '2026-08-05', 12000, '2026-08'),  // C dluží 8 000
  ];
  const r = dluhyZaMesic([najem('A'), najem('B'), najem('C')], p, [], DNES, '2026-08');
  assert.deepEqual(r.map(x => [x.najemnik.id, x.chybi, x.zaplaceno]), [['C', 8000, 12000]]);
});

test('výdaj a sleva v měsíci se promítnou', () => {
  const n = { ...najem('A'), upravy: [{ mesic: '2026-09', castka: 15000, duvod: 'sleva' }] };
  const v = [{ najemnikId: 'A', datum: '2026-09-02', castka: 1000 }];
  assert.equal(dluhyVMesici([n], [platba('A', '2026-09-10', 15000)], v, DNES, '2026-09')[0].dluh, 1000);
  assert.equal(dluhyZaMesic([n], [], v, DNES, '2026-09')[0].chybi, 16000);
});
