// Fio API: pohyby za období (token „Sledování účtu“ = jen čtení). Token se nikam neloguje.
import { nactiFioJson } from '../../core/vypisy.js';

export async function stahniFio(token, od, do_) {
  const r = await fetch(`https://fioapi.fio.cz/v1/rest/periods/${encodeURIComponent(token)}/${od}/${do_}/transactions.json`);
  if (r.status === 409) throw new Error('Fio: příliš častý dotaz (nejvýš 1× za 30 s), zkuste to za chvíli.');
  if (r.status === 401 || r.status === 500) throw new Error('Fio: token je neplatný nebo vypršel – obnovte ho v internetbankingu (Nastavení → API).');
  if (!r.ok) throw new Error(`Fio: chyba ${r.status}.`);
  return nactiFioJson(await r.json());
}
