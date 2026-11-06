// Automatické načtení z banky (Fio API): převod JSON na pohyby, klíče shodné s CSV (vymyšlená data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nactiFioJson, nactiFioCsv } from '../core/vypisy.js';
import { klicePohybu } from '../core/parovani.js';

const sloupec = (id, value) => ({ value, name: 'x', id });
const JSON_FIO = {
  accountStatement: {
    info: { accountId: '2200000001', bankId: '2010', currency: 'CZK' },
    transactionList: {
      transaction: [
        { column22: sloupec(22, 31000000001), column0: sloupec(0, '2026-11-05+0100'), column1: sloupec(1, 7500.0),
          column2: sloupec(2, '1234567890'), column3: sloupec(3, '3030'), column10: sloupec(10, 'Jan Testovací'),
          column5: sloupec(5, '001001'), column16: sloupec(16, 'najem listopad'), column8: sloupec(8, 'Bezhotovostní příjem') },
        { column22: sloupec(22, 31000000002), column0: sloupec(0, 1793833200000), column1: sloupec(1, -250.5),
          column2: null, column3: null, column10: null, column5: null, column16: null, column7: sloupec(7, 'poplatek') },
      ],
    },
  },
};

test('Fio JSON: účet, datum (text i ms), částka v haléřích, protiúčet, VS, zpráva, ID', () => {
  const v = nactiFioJson(JSON_FIO);
  assert.equal(v.banka, 'fio');
  assert.equal(v.ucet, '2200000001/2010');
  assert.deepEqual(v.pohyby[0], {
    datum: '2026-11-05', castkaHal: 750000, protiucet: '1234567890/3030', nazevProtiuctu: 'Jan Testovací',
    vs: '1001', ks: '', ss: '', zprava: 'najem listopad', typ: 'Bezhotovostní příjem', idBanky: '31000000001',
  });
  assert.equal(v.pohyby[1].datum, '2026-11-05');
  assert.equal(v.pohyby[1].castkaHal, -25050);
  assert.equal(v.pohyby[1].zprava, 'poplatek');
});

test('Fio JSON a CSV dají stejný klíč pohybu (duplicita se pozná)', () => {
  const csv = '"ID pohybu";"Datum";"Objem";"Měna";"Protiúčet";"Kód banky";"Zpráva pro příjemce";"Název protiúčtu";"VS"\r\n'
    + '"31000000001";"05.11.2026";"7500";"CZK";"1234567890";"3030";"najem listopad";"Jan Testovací";"1001"\r\n';
  const zCsv = nactiFioCsv(csv, 'Pohyby_na_uctu-2200000001_20261101-20261130.csv');
  const zJson = nactiFioJson(JSON_FIO);
  assert.equal(klicePohybu(zCsv.ucet, zCsv.pohyby)[0], klicePohybu(zJson.ucet, zJson.pohyby)[0]);
});

test('Fio JSON: neplatná odpověď', () => {
  assert.throws(() => nactiFioJson({}), /Fio API/);
});

// ---------- Služba najemnik-banka (Cloudflare Worker) s podvrženou bankou a úložištěm ----------
const kv = () => {
  const m = new Map();
  return { m, get: async (k, typ) => (m.has(k) ? (typ === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); } };
};
const prostredi = () => ({ DATA: kv(), KLIC_APLIKACE: 'tajny-klic-aplikace-123', FIO_TOKEN_1: 'TOKEN-FIO', POVOLENE_PUVODY: 'https://czcri.github.io' });
const dotaz = (cesta, { klic = 'tajny-klic-aplikace-123', metoda = 'GET', telo, puvod = 'https://czcri.github.io' } = {}) =>
  new Request(`https://banka.example${cesta}`, { method: metoda, headers: { 'X-Klic': klic, Origin: puvod, 'Content-Type': 'application/json' }, body: telo ? JSON.stringify(telo) : undefined });

async function sPodvrzenymFetch(odpoved, fn) {
  const puvodni = globalThis.fetch;
  const volani = [];
  globalThis.fetch = async (url, init) => { volani.push({ url: String(url), init }); return odpoved(String(url), init); };
  try { return await fn(volani); } finally { globalThis.fetch = puvodni; }
}
const fio = url => (url.includes('fioapi.fio.cz') ? new Response(JSON.stringify(JSON_FIO)) : new Response(null, { status: 201 }));

test('služba: stažení do fronty jen příchozích plateb, výdej aplikaci, odškrtnutí', async () => {
  const { stahni, obsluz } = await import('../banka/src/index.js');
  const env = prostredi();
  await sPodvrzenymFetch(fio, async volani => {
    assert.equal(await stahni(env, new Date('2026-11-06T06:00:00Z')), 1, 'odchozí poplatek se do fronty nedostane');
    assert.match(volani[0].url, /periods\/TOKEN-FIO\/2026-10-27\/2026-11-06\/transactions\.json$/);
  });
  const r = await obsluz(dotaz('/pohyby'), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://czcri.github.io');
  const { vypisy } = await r.json();
  assert.deepEqual(vypisy.map(v => [v.banka, v.ucet, v.pohyby.length]), [['fio', '2200000001/2010', 1]]);
  const stav = await (await obsluz(dotaz('/stav'), env)).json();
  assert.equal(stav.fronta, 1);
  assert.equal(stav.ucty[0].ucet, '2200000001/2010');
  assert.ok(stav.vapid.length > 80, 'veřejný klíč pro upozornění');
  assert.ok(!JSON.stringify(stav).includes('TOKEN-FIO'), 'token se nikam nevrací');

  const h = await (await obsluz(dotaz('/hotovo', { metoda: 'POST', telo: { klice: ['2200000001/2010|id|31000000001'] } }), env)).json();
  assert.equal(h.fronta, 0);
  await sPodvrzenymFetch(fio, async () => assert.equal(await stahni(env, new Date('2026-11-07T06:00:00Z')), 0, 'zpracovaný pohyb se znovu nestáhne'));
});

test('služba: bez klíče aplikace nic, cizí původ bez CORS, „Načíst teď“ nejvýš 1× za minutu', async () => {
  const { obsluz } = await import('../banka/src/index.js');
  const env = prostredi();
  assert.equal((await obsluz(dotaz('/pohyby', { klic: 'spatny' }), env)).status, 401);
  assert.equal((await obsluz(dotaz('/pohyby', { klic: '' }), env)).status, 401);
  assert.equal((await obsluz(dotaz('/pohyby', { puvod: 'https://zly.example' }), env)).headers.get('Access-Control-Allow-Origin'), null);
  await sPodvrzenymFetch(fio, async () => {
    assert.equal((await obsluz(dotaz('/nacist', { metoda: 'POST' }), env, new Date('2026-11-06T10:00:00Z'))).status, 200);
    assert.equal((await obsluz(dotaz('/nacist', { metoda: 'POST' }), env, new Date('2026-11-06T10:00:30Z'))).status, 429);
    assert.equal((await obsluz(dotaz('/nacist', { metoda: 'POST' }), env, new Date('2026-11-06T10:01:30Z'))).status, 200);
  });
});

test('služba: neplatný token Fio se ukáže jako chyba účtu, ne pád', async () => {
  const { stahni, obsluz } = await import('../banka/src/index.js');
  const env = prostredi();
  await sPodvrzenymFetch(() => new Response('', { status: 500 }), async () => assert.equal(await stahni(env), 0));
  const stav = await (await obsluz(dotaz('/stav'), env)).json();
  assert.match(stav.ucty[0].chyba, /token je neplatný nebo vypršel/);
});

test('služba: upozornění s podpisem VAPID, zaniklý odběr se smaže', async () => {
  const { obsluz } = await import('../banka/src/index.js');
  const { posliUpozorneni } = await import('../banka/src/push.js');
  const env = prostredi();
  await obsluz(dotaz('/odber', { metoda: 'POST', telo: { odber: { endpoint: 'https://push.example/zivy' } } }), env);
  await obsluz(dotaz('/odber', { metoda: 'POST', telo: { odber: { endpoint: 'https://push.example/mrtvy' } } }), env);
  await sPodvrzenymFetch(url => new Response(null, { status: url.endsWith('mrtvy') ? 410 : 201 }), async volani => {
    assert.equal(await posliUpozorneni(env), 1);
    assert.match(volani[0].init.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  });
  assert.deepEqual(JSON.parse(env.DATA.m.get('odbery')).map(o => o.endpoint), ['https://push.example/zivy']);
});
