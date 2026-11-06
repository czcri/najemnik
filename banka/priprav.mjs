// Příprava služby najemnik-banka na Cloudflare (spouští uživatel: npm run banka:priprav).
// 1) založí úložiště KV, 2) nasadí službu, 3) vytvoří klíč aplikace, 4) uloží odkaz pro napojení telefonu
// do banka/.local/odkaz-pro-telefon.txt (mimo git). Token Fio se vkládá zvlášť: npm run banka:token
// Předpoklad: přihlášení do Cloudflare (npx wrangler@4 login).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SLOZKA = path.dirname(fileURLToPath(import.meta.url));
const KONFIG = path.join(SLOZKA, 'wrangler.toml');
const APLIKACE = 'https://czcri.github.io/najemnik/';

const wrangler = (args, vstup) => execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'wrangler@4', ...args, '-c', KONFIG],
  { cwd: SLOZKA, input: vstup, encoding: 'utf8', stdio: [vstup === undefined ? 'inherit' : 'pipe', 'pipe', 'pipe'], shell: process.platform === 'win32' });

function krok(text) { console.log(`\n▶ ${text}`); }

try {
  krok('Kontrola přihlášení do Cloudflare');
  if (/not authenticated/i.test(wrangler(['whoami']))) throw new Error('Nejste přihlášen. Spusťte: npx wrangler@4 login');

  let konfig = readFileSync(KONFIG, 'utf8');
  if (konfig.includes('id = "DOPLNIT"')) {
    krok('Zakládám úložiště (KV)');
    const vystup = wrangler(['kv', 'namespace', 'create', 'DATA']);
    const id = vystup.match(/id\s*=\s*"([0-9a-f]{32})"/)?.[1] ?? vystup.match(/"id":\s*"([0-9a-f]{32})"/)?.[1];
    if (!id) throw new Error(`Nepodařilo se zjistit ID úložiště:\n${vystup}`);
    konfig = konfig.replace('id = "DOPLNIT"', `id = "${id}"`);
    writeFileSync(KONFIG, konfig);
  }

  krok('Nasazuji službu');
  const nasazeni = wrangler(['deploy']);
  const adresa = nasazeni.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0];
  if (!adresa) throw new Error(`Nepodařilo se zjistit adresu služby:\n${nasazeni}`);

  krok('Vytvářím klíč aplikace');
  const klic = randomBytes(32).toString('base64url');
  wrangler(['secret', 'put', 'KLIC_APLIKACE'], klic);

  const odkaz = `${APLIKACE}#/nastaveni?banka=${encodeURIComponent(adresa)}&klic=${klic}`;
  mkdirSync(path.join(SLOZKA, '.local'), { recursive: true });
  const soubor = path.join(SLOZKA, '.local', 'odkaz-pro-telefon.txt');
  writeFileSync(soubor, `${odkaz}\n`);

  console.log(`\n✔ Služba běží: ${adresa}`);
  console.log(`✔ Odkaz pro napojení telefonu je v souboru: ${soubor}`);
  console.log('  (klíč se tu nevypisuje – soubor otevřete a odkaz pošlete do telefonu, třeba zprávou sám sobě)');
  console.log('\nDalší krok: vložte token Fio → npm run banka:token');
} catch (e) {
  console.error(`\n✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
