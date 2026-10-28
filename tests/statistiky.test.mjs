// Jednorázové výdaje, záloha v2 a statistiky (spec. kap. 12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stavNajemnika, souhrn, vytvorZalohu, nactiZalohu } from '../core/logika.js';
import { statistiky, zpusobPlatby, posledniDen } from '../core/statistiky.js';

const najem = (id, castka, o = {}) => ({
  id, jmeno: id, oznaceni: 'Byt', zacatek: '2026-10', konec: null,
  predpisy: [{ od: '2026-10', slozky: [{ nazev: 'Nájem', castka }] }], zpusobPlaceni: 'ucet', ...o,
});
const platba = (najemnikId, datum, castka, typ) => ({ id: `${najemnikId}${datum}${castka}`, najemnikId, datum, castka, zdroj: typ ? { typ } : undefined });

test('počáteční dluh jako výdaj zvýší dluh po splatnosti hned v prvním měsíci? ne – je splatný s měsícem', () => {
  const n = najem('a', 10000);
  const vydaj = { id: 'v', najemnikId: 'a', datum: '2026-10-01', castka: 5000, popis: 'Počáteční dluh' };
  const rijen = stavNajemnika(n, [], '2026-10-20', [vydaj]);
  assert.equal(rijen.mel, 15000);
  assert.equal(rijen.tentoMesic, 15000);
  assert.equal(rijen.dluh, 0);
  assert.equal(rijen.radky[0].vydaj, 5000);
  const listopad = stavNajemnika(n, [], '2026-11-02', [vydaj]);
  assert.equal(listopad.dluh, 15000);
});

test('výdaj s budoucím datem se zatím nepočítá; výdaj před začátkem jde do 1. měsíce', () => {
  const n = najem('a', 10000);
  assert.equal(stavNajemnika(n, [], '2026-10-20', [{ datum: '2026-12-01', castka: 999 }]).mel, 10000);
  assert.equal(stavNajemnika(n, [], '2026-10-20', [{ datum: '2026-05-01', castka: 3000 }]).radky[0].vydaj, 3000);
});

test('souhrn počítá i výdaje', () => {
  const s = souhrn([najem('a', 10000)], [], '2026-11-05', [{ najemnikId: 'a', datum: '2026-10-10', castka: 2500 }]);
  assert.equal(s.dluhCelkem, 12500);
});

test('záloha v2 tam a zpět; záloha v1 z pilotu se načte', () => {
  const data = {
    najemnici: [najem('a', 10000)], platby: [platba('a', '2026-10-05', 10000, 'hotove')],
    vydaje: [{ id: 'v', najemnikId: 'a', datum: '2026-10-01', castka: 500, popis: 'x' }],
    upominky: [{ id: 'u', najemnikId: 'a', datum: '2026-10-20', kanal: 'sms', text: 'Dobrý den' }],
    nastaveni: { sablony: [{ id: 's', nazev: 'A', text: 'B' }] },
  };
  assert.deepEqual(nactiZalohu(JSON.stringify(vytvorZalohu(data, 'x'))), data);
  const v1 = { aplikace: 'najemnik', verze: 1, najemnici: data.najemnici, platby: data.platby };
  assert.deepEqual(nactiZalohu(JSON.stringify(v1)), { ...data, vydaje: [], upominky: [], nastaveni: {} });
});

test('způsob platby podle zdroje, jinak podle nájemníka', () => {
  assert.equal(zpusobPlatby({ zdroj: { typ: 'vypis' } }), 'ucet');
  assert.equal(zpusobPlatby({ zdroj: { typ: 'prevod' } }), 'ucet');
  assert.equal(zpusobPlatby({ zdroj: { typ: 'hotove' } }), 'hotove');
  assert.equal(zpusobPlatby({}, { zpusobPlaceni: 'hotove' }), 'hotove');
  assert.equal(zpusobPlatby({}, {}), 'ucet');
  assert.equal(posledniDen('2026-02'), '2026-02-28');
  assert.equal(posledniDen('2028-02'), '2028-02-29');
});

const DATA = {
  najemnici: [
    najem('ucetni', 10000),
    najem('hotovostni', 8000, { zpusobPlaceni: 'hotove', oznaceni: 'Dům' }),
  ],
  platby: [
    platba('ucetni', '2026-10-05', 10000, 'vypis'),
    { ...platba('ucetni', '2026-12-10', 10000, 'prevod'), zaMesic: '2026-11' }, // za listopad pozdě
    platba('hotovostni', '2026-10-03', 8000, 'hotove'),
    platba('hotovostni', '2026-11-02', 5000, 'vypis'),       // hotovostní nájemník poslal převod
  ],
  vydaje: [],
};

test('statistiky: příjmy po měsících, účet vs. hotově, očekáváno, dluh, dochvilnost', () => {
  const s = statistiky(DATA, '2026-10', '2026-12', '2026-12-15');
  assert.deepEqual(s.mesice.map(m => [m.mesic, m.ucet, m.hotove, m.ocekavano]), [
    ['2026-10', 10000, 8000, 18000],
    ['2026-11', 5000, 0, 18000],
    ['2026-12', 10000, 0, 18000],
  ]);
  assert.equal(s.prijato, 33000);
  assert.equal(s.prijatoHotove, 8000);
  assert.equal(s.ocekavano, 54000);
  // dluh na konci listopadu: účetní 10 000 (zaplatil až v prosinci), hotovostní 3 000;
  // prosinec ještě běží → jen dluh po splatnosti k dnešku (hotovostní 3 000)
  assert.deepEqual(s.mesice.map(m => m.dluh), [0, 13000, 3000]);
  // říjen: oba včas; listopad: účetní pozdě (doplatil v prosinci), hotovostní vůbec (chybí 3 000)
  assert.deepEqual(s.mesice.map(m => [m.vcas, m.pozde, m.vubec]), [[2, 0, 0], [0, 1, 1], [0, 0, 0]]);
  // aktuální dluh po splatnosti (prosinec ještě běží): hotovostní 3 000
  assert.equal(s.dluh, 3000);
  // úspěšnost podle „za měsíc“: říjen 18 000 + listopad 15 000 (pozdní platba za listopad) z 54 000
  assert.equal(Math.round(s.uspesnost * 100), 61);
  assert.deepEqual(s.mesice.map(m => m.pokryto), [18000, 15000, 0]);
});

test('statistiky: filtr Hotově a filtr nemovitosti', () => {
  const h = statistiky(DATA, '2026-10', '2026-12', '2026-12-15', { zpusob: 'hotove' });
  assert.equal(h.prijato, 8000, 'jen hotovostní platby');
  assert.equal(h.ocekavano, 24000, 'jen nájemníci platící hotově');
  const u = statistiky(DATA, '2026-10', '2026-12', '2026-12-15', { zpusob: 'ucet' });
  assert.equal(u.prijato, 25000, 'převod hotovostního nájemníka je na účet');
  assert.ok(u.podleNajemniku.some(r => r.najemnik.id === 'hotovostni' && r.prijato === 5000));
  const dum = statistiky(DATA, '2026-10', '2026-12', '2026-12-15', { oznaceni: 'Dům' });
  assert.equal(dum.prijato, 13000);
  assert.deepEqual(dum.podleNajemniku.map(r => r.najemnik.id), ['hotovostni']);
});

test('statistiky: období v budoucnu se ořízne na aktuální měsíc', () => {
  assert.equal(statistiky(DATA, '2026-10', '2027-06', '2026-11-01').mesice.length, 2);
});
