# Stav projektu

## 2026-10-27 – pilot v0.1 (modul 1: Nájemníci a platby)

Hotovo:
- Specifikace v0.2 se zapracovanými rozhodnutími (docs/specifikace.md).
- Aplikace: přehled (dluh po splatnosti / tento měsíc chybí, dlužníci nahoře), detail (měl zaplatit vs. zaplatil, záložky Platby a Měsíce), platby (nová/úprava/smazání), nájemník (nový/úprava/ukončení/smazání), změna nájmu s historií, záloha do telefonu + poslat jinam, obnova, offline, instalace na plochu.
- Testy: 15 testů výpočtů (scénáře ze spec. kap. 8) + kouřový test v Chrome – vše prochází.

Další kroky:
- Uživatel nainstaluje do telefonu a vyzkouší → připomínky.
- Další moduly dle spec. kap. 7.

## 2026-10-27 – import výpisů: čtečky + párování (logika, bez UI)

Hotovo:
- `app/vypisy.js` – čtečky: Fio CSV (UTF-8, účet z názvu souboru), ČS CSV (UTF-16), KB PDF (textové položky z pdf.js, sloupce podle pozic).
- `app/parovani.js` – párování dle spec. kap. 11 (účet plátce → VS → rozpor/jméno = návrh → nepřiřazeno; „není nájem“; duplicity), převod rozhodnutí na platby + zapamatování účtu + pravidla.
- Testy na vymyšlených datech: `npm test` (34 testů celkem).
- Ověření na skutečných výpisech jen lokálně: `npm run over-vypisy` – KB: 25/25 transakcí, součet = změna zůstatku, počty i obraty = rekapitulace banky; ČS CSV za září = součty z PDF výpisu; Fio 13 pohybů.

Další kroky (import):
- UI: Nastavení → Moje účty; u nájemníka VS, „platí na účet“, účty plátce; obrazovka Import (výběr souborů → náhled jistě/návrhy/nepřiřazené → potvrzení).
- pdf.js do `app/vendor/` (offline) pro čtení KB PDF v telefonu.
- Záloha musí nově obsahovat i pravidla importu (nenajemUcty, ignorovane) a „Moje účty“.
