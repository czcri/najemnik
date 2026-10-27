# Nájemník

Jednoduchá aplikace do telefonu (Android) pro pronajímatele: nájemníci, měsíční nájem, platby, dluh.

- **Aplikace:** https://czcri.github.io/najemnik/ → v Chrome menu ⋮ → *Přidat na plochu* / *Instalovat aplikaci*.
- **Data** jsou jen v telefonu (IndexedDB). Na webu je pouze program. Zálohu dělá aplikace (Nastavení / výzva na přehledu).
- **Specifikace:** [docs/specifikace.md](docs/specifikace.md) · **Stav:** [STAV.md](STAV.md)

## Struktura

- `app/` – celá aplikace (statické soubory, bez sestavování): `logika.js` výpočty, `db.js` úložiště, `app.js` obrazovky, `sw.js` offline.
- `tests/` – testy výpočtů: `npm test`
- `nastroje/smoke.mjs` – průchod aplikací v headless Chrome + snímky: `npm run smoke`
- `nastroje/ikony.py` – generování ikon (Pillow)

## Vydání nové verze

1. Zvýšit `VERZE` v `app/sw.js` (jinak telefony zůstanou na staré verzi z mezipaměti) a `VERZE_APLIKACE` v `app/app.js`.
2. `npm test && npm run smoke`
3. Push do `main` → GitHub Actions zveřejní `app/` na Pages. Telefon si novou verzi stáhne při dalším otevření s internetem (projeví se při druhém otevření).
