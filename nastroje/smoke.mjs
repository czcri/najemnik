// Kouřový test v opravdovém Chrome (headless, přes DevTools protokol, bez závislostí).
// Projde scénáře ze specifikace kliknutím ve formulářích a uloží snímky obrazovky.
// Spuštění: node nastroje/smoke.mjs [složka-pro-snímky]
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOREN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const SNIMKY = process.argv[2] ?? path.join(tmpdir(), 'najemnik-smoke');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPY = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  const cesta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const soubor = path.join(KOREN, cesta.endsWith('/') ? cesta + 'index.html' : cesta);
  try {
    res.writeHead(200, { 'content-type': TYPY[path.extname(soubor)] ?? 'application/octet-stream' });
    res.end(await readFile(soubor));
  } catch { res.writeHead(404).end(); }
}).listen(0);
const URL_APP = `http://localhost:${server.address().port}/`;

const profil = await mkdtemp(path.join(tmpdir(), 'najemnik-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profil}`, '--no-first-run', 'about:blank']);
const wsUrl = await new Promise((ok, chyba) => {
  chrome.stderr.on('data', d => { const m = String(d).match(/ws:\/\/\S+/); if (m) ok(m[0]); });
  setTimeout(() => chyba(new Error('Chrome nenastartoval')), 15000);
});
const port = new URL(wsUrl).port;
const cil = (await (await fetch(`http://localhost:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(cil.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok));

let id = 0;
const cekajici = new Map();
const chyby = [];
ws.addEventListener('message', e => {
  const z = JSON.parse(e.data);
  if (z.id && cekajici.has(z.id)) { cekajici.get(z.id)(z); cekajici.delete(z.id); }
  if (z.method === 'Runtime.exceptionThrown') chyby.push(z.params.exceptionDetails.exception?.description ?? z.params.exceptionDetails.text);
  if (z.method === 'Runtime.consoleAPICalled' && z.params.type === 'error') chyby.push(z.params.args.map(a => a.value ?? a.description).join(' '));
});
const cdp = (method, params = {}) => new Promise((ok, chyba) => {
  const i = ++id;
  cekajici.set(i, z => (z.error ? chyba(new Error(`${method}: ${z.error.message}`)) : ok(z.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const pockej = ms => new Promise(ok => setTimeout(ok, ms));
async function js(vyraz) {
  const r = await cdp('Runtime.evaluate', { expression: vyraz, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${vyraz}\n${r.exceptionDetails.exception?.description}`);
  return r.result.value;
}
const text = () => js('document.getElementById("app").innerText');
async function jdi(hash) { await js(`location.hash = ${JSON.stringify(hash)}`); await pockej(150); }
async function vypln(pole) {
  await js(`(() => { const f = document.querySelector('form');
    for (const [k, v] of Object.entries(${JSON.stringify(pole)})) f.elements[k].value = v;
    f.requestSubmit(); })()`);
  await pockej(300);
}
let cislo = 0;
async function snimek(nazev) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(SNIMKY, `${String(++cislo).padStart(2, '0')}-${nazev}.png`), Buffer.from(data, 'base64'));
}
let selhani = 0;
function over(podminka, popis) {
  console.log(`${podminka ? '✔' : '✖'} ${popis}`);
  if (!podminka) selhani++;
}

try {
  await mkdir(SNIMKY, { recursive: true });
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 2, mobile: true });
  // Pevné „dnes“ = 15. 10. 2026 jako ve specifikaci.
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `{
    const D = Date, T = new D(2026, 9, 15, 12).getTime();
    globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } };
  }` });
  await cdp('Page.navigate', { url: URL_APP });
  await pockej(800);
  over((await text()).includes('Zatím žádní nájemníci'), 'prázdný přehled');
  await snimek('prazdny-prehled');

  await jdi('#/n/novy');
  await vypln({ jmeno: 'Test', oznaceni: 'Byt 1', zacatek: '2026-08', castka: '10 000' });
  let t = await text();
  over(/30\s000/.test(t) && /Dluh po splatnosti\s20\s000/.test(t) && /tento měsíc\s10\s000/.test(t), '1: dluh 20 000 + tento měsíc 10 000');
  const nid = await js('location.hash.split("/")[2]');

  await jdi(`#/n/${nid}/platba`);
  over((await js('document.querySelector("form").elements.castka.value')) === '10000', 'částka platby předvyplněna nájmem');
  await vypln({ datum: '2026-10-05', castka: '10000', zpusob: 'hotove', poznamka: 'za říjen' });
  await jdi(`#/n/${nid}/platba`);
  await vypln({ datum: '2026-10-10', castka: '15000', zpusob: 'prevod' });
  t = await text();
  over(t.includes('Tento měsíc ještě chybí') && /5\s000/.test(t) && !t.includes('Dluh po splatnosti'), '3: dluh 0, tento měsíc chybí 5 000');
  over(t.includes('Hotově') && t.includes('Převod – ručně'), 'zdroj platby u plateb');
  await snimek('detail-platby');

  await jdi(`#/n/${nid}/mesice`);
  t = await text();
  over(t.includes('chybí 5') && t.includes('srpen 2026'), 'záložka Měsíce');
  await snimek('detail-mesice');

  const pid = await js(`(() => { const a = [...document.querySelectorAll('a')].find(x => x.href.includes('#/p/')); return a ? a.hash.slice(4) : ''; })()`);
  await jdi(`#/n/${nid}`);
  const druha = await js(`[...document.querySelectorAll('.platby a')].find(a => a.innerText.includes('15'))?.hash.slice(4)`);
  await jdi(`#/p/${druha}`);
  await vypln({ castka: '25000' });
  t = await text();
  over(t.includes('Přeplatek') && /5\s000/.test(t), '4: přeplatek 5 000');

  await jdi(`#/n/${nid}/najem`);
  await vypln({ od: '2026-11', castka: '11000' });
  t = await text();
  over(/Nájem 10\s000/.test(t), '6: říjen pořád 10 000');

  await jdi(`#/n/novy`);
  await vypln({ jmeno: 'Bára Dlužná', oznaceni: 'Byt 2 – Kolín', zacatek: '2026-09', castka: '8000' });
  await jdi('#/');
  t = await text();
  over(t.indexOf('Bára') < t.indexOf('Test') && t.includes('Tento měsíc ještě není záloha'), 'přehled: dlužník nahoře, výzva k záloze');
  await snimek('prehled');

  await jdi(`#/n/${nid}/platba`);
  await js(`document.querySelector('form').elements.castka.value = '12,50'; document.querySelector('form').elements.zpusob.value = 'hotove'; document.querySelector('form').requestSubmit()`);
  await pockej(200);
  over((await text()).includes('kladné celé číslo'), 'chybná částka se odmítne');
  await snimek('formular-chyba');

  await jdi('#/nastaveni');
  await snimek('nastaveni');

  // Záloha → smazat data → obnova
  const zaloha = await js(`import('./logika.js').then(async l => { const d = await import('./db.js');
    return JSON.stringify(l.vytvorZalohu(await d.vsechny('najemnici'), await d.vsechny('platby'), 'x')); })`);
  await js(`import('./db.js').then(d => d.nahradVse([], []))`);
  await jdi('#/');
  await cdp('Page.reload');
  await pockej(800);
  over((await text()).includes('Zatím žádní nájemníci'), 'data smazána');
  await js(`import('./db.js').then(async d => { const l = await import('./logika.js'); const z = l.nactiZalohu(${JSON.stringify(zaloha)}); await d.nahradVse(z.najemnici, z.platby); })`);
  await cdp('Page.reload');
  await pockej(800);
  t = await text();
  over(t.includes('Bára') && t.includes('Test'), '7: obnova ze zálohy');

  over(await js('navigator.serviceWorker.getRegistration().then(r => !!r)'), 'service worker zaregistrován');
  over(chyby.length === 0, `bez chyb v konzoli${chyby.length ? ': ' + chyby.join(' | ') : ''}`);
} catch (e) {
  console.log('✖', e.message);
  selhani++;
} finally {
  ws.close();
  chrome.kill();
  server.close();
  await pockej(500);
  await rm(profil, { recursive: true, force: true }).catch(() => {});
}
console.log(selhani ? `SELHALO: ${selhani}` : `OK – snímky v ${SNIMKY}`);
process.exit(selhani ? 1 : 0);
