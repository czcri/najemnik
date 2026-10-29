// Kouřový test aplikace (dist/) v headless Chrome přes DevTools protokol, bez závislostí.
// Projde hlavní scénáře klikáním ve formulářích a uloží snímky obrazovky.
// Spuštění: npm run build && npm run smoke -- [složka-pro-snímky]
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOREN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const SNIMKY = process.argv[2] ?? path.join(tmpdir(), 'najemnik-smoke-v2');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPY = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const cesta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (cesta === '/prazdna.html') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>x</title>');
  const soubor = path.join(KOREN, cesta.endsWith('/') ? cesta + 'index.html' : cesta);
  try {
    const obsah = await readFile(soubor);
    res.writeHead(200, { 'content-type': TYPY[path.extname(soubor)] ?? 'application/octet-stream' });
    res.end(obsah);
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
  if (r.exceptionDetails) throw new Error(`${vyraz.slice(0, 200)}\n${r.exceptionDetails.exception?.description}`);
  return r.result.value;
}
const text = () => js('document.body.innerText');
async function jdi(hash) { await js(`location.hash = ${JSON.stringify(hash)}`); await pockej(300); }
// Klik na tlačítko / odkaz podle viditelného textu nebo aria-label.
async function klik(popis, index = 0) {
  const ok = await js(`(() => { const p = ${JSON.stringify(popis)};
    const el = [...document.querySelectorAll('button, a, label')].filter(e => (e.getAttribute('aria-label') ?? e.innerText.trim()) === p || e.innerText.trim() === p).at(${index});
    if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error(`Nenalezeno k kliknutí: ${popis}`);
  await pockej(300);
}
// Vyplnění pole v Reactu (nativní setter + událost input/change); pole podle popisku <label>.
async function vypln(pole) {
  await js(`(() => { for (const [popis, hodnota] of Object.entries(${JSON.stringify(pole)})) {
    const label = [...document.querySelectorAll('label')].find(l => l.querySelector('span')?.innerText.trim() === popis);
    const el = label?.querySelector('input, select, textarea');
    if (!el) throw new Error('Pole nenalezeno: ' + popis);
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, hodnota);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  } })()`);
  await pockej(100);
}
// Počet záznamů v úložišti aplikace (IndexedDB najemnik-v2).
const pocetVDb = store => js(`new Promise(ok => { const r = indexedDB.open('najemnik-v2'); r.onsuccess = () => { const q = r.result.transaction('${store}').objectStore('${store}').count(); q.onsuccess = () => { r.result.close(); ok(q.result); }; }; })`);
let cislo = 0;
// celaStranka: false u posuvné karty – focení celé stránky dočasně mění rozměry a posune ji.
async function snimek(nazev, celaStranka = true) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: celaStranka });
  await writeFile(path.join(SNIMKY, `${String(++cislo).padStart(2, '0')}-${nazev}.png`), Buffer.from(data, 'base64'));
}
let selhani = 0;
function over(podminka, popis, detail = '') {
  console.log(`${podminka ? '✔' : '✖'} ${popis}${podminka ? '' : ` ${detail}`}`);
  if (!podminka) selhani++;
}
const kc = n => new Intl.NumberFormat('cs-CZ').format(n).replace(/\s/g, '\u00a0') + '\u00a0Kč';

try {
  await mkdir(SNIMKY, { recursive: true });
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('DOM.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 851, deviceScaleFactor: 2, mobile: true });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `{
    const D = Date, T = new D(2026, 9, 15, 12).getTime();
    globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } };
    window.confirm = () => true;
  }` });

  // 1) Převzetí dat z pilotu: připravit starou databázi 'najemnik' a pak spustit novou verzi.
  await cdp('Page.navigate', { url: URL_APP + 'prazdna.html' });
  await pockej(500);
  await js(`new Promise((ok, chyba) => { const r = indexedDB.open('najemnik', 1);
    r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('najemnici', { keyPath: 'id' });
      db.createObjectStore('platby', { keyPath: 'id' }).createIndex('najemnikId', 'najemnikId'); db.createObjectStore('meta'); };
    r.onsuccess = () => { const tx = r.result.transaction(['najemnici', 'platby'], 'readwrite');
      tx.objectStore('najemnici').put({ id: 'pilot', jmeno: 'Petra Pilotová', oznaceni: 'Byt P', zacatek: '2026-09', konec: null, predpisy: [{ od: '2026-09', slozky: [{ nazev: 'Nájem', castka: 8000 }] }] });
      tx.objectStore('platby').put({ id: 'pp', najemnikId: 'pilot', datum: '2026-09-03', castka: 8000 });
      tx.oncomplete = () { r.result.close(); ok(); }; }; r.onerror = () => chyba(r.error); })`.replace('tx.oncomplete = () {', 'tx.oncomplete = () => {'));
  await cdp('Page.navigate', { url: URL_APP });
  // počkat, až se úvodní obrazovka vykreslí (pomalejší start nesmí shodit test)
  for (let i = 0; i < 20 && !(await js(`!!document.querySelector('[aria-label="Úvodní obrazovka"]')`)); i++) await pockej(100);
  let t = await text();
  over(t.toLowerCase().includes('vytvořilo') && await js(`!!document.querySelector('[aria-label="Úvodní obrazovka"]')`), 'úvodní obrazovka s „Vytvořilo“ a logem');
  await pockej(300);
  over(await js(`[...document.querySelectorAll('img[alt="Simply Software"]')].every(i => i.complete && i.naturalWidth > 0)`), 'logo Simply Software se načetlo');
  await snimek('uvod', false);
  await pockej(2000);
  over(await js(`!!document.querySelector('[aria-label="Úvodní obrazovka"]')`), 'úvodní obrazovka je vidět ještě po 2,5 s');
  await pockej(1300);
  over(!(await js(`!!document.querySelector('[aria-label="Úvodní obrazovka"]')`)), 'úvodní obrazovka sama zmizí');
  t = await text();
  over(t.includes('1 nájemník'), 'data z pilotu převzata (1 nájemník)', t.slice(0, 200));
  await jdi('#/najemnici');
  over((await text()).includes('Petra Pilotová'), 'nájemník z pilotu v seznamu');

  // 1b) Rozpracovaný formulář přežije ukončení aplikace (přepnutí do kontaktů, Android aplikaci zavře)
  await klik('Nový nájemník');
  await vypln({ 'Jméno': 'Rozpracovaný Nájemník', 'Telefon': '601 222 333' });
  await cdp('Page.reload');
  await pockej(1500);
  t = await text();
  const obnoveno = await js(`[...document.querySelectorAll('label')].find(l => l.querySelector('span')?.innerText.trim() === 'Jméno')?.querySelector('input')?.value ?? ''`);
  over(t.includes('Nový nájemník') && obnoveno === 'Rozpracovaný Nájemník', 'po restartu se rozpracovaný formulář obnoví', obnoveno);
  over(t.includes('Pokračujete v rozpracovaném zápisu') && !(await js(`!!document.querySelector('[aria-label="Úvodní obrazovka"]')`)), 'hláška o obnově, bez úvodní obrazovky');
  await klik('Zavřít');
  await cdp('Page.reload');
  await pockej(4000);
  over(!(await text()).includes('Nový nájemník'), 'zavřený formulář se po restartu neobnovuje');
  await klik('Nový nájemník');
  over(await js(`[...document.querySelectorAll('label')].find(l => l.querySelector('span')?.innerText.trim() === 'Jméno')?.querySelector('input')?.value ?? 'x'`) === '', 'nový formulář je po zavření zase prázdný');
  await klik('Zavřít');

  // 2) Nový nájemník
  await klik('Nový nájemník');
  await vypln({ 'Jméno': 'Jan Testovací', 'Nemovitost': 'Byt 1 – Kolín', 'Nájem od': '2026-08', 'Nájem vč. služeb': '10000', 'Telefon': '777 123 456', 'Variabilní symbol': '1001' });
  await klik('Uložit');
  await pockej(500);
  t = await text();
  over(t.includes('Dluží ' + kc(20000)) && t.includes('chybí ' + kc(10000)), '1: dluh 20 000 + tento měsíc 10 000', t.slice(0, 300));

  // 3) Platba hotově – „Za měsíc“ předvybere nejstarší nezaplacený měsíc (srpen)
  await klik('Platba');
  t = await text();
  over(t.includes('Za měsíc') && t.includes('Srpen 2026'), 'platba: za měsíc předvybrán nejstarší nezaplacený (srpen)');
  await vypln({ 'Částka': '10000', 'Datum': '2026-10-05', 'Poznámka': 'za srpen' });
  await klik('Hotově');
  await klik('Uložit platbu');
  await pockej(400);
  t = await text();
  over(t.includes('Dluží ' + kc(10000)) && t.includes('Hotově'), 'platba hotově: dluh 10 000, štítek Hotově');

  // 4) Výdaj (oprava) v září → dluh +2 500
  await klik('Výdaj / dluh');
  await vypln({ 'Popis': 'Oprava bojleru', 'Částka (Kč)': '2500', 'Datum': '2026-09-10' });
  await klik('Uložit');
  await pockej(400);
  t = await text();
  over(t.includes('Dluží ' + kc(12500)), 'výdaj zvýšil dluh na 12 500', t.slice(0, 300));
  await snimek('detail');
  await klik('Měsíce');
  t = await text();
  over(t.includes('Dluh celkem') && t.includes('výdaj ' + kc(2500)), 'záložka Měsíce s kumulativním dluhem a výdajem');
  await snimek('detail-mesice');
  // Úprava „měl zaplatit“ pro měsíc (sleva) klepnutím na měsíc v tabulce
  over((await text()).includes('budoucí'), 'tabulka Měsíce: příští měsíc jako budoucí');
  await js(`[...document.querySelectorAll('button')].find(b => b.innerText.startsWith('Říjen 26')).click()`);
  await pockej(300);
  t = await text();
  over(t.includes('Říjen 2026 – měl zaplatit') && t.includes('Standardní nájem v tomto měsíci'), 'klepnutí na měsíc otevře úpravu');
  await vypln({ 'Nájem za tento měsíc (Kč)': '8000', 'Důvod': 'sleva – oprava topení' });
  await klik('Uložit');
  await pockej(400);
  t = await text();
  over(t.includes('sleva – oprava topení') && t.includes('chybí ' + kc(8000)), 'upravený měsíc: důvod v tabulce, chybí 8 000', t.slice(0, 600));
  await js(`[...document.querySelectorAll('button')].find(b => b.innerText.startsWith('Říjen 26')).click()`);
  await pockej(300);
  await klik('Vrátit standardní nájem (' + kc(10000) + ')');
  await pockej(400);
  over((await text()).includes('chybí ' + kc(10000)) && !(await text()).includes('sleva – oprava topení'), 'vrácení standardního nájmu');
  const nid = await js('location.hash.split("/").pop()');

  // 5) Vložit platbu – výsledek po uložení
  await jdi('#/vlozit-platbu');
  t = await text();
  over(t.includes('Předvyplněn pravidelný měsíční nájem'), 'vložit platbu: předvyplněn pravidelný nájem (ne dluh)');
  await vypln({ 'Částka': '5000' });
  await klik('Převodem');
  const predDvojklikem = await pocetVDb('platby');
  await js(`(() => { const f = document.querySelector('form'); f.requestSubmit(); f.requestSubmit(); })()`);
  await pockej(600);
  over(await pocetVDb('platby') === predDvojklikem + 1, 'dvojí odeslání zapíše jen jednu platbu');
  await pockej(500);
  t = await text();
  over(t.includes('Dluh po splatnosti') && t.includes('tento měsíc chybí'), 'vložit platbu: výsledek „Dluh po splatnosti“ + běžný měsíc zvlášť', t.slice(0, 300));
  await snimek('vlozit-vysledek');

  // 6) Přehled, dlužníci, platby, statistiky, nastavení
  await jdi('#/');
  await pockej(500);
  t = await text();
  over(t.includes('Rychlé akce') && t.includes('Zálohovat'), 'přehled s dlaždicemi a odznakem Zálohovat');
  await snimek('prehled');
  await klik('O aplikaci');
  t = await text();
  over(t.includes('verze 2.9') && t.toLowerCase().includes('vytvořilo'), 'panel O aplikaci z loga v záhlaví');
  await snimek('o-aplikaci', false);
  await klik('Zavřít');
  await jdi('#/dluznici');
  t = await text();
  over(t.includes('Jan Testovací') && t.includes('Celkem po splatnosti'), 'dlužníci');
  await klik('Za měsíc');
  t = await text();
  over(t.includes('Za září 2026 stále chybí') && t.includes('Jan Testovací'), 'dlužníci: záložka Za měsíc (září)', t.slice(0, 500));
  await klik('V měsíci');
  t = await text();
  over(t.includes('V měsíci září 2026') && t.includes('Jan Testovací'), 'dlužníci: záložka V měsíci (září)', t.slice(0, 500));
  await snimek('dluznici-v-mesici', false);
  const castkaKarty = await js(`document.querySelector('.card-soft-2 .text-lg')?.innerText ?? ''`);
  await klik('Upomínka');
  const textKarty = await js('document.querySelector("textarea")?.value ?? ""');
  over(castkaKarty && textKarty.includes(castkaKarty.replace(/\u00a0/g, ' ')), 'upomínka z karty měsíce: částka z karty', `${castkaKarty} | ${textKarty}`);
  await klik('Zavřít');
  await klik('Celkem');
  await klik('Upomínka');
  t = await text();
  const zprava = await js('document.querySelector("textarea")?.value ?? ""');
  over(t.includes('Upomínka po splatnosti') && zprava.startsWith('Dobrý den Jan Testovací') && zprava.includes('VS 1001'), 'upomínka: šablona doplněná o jméno a VS', zprava);
  const sms = await js(`decodeURIComponent([...document.querySelectorAll('a')].find(a => a.href.startsWith('sms:'))?.href.split('body=')[1] ?? '')`);
  over(!/[  –„“]/.test(zprava + sms) && /\d \d{3} Kč/.test(sms), 'upomínka: v SMS obyčejné mezery v částce (žádné „?“)', JSON.stringify(sms));
  await snimek('upominka');
  await klik('Zavřít');
  await jdi('#/platby');
  t = await text();
  over(t.includes('Přišlo v měsíci') && t.includes('Co přišlo') && t.includes('Přišlo tento měsíc'), 'platby: výchozí záložka Přišlo v měsíci');
  await snimek('platby');
  await klik('Za měsíc');
  await klik('Předchozí měsíc');
  t = await text();
  over(t.includes('Září 2026') && t.includes('Zpět na aktuální měsíc') && t.includes('Dosud nezaplaceno'), 'platby: přepnutí na předchozí měsíc', t.slice(0, 400));
  await js(`(() => { const el = document.querySelector('input[type=month]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '2026-08'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await pockej(200);
  over((await text()).includes('Srpen 2026'), 'platby: výběr měsíce a roku');
  over(await js(`document.querySelector('[aria-label="Další měsíc"]').disabled === false && document.querySelector('[aria-label="Předchozí měsíc"]').disabled === true`), 'platby: nelze před začátek prvního nájmu');
  await klik('Zpět na aktuální měsíc');
  over((await text()).includes('Říjen 2026'), 'platby: zpět na aktuální měsíc');
  await jdi('#/statistiky');
  await pockej(800);
  t = await text();
  over(t.includes('Příjmy po měsících') && t.includes('Hotově vs. na účet') && t.includes('Data a záloha'), 'statistiky s grafy a zálohou');
  await klik('Měsíc');
  t = await text();
  over(t.includes('Říjen 2026') && !t.includes('Srpen 2026 –'), 'statistiky: volba Měsíc');
  await klik('Předchozí měsíc');
  over((await text()).includes('Září 2026'), 'statistiky: listování na předchozí měsíc');
  await snimek('statistiky');
  await jdi('#/nastaveni');
  t = await text();
  over(t.includes('Šablony zpráv') && t.includes('Moje účty'), 'nastavení');
  await snimek('nastaveni');

  // 6b) Hotovost: nájemník platící hotově, čekám k 15. (= dnes)
  await jdi('#/najemnici');
  await klik('Nový nájemník');
  await vypln({ 'Jméno': 'Hana Hotová', 'Nemovitost': 'Byt 3', 'Nájem od': '2026-10', 'Nájem vč. služeb': '9000' });
  await klik('Hotově', -1); // přepínač v otevřeném panelu (za ním je stejnojmenný filtr seznamu)
  await vypln({ 'Hotovost čekám k (den v měsíci)': '15' });
  await klik('Uložit');
  await jdi('#/');
  await pockej(400);
  t = await text();
  over(t.includes('Dnes čekáš hotovost: Hana Hotová'), 'banner „Dnes čekáš hotovost“', t.slice(0, 300));
  over(await js(`document.querySelector('.snap-x').scrollLeft`) < 2 && t.indexOf('Hotovost · ') < t.indexOf('Přišlo tento měsíc'), 'po otevření je první strana Hotovost');
  await klik('Ukázat Hotovost');
  await pockej(600);
  t = await text();
  over(t.includes('Hana Hotová') && t.includes('čekám dnes'), 'strana Hotovost se seznamem');
  await snimek('karta-hotovost', false);
  await klik('Převzato od Hana Hotová');
  t = await text();
  over(t.includes('Potvrdit převzetí hotovosti') && !t.includes('Převzato ' + kc(9000)), 'zaškrtnutí otevře potvrzení, zatím nic nezapsáno');
  await snimek('potvrzeni-prevzeti', false);
  await klik('Zrušit');
  t = await text();
  over(t.includes('čekám dnes') && t.includes('Převzato ' + kc(0)), 'Zrušit: nic se nezapsalo');
  await klik('Převzato od Hana Hotová');
  await klik('Potvrdit převzetí');
  await pockej(500);
  t = await text();
  over(t.includes('Všechna hotovost za tento měsíc převzata') && t.includes('Převzato ' + kc(9000)), 'zaškrtnutí: položka zmizí, platba zapsána');
  await klik('Zpět');
  await pockej(500);
  t = await text();
  over(t.includes('Hana Hotová') && t.includes('čekám dnes'), 'Zpět: platba smazána, položka zpět v seznamu');
  await klik(kc(9000));
  await vypln({ 'Převzatá částka': '4000' });
  await klik('Potvrdit převzetí');
  await pockej(500);
  t = await text();
  over(t.includes(kc(5000)) && t.includes('chybí z ' + kc(9000)), 'částečné převzetí: chybí 5 000 z 9 000', t.slice(0, 600));
  await pockej(800);
  const posun = await js(`(() => { const el = document.querySelector('.snap-x'); return [el.scrollLeft, el.clientWidth]; })()`);
  over(posun[0] < 2, 'karta zůstala na straně Hotovost (první strana)', JSON.stringify(posun));
  await snimek('karta-hotovost-castecne', false);
  // Předvyplněná částka: po částečné platbě doplatek
  const hanaId = await js(`(() => { const a = [...document.querySelectorAll('a')].find(x => x.innerText.includes('Hana Hotová')); return a ? a.hash.split('/').pop() : ''; })()`);
  await jdi(`#/najemnici/${hanaId}`);
  await klik('Platba');
  const predvyplneno = await js(`[...document.querySelectorAll('label')].find(l => l.querySelector('span')?.innerText.trim() === 'Částka')?.querySelector('input')?.value ?? ''`);
  t = await text();
  over(predvyplneno === '5000' && t.includes('doplatek za říjen'), 'platba: po částečné platbě předvyplněn doplatek 5 000', predvyplneno);
  await klik('Zavřít');
  await jdi('#/');
  await pockej(400);
  await klik('Ukázat Měsíc');
  await pockej(600);
  await js(`document.dispatchEvent(new Event('visibilitychange'))`); // návrat aplikace z pozadí
  await pockej(300);
  over(await js(`document.querySelector('.snap-x').scrollLeft`) < 2, 'návrat z pozadí → zase strana Hotovost');
  await klik('Ukázat Na účet');
  await pockej(600);
  await snimek('karta-na-ucet', false);
  await jdi('#/nastaveni');
  t = await text();
  over(t.includes('Připomínky hotovosti v kalendáři') && t.includes('každý měsíc'), 'nastavení: připomínky v kalendáři');
  const odkaz = await js(`[...document.querySelectorAll('a')].find(a => a.href.includes('calendar.google.com'))?.href ?? ''`);
  over(odkaz.includes('BYMONTHDAY%3D15'), 'odkaz do Google Kalendáře s opakováním 15.', odkaz);

  // 7) Import výpisu Fio (vymyšlená data)
  const csv = '\ufeff"Datum";"Objem";"Měna";"Protiúčet";"Kód banky";"Zpráva pro příjemce";"Poznámka";"Typ";"Název banky";"Název protiúčtu";"Reference plátce";"KS";"VS";"SS";"VS"\r\n'
    + '"20.10.2026";"7500";"CZK";"1234567890";"3030";"najem";"Jan Testovací";"Bezhotovostní příjem";"Air Bank";"Jan Testovací";"";"";"1001";"";"1001"\r\n'
    + '"21.10.2026";"999";"CZK";"5555555555";"0800";"";"";"Bezhotovostní příjem";"ČS";"Pojišťovna";"";"";"";"";""\r\n';
  const soubor = path.join(profil, 'Pohyby_na_uctu-2200000001_20261001-20261031.csv');
  await writeFile(soubor, csv);
  await jdi('#/import');
  const { root } = await cdp('DOM.getDocument');
  const { nodeId } = await cdp('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
  await cdp('DOM.setFileInputFiles', { nodeId, files: [soubor] });
  await pockej(800);
  t = await text();
  over(t.includes('Fio banka · 2200000001/2010'), 'import: soubor rozpoznán', t.slice(0, 400));
  await klik('Spárovat platby');
  t = await text();
  over(t.includes('1 přiřazeno') && t.includes('1 nepřiřazeno'), 'import: 1 přiřazeno (VS), 1 nepřiřazeno', t.slice(0, 500));
  await snimek('import-nahled');
  await klik('Zapsat 1 platbu');
  await pockej(500);
  await jdi(`#/najemnici/${nid}`);
  t = await text();
  over(t.includes('Výpis · Fio') && t.includes('Vše zaplaceno') === false, 'importovaná platba v detailu se štítkem Výpis · Fio');
  // znovu stejný výpis → duplicita
  await jdi('#/import');
  const d2 = await cdp('DOM.getDocument');
  const n2 = await cdp('DOM.querySelector', { nodeId: d2.root.nodeId, selector: 'input[type=file]' });
  await cdp('DOM.setFileInputFiles', { nodeId: n2.nodeId, files: [soubor] });
  await pockej(800);
  await klik('Spárovat platby');
  t = await text();
  over(t.includes('0 přiřazeno') && t.includes('Zapsat 0 plateb'), 'opakovaný import nezapíše platbu znovu', t.slice(0, 400));

  // Přepnutí „platí dopředu“ nesmí změnit dluh (dosavadní platby se ukotví)
  await jdi(`#/najemnici/${nid}`);
  const stavPred = await js(`document.querySelector('.card-navy p:nth-child(2)')?.innerText ?? ''`);
  await klik('Upravit');
  await klik('Dopředu', -1);
  await klik('Uložit');
  await pockej(500);
  const stavPo = await js(`document.querySelector('.card-navy p:nth-child(2)')?.innerText ?? ''`);
  over(stavPred && stavPred === stavPo, 'přepnutí „platí dopředu“ nezmění dluh', `${stavPred} → ${stavPo}`);

  const vMezipameti = await js(`caches.keys().then(async k => { let n = 0; for (const c of k) n += (await (await caches.open(c)).keys()).length; return n; })`);
  over(vMezipameti > 10, 'offline: všechny soubory verze v mezipaměti', String(vMezipameti));

  await jdi('#/najemnici/pilot');
  await klik('Upravit');
  await klik('Smazat nájemníka');
  await pockej(500);
  await cdp('Page.reload');
  await pockej(4500);
  await jdi('#/najemnici');
  over(!(await text()).includes('Petra Pilotová'), 'smazaný nájemník z první verze se po restartu nevrátí');

  over(chyby.length === 0, 'bez chyb v konzoli', chyby.join(' | '));
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
