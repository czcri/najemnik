// Čtečky výpisů na VYMYŠLENÝCH datech ve formátu skutečných výpisů (skutečné vzory jsou jen lokálně).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dekoduj, parseCsv, castkaNaHalere, datumZCz, normalizujUcet, nactiCsvVypis, nactiKbPdf, jePdf,
} from '../core/vypisy.js';

const utf8sBom = text => new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]);
function utf16le(text) {
  const b = new Uint8Array(2 + text.length * 2);
  b[0] = 0xff; b[1] = 0xfe;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); b[2 + 2 * i] = c & 0xff; b[3 + 2 * i] = c >> 8; }
  return b;
}

test('pomocné převody', () => {
  assert.equal(castkaNaHalere('-11411,77'), -1141177);
  assert.equal(castkaNaHalere('110 000,00'), 11000000);
  assert.equal(castkaNaHalere('11 086.09'), 1108609);
  assert.equal(castkaNaHalere('11093'), 1109300);
  assert.throws(() => castkaNaHalere('abc'));
  assert.equal(datumZCz('29.09.2026'), '2026-09-29');
  assert.equal(normalizujUcet('0-3055466143', '0800'), '3055466143/0800');
  assert.equal(normalizujUcet('000131-0001018560297/100'), '131-1018560297/0100');
  assert.equal(normalizujUcet('2705556016', '3030'), '2705556016/3030');
  assert.equal(normalizujUcet('NĚJAKÁ FIRMA S.R.O.'), '');
  assert.equal(normalizujUcet(''), '');
});

test('CSV s uvozovkami, středníky v hodnotě a CRLF', () => {
  assert.deepEqual(parseCsv('"a";"b ""x""; y"\r\n"1";""\r\n'), [['a', 'b "x"; y'], ['1', '']]);
});

test('kódování: UTF-8 s BOM a UTF-16 LE', () => {
  assert.equal(dekoduj(utf8sBom('Příjem')), 'Příjem');
  assert.equal(dekoduj(utf16le('Částka')), 'Částka');
  assert.equal(jePdf(new TextEncoder().encode('%PDF-1.6')), true);
});

const FIO = `"Datum";"Objem";"Měna";"Protiúčet";"Kód banky";"Zpráva pro příjemce";"Poznámka";"Typ";"Název banky";"Název protiúčtu";"Reference plátce";"KS";"VS";"SS";"VS"
"01.10.2026";"12000";"CZK";"1234567890";"3030";"najem rijen";"Jan Testovací";"Bezhotovostní příjem";"Air Bank a.s.";"Jan Testovací";"";"";"1001";"";"1001"
"02.10.2026";"-500,50";"CZK";"111222333";"2010";"";"";"Platba převodem uvnitř banky";"Fio banka, a.s.";"Elektřina";"";"";"";"";""
"31.10.2026";"0,35";"CZK";"";"";"";"";"Připsaný úrok";"";"";"";"";"";"";""
`;

test('Fio CSV', () => {
  const v = nactiCsvVypis(utf8sBom(FIO), 'Pohyby_na_uctu-2200000001_20261001-20261031.csv');
  assert.equal(v.banka, 'fio');
  assert.equal(v.ucet, '2200000001/2010');
  assert.equal(v.pohyby.length, 3);
  assert.deepEqual(v.pohyby[0], {
    datum: '2026-10-01', castkaHal: 1200000, protiucet: '1234567890/3030', nazevProtiuctu: 'Jan Testovací',
    vs: '1001', ks: '', ss: '', zprava: 'najem rijen', typ: 'Bezhotovostní příjem', idBanky: '',
  });
  assert.equal(v.pohyby[1].castkaHal, -50050);
  // přejmenovaný soubor → účet neznámý, doplní uživatel
  assert.equal(nactiCsvVypis(utf8sBom(FIO), 'vypis.csv').ucet, '');
});

const CS = `"Datum zaúčtování";"Název protiúčtu";"IBAN";"BIC";"Protiúčet";"Bankovní kód protiúčtu";"Částka";"Měna";"Variabilní symbol";"Typ transakce";"Zpráva pro mě";"Zpráva pro příjemce";"Adresa příjemce";"Název účtu vlastníka";"Číslo účtu vlastníka"
"05.10.2026";"Eva Zkušební";"CZ00";"GIBACZPX";"987654321/0800";"0800";"15 500,00";"CZK";"0002002";"Příchozí úhrada";"";"Nájem 10/2026";"";"Pracovni";"3000000001/0800"
"06.10.2026";"Obchod";"CZ00";"GIBACZPX";"13488172/0800";"0800";"-4 366,00";"CZK";"";"Tuzemská odchozí úhrada";"";"";"";"Pracovni";"3000000001/0800"
`;

test('Česká spořitelna CSV (UTF-16)', () => {
  const v = nactiCsvVypis(utf16le(CS), 'x.csv');
  assert.equal(v.banka, 'cs');
  assert.equal(v.ucet, '3000000001/0800');
  assert.equal(v.pohyby[0].castkaHal, 1550000);
  assert.equal(v.pohyby[0].vs, '2002');
  assert.equal(v.pohyby[0].protiucet, '987654321/0800');
  assert.equal(v.pohyby[0].zprava, 'Nájem 10/2026');
  assert.equal(v.pohyby[1].castkaHal, -436600);
});

test('neznámý formát', () => {
  assert.throws(() => nactiCsvVypis(utf8sBom('"a";"b"\n"1";"2"'), 'x.csv'), /Neznámý formát/);
});

// KB PDF – textové položky s pozicemi jako z pdf.js (rozložení podle skutečného výpisu).
const t = (x, y, str) => ({ x, y, str });
const KB_STRANKA_1 = [
  t(194, 790, 'k účtu:'), t(231, 790, '0000000131-1000000001/0100'),
  t(48, 575, 'POČÁTEČNÍ ZŮSTATEK'), t(526, 575, '10 000,00'),
  t(48, 557, 'Datum'), t(101, 557, 'Popis transakce'), t(268, 557, 'Název protiúčtu / Číslo a typ karty'), t(451, 557, 'VS'), t(530, 557, 'Připsáno'),
  t(48, 548, 'zúčtování'), t(101, 548, 'Identifikace transakce'), t(268, 548, 'Protiúčet a kód banky / Obchodní místo'), t(451, 548, 'KS'), t(524, 548, 'Odepsáno'),
  t(48, 538, 'Datum'), t(451, 538, 'SS'),
  t(48, 529, 'transakce'),
  // příchozí se jménem, VS a zprávou na dvou řádcích
  t(48, 482, '04.10.2026'), t(101, 482, 'PŘÍCHOZÍ ÚHRADA'), t(268, 482, 'NOVÁK TESTOVACÍ'), t(426, 482, '20250003'), t(521, 482, '20 000,00'),
  t(101, 472, '202610046403251946'), t(268, 472, '888111343/5500'), t(448, 472, '308'),
  t(101, 464, '361-04102026 1086 086148 311485'),
  t(101, 455, 'Zpráva pro příjemce:'),
  t(101, 446, 'Nájem říjen'),
  t(101, 437, 'byt 2'),
  // příchozí s datem transakce na 2. řádku
  t(48, 422, '05.10.2026'), t(101, 422, 'PŘÍCHOZÍ ÚHRADA'), t(268, 422, 'Firma a.s'), t(417, 422, '6844653517'), t(521, 422, '1 940 000,00'),
  t(101, 413, '120-20261005 RD36UAE8SFF'),
  t(48, 412, '04.10.2026'), t(268, 412, '5345918389/0800'),
  // okamžitá odchozí: místo názvu rovnou účet
  t(48, 389, '06.10.2026'), t(101, 389, 'OKAMŽITÁ ODCHOZÍ ÚHRADA'), t(268, 389, '342187194/0300'), t(430, 389, '2026030'), t(523, 389, '-90 000,00'),
  t(101, 380, 'IU000GKQ56M'),
  t(101, 371, 'Popis pro mě:'),
  t(101, 362, 'soukromá poznámka'),
  t(487, 146, 'Pokračování na další straně'),
];
const KB_STRANKA_2 = [
  t(194, 790, 'k účtu:'), t(231, 790, '131-1000000001/0100'),
  t(48, 557, 'Datum'), t(101, 557, 'Popis transakce'), t(268, 557, 'Název protiúčtu / Číslo a typ karty'), t(451, 557, 'VS'), t(530, 557, 'Připsáno'),
  t(48, 548, 'zúčtování'), t(101, 548, 'Identifikace transakce'),
  t(48, 437, '30.10.2026'), t(101, 437, 'PŘÍCHOZÍ ÚHRADA'), t(268, 437, 'Testová, Jana'), t(526, 437, '9 000,00'),
  t(101, 428, '2026092940962781576'), t(268, 428, '2503090086/2010'),
  t(48, 367, 'KONEČNÝ ZŮSTATEK'), t(526, 367, '1 889 000,00'),
  t(48, 216, '01.10.2026'), t(176, 216, '87 349,74'), t(223, 216, '15.10.2026'), t(530, 216, '3 467,05'),
];

test('KB PDF', () => {
  const v = nactiKbPdf([KB_STRANKA_1, KB_STRANKA_2]);
  assert.equal(v.banka, 'kb');
  assert.equal(v.ucet, '131-1000000001/0100');
  assert.equal(v.pohyby.length, 4, 'souhrnná tabulka za konečným zůstatkem se nečte');
  const [a, b, c, d] = v.pohyby;
  assert.deepEqual(a, {
    datum: '2026-10-04', castkaHal: 2000000, protiucet: '888111343/5500', nazevProtiuctu: 'NOVÁK TESTOVACÍ',
    vs: '20250003', ks: '308', ss: '', zprava: 'Nájem říjen byt 2', typ: 'PŘÍCHOZÍ ÚHRADA',
    idBanky: '202610046403251946 361-04102026 1086 086148 311485',
  });
  assert.equal(b.datum, '2026-10-05', 'datum zúčtování, ne datum transakce');
  assert.equal(b.castkaHal, 194000000);
  assert.equal(b.protiucet, '5345918389/0800');
  assert.equal(c.castkaHal, -9000000);
  assert.equal(c.protiucet, '342187194/0300');
  assert.equal(c.nazevProtiuctu, '');
  assert.equal(c.zprava, '', 'popis pro mě není zpráva');
  assert.equal(d.nazevProtiuctu, 'Testová, Jana');
  assert.equal(d.protiucet, '2503090086/2010');
  // součet sedí na zůstatky
  assert.equal(1000000 + v.pohyby.reduce((s, p) => s + p.castkaHal, 0), 188900000);
});

test('KB PDF bez čísla účtu', () => {
  assert.throws(() => nactiKbPdf([[t(48, 557, 'Datum')]]), /číslo účtu/);
});
