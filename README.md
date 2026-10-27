# Nájemník

Aplikace do telefonu (Android) pro pronajímatele: nájemníci, nájem, platby (hotově / na účet), dlužníci a upomínky, statistiky, import bankovních výpisů (Fio, ČS, KB).

- **Aplikace:** https://czcri.github.io/najemnik/ → v Chrome menu ⋮ → *Přidat na plochu* / *Instalovat aplikaci*.
- **Data** jsou jen v telefonu (IndexedDB). Na webu je pouze program. Záloha: Statistiky → Data a záloha.
- **Specifikace:** [docs/specifikace.md](docs/specifikace.md) · **Stav:** [STAV.md](STAV.md)
- Vzhled vychází z návrhu v Lovable (soukromé repo `czcri/NAJEMNIK-APKA`, jen jako předloha).

## Struktura

- `core/` – výpočty bez závislostí (čisté JS): `logika.js` (předpisy, dluh, záloha), `statistiky.js`, `vypisy.js` (čtečky výpisů), `parovani.js` (párování plateb).
- `web/` – aplikace (React + Vite + Tailwind + Recharts): `src/screens/` obrazovky, `src/components/` společné prvky a formuláře, `src/data/` úložiště, `public/sw.js` offline.
- `tests/` – testy `core/`: `npm test`
- `nastroje/smoke.mjs` – průchod aplikací v headless Chrome + snímky: `npm run build && npm run smoke`
- `nastroje/over-vypisy.mjs` – kontrola čteček na skutečných výpisech ve `vzory-vypisu/` (mimo git): `npm run over-vypisy`

## Vývoj a vydání

```
npm install
npm run dev        # http://localhost:5173
npm test && npm run build && npm run smoke
```

Push do `main` → GitHub Actions spustí testy, build a zveřejní `dist/` na Pages. Telefon si novou verzi stáhne při dalším otevření s internetem.

Při prvním spuštění verze 2 se data z pilotní verze (databáze `najemnik`) automaticky převezmou do nové databáze `najemnik-v2`.
