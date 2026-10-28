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

## 2026-10-27 – verze 2.0: nový vzhled (podle Lovable) + všechny funkce zadání v2

Hotovo:
- Přechod na React (Vite, Tailwind, Recharts) ve `web/`; logika přesunuta do `core/` (sdílená, testovaná). Pilotní `app/` odstraněna (je v historii gitu).
- Obrazovky: přehled (karta měsíce + 6 dlaždic s živými čísly, odznak Zálohovat), nájemníci (hledání, filtry stav / účet / hotově), detail (stav, měl/zaplatil, malý graf účet/hotově vs. měl, záložky Platby / Měsíce s kumulativním dluhem / Výdaje), platby (stav měsíce), dlužníci (poznámka k dluhu, zavolat, upomínka), vložit platbu (výsledek po uložení), statistiky (filtry, KPI, příjmy po měsících, hotově vs. účet, vývoj dluhu, dochvilnost, tabulka, záloha), import (Fio/ČS/KB, náhled skupin, ruční převody, duplicity), nastavení (šablony zpráv, moje účty, pravidla „není nájem“).
- Formuláře: nájemník (způsob placení, oslovení, VS, účty plátce, konec nájmu), platba (hotově / převodem, štítek zdroje), jednorázový výdaj / dluh, změna nájmu.
- Data: nová DB `najemnik-v2` (+ výdaje, upomínky, nastavení); automatické převzetí dat z pilotu; záloha v2 (načte i zálohu z pilotu).
- Testy: 43 testů `core/` + kouřový test v Chrome (17 kontrol vč. převzetí dat z pilotu a importu výpisu).

Další kroky / nápady:
- Uživatel vyzkouší v telefonu → připomínky.
- Návrhy na později: QR platba, kauce, zámek PIN, notifikace 1. v měsíci, export statistik, součet hotovosti pro účetnictví.

## 2026-10-28 – verze 2.1: hotovost na hlavní kartě

Hotovo (spec. kap. 13):
- Hlavní karta posuvná: Měsíc · Hotovost · Na účet (tečky s názvy pod kartou).
- Hotovost: seznam hotovostních nájemníků bez zaplaceného měsíce, řazený podle nového pole „Hotovost čekám k (den)“; stavy nezaplaceno / částečně / zaplaceno (zmizí); zaškrtnutí otevře potvrzení převzetí (2.1.1), teprve potom se zapíše platba hotově (+ „Zpět“), klepnutí na částku = jiná částka / datum. Obnova 1. dne v měsíci automaticky (počítá se z plateb v měsíci).
- Na účet: stejný přehled bez zaškrtávání + odkaz na import (k doladění, výpisy se nahrávají na konci měsíce).
- Banner na přehledu „Dnes čekáš hotovost / Po termínu“.
- Nastavení → Připomínky hotovosti v kalendáři (odkaz do Google Kalendáře s opakováním, nebo .ics).
- Zkratky na ikoně aplikace (manifest shortcuts).
- Testy: 49 `core/` + kouřový test 27 kontrol.

Odloženo: widget na plochu + skutečné notifikace (nativní obal Capacitor/APK).

## 2026-10-28 – verze 2.1.1–2.2

- 2.1.1: převzetí hotovosti vyžaduje potvrzení (panel s částkou a datem).
- 2.1.2: hlavní karta začíná stranou Hotovost.
- 2.1.3: nová verze se v telefonu projeví hned (index.html bez HTTP cache, reload po převzetí řízení novým SW); návrat z pozadí → strana Hotovost.
- 2.2: logo Simply Software – úvodní obrazovka „Vytvořilo“, symbol v záhlaví → O aplikaci, patička Nastavení (spec. kap. 14).

## 2026-10-28 – verze 2.3

- Platby: výběr měsíce a roku (šipky ‹ › a klepnutí na měsíc = výběr měsíce/roku), od začátku prvního nájmu po aktuální měsíc; „Zpět na aktuální měsíc“.
