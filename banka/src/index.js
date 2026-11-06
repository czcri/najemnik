// Služba najemnik-banka (Cloudflare Worker), spec. kap. 23.
// Denně stáhne příchozí platby z banky do fronty a pošle upozornění. Aplikace Nájemník si frontu
// vyzvedne (s klíčem aplikace), spáruje u sebe a po potvrzení uživatelem pohyby odškrtne.
// Data nájemníků služba nemá – jen pohyby na účtu (posledních DNI_ZPET dní), dokud je aplikace nezpracuje.
import { jePrichoziPlatba } from '../../core/parovani.js';
import { stahniFio } from './fio.js';
import { klicePush, posliUpozorneni } from './push.js';

const DNI_ZPET = 10;      // okno stahování; co už je ve frontě nebo zpracované, se přeskočí
const HOTOVO_DNI = 120;   // jak dlouho si pamatovat zpracované pohyby (delší než okno stahování)
const RUCNE_PO_S = 60;    // „Načíst teď“ nejvýš jednou za minutu (Fio dovoluje 1 dotaz za 30 s na token)

const den = d => d.toISOString().slice(0, 10);
const nacti = async (env, klic, vychozi) => (await env.DATA.get(klic, 'json')) ?? vychozi;
const uloz = (env, klic, hodnota) => env.DATA.put(klic, JSON.stringify(hodnota));

// Zdroje pohybů podle tajných údajů: FIO_TOKEN_1, FIO_TOKEN_2, … (KB doplní fáze 2).
export function zdroje(env) {
  return Object.keys(env).filter(k => /^FIO_TOKEN_\w+$/.test(k)).sort()
    .map(k => ({ id: k, banka: 'fio', stahni: (od, do_) => stahniFio(env[k], od, do_) }));
}

// Stáhne nové příchozí pohyby do fronty. Vrací počet nových.
export async function stahni(env, ted = new Date()) {
  const [fronta, hotovo, stav] = await Promise.all([nacti(env, 'fronta', {}), nacti(env, 'hotovo', {}), nacti(env, 'stav', {})]);
  const od = den(new Date(ted.getTime() - DNI_ZPET * 864e5)), do_ = den(ted);
  let nove = 0;
  for (const z of zdroje(env)) {
    try {
      const vypis = await z.stahni(od, do_);
      for (const p of vypis.pohyby.filter(jePrichoziPlatba)) {
        const klic = `${vypis.ucet}|id|${p.idBanky}`;
        if (!p.idBanky || fronta[klic] || hotovo[klic]) continue;
        fronta[klic] = { banka: vypis.banka, ucet: vypis.ucet, pohyb: p };
        nove++;
      }
      stav[z.id] = { banka: z.banka, ucet: vypis.ucet, posledni: ted.toISOString(), chyba: null };
    } catch (e) {
      stav[z.id] = { ...stav[z.id], banka: z.banka, posledniPokus: ted.toISOString(), chyba: e instanceof Error ? e.message : String(e) };
    }
  }
  const hranice = den(new Date(ted.getTime() - HOTOVO_DNI * 864e5));
  for (const [k, d] of Object.entries(hotovo)) if (d < hranice) delete hotovo[k];
  await Promise.all([uloz(env, 'fronta', fronta), uloz(env, 'hotovo', hotovo), uloz(env, 'stav', stav)]);
  return nove;
}

// Fronta seskupená po účtech ve tvaru výpisu, jak ho zná import v aplikaci.
async function vypisy(env) {
  const fronta = await nacti(env, 'fronta', {});
  const podleUctu = new Map();
  for (const { banka, ucet, pohyb } of Object.values(fronta)) {
    if (!podleUctu.has(ucet)) podleUctu.set(ucet, { banka, ucet, pohyby: [] });
    podleUctu.get(ucet).pohyby.push(pohyb);
  }
  return [...podleUctu.values()];
}

function stejne(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !b) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function obsluz(request, env, ted = new Date()) {
  const puvod = request.headers.get('Origin') ?? '';
  const povolene = String(env.POVOLENE_PUVODY ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const cors = povolene.includes(puvod)
    ? { 'Access-Control-Allow-Origin': puvod, 'Access-Control-Allow-Headers': 'X-Klic, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE', Vary: 'Origin' }
    : {};
  const odpoved = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!stejne(request.headers.get('X-Klic') ?? '', env.KLIC_APLIKACE ?? '')) return odpoved({ chyba: 'Neplatný klíč aplikace.' }, 401);

  const { pathname } = new URL(request.url);
  const telo = async () => { try { return await request.json(); } catch { return {}; } };

  if (request.method === 'GET' && pathname === '/stav') {
    const [stav, fronta] = await Promise.all([nacti(env, 'stav', {}), nacti(env, 'fronta', {})]);
    return odpoved({ ucty: Object.values(stav), fronta: Object.keys(fronta).length, vapid: (await klicePush(env)).verejny });
  }
  if (request.method === 'GET' && pathname === '/pohyby') return odpoved({ vypisy: await vypisy(env) });
  if (request.method === 'POST' && pathname === '/nacist') {
    const posledni = await nacti(env, 'rucne', null);
    if (posledni && ted.getTime() - Date.parse(posledni) < RUCNE_PO_S * 1000) return odpoved({ chyba: 'Načítalo se před chvílí – zkuste to za minutu.' }, 429);
    await uloz(env, 'rucne', ted.toISOString());
    await stahni(env, ted);
    return odpoved({ vypisy: await vypisy(env), ucty: Object.values(await nacti(env, 'stav', {})) });
  }
  if (request.method === 'POST' && pathname === '/hotovo') {
    const { klice } = await telo();
    if (!Array.isArray(klice)) return odpoved({ chyba: 'Chybí klice.' }, 400);
    const [fronta, hotovo] = await Promise.all([nacti(env, 'fronta', {}), nacti(env, 'hotovo', {})]);
    for (const k of klice) if (typeof k === 'string' && fronta[k]) { delete fronta[k]; hotovo[k] = den(ted); }
    await Promise.all([uloz(env, 'fronta', fronta), uloz(env, 'hotovo', hotovo)]);
    return odpoved({ fronta: Object.keys(fronta).length });
  }
  if (pathname === '/odber' && (request.method === 'POST' || request.method === 'DELETE')) {
    const { odber, endpoint } = await telo();
    const adresa = odber?.endpoint ?? endpoint;
    if (typeof adresa !== 'string' || !adresa.startsWith('https://')) return odpoved({ chyba: 'Chybí odběr.' }, 400);
    const odbery = (await nacti(env, 'odbery', [])).filter(o => o.endpoint !== adresa);
    if (request.method === 'POST') odbery.push({ endpoint: adresa });
    await uloz(env, 'odbery', odbery);
    return odpoved({ odberu: odbery.length });
  }
  return odpoved({ chyba: 'Neznámá adresa.' }, 404);
}

export default {
  fetch: (request, env) => obsluz(request, env),
  async scheduled(_udalost, env, ctx) {
    ctx.waitUntil((async () => { if (await stahni(env)) await posliUpozorneni(env); })());
  },
};
