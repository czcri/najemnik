# Aplikace Nájemník – specifikace (návrh v0.1)

*Stav: návrh v0.2 k odladění · 2026-10-27 (zapracovány odpovědi na otázky 1–8)*

## 1. Účel

Jednoduchá aplikace v telefonu (Android) pro pronajímatele. Eviduje nájemníky, kolik mají měsíčně platit, co skutečně zaplatili a kolik dluží. Aplikace se bude rozšiřovat po modulech. Tento dokument popisuje **modul 1 – Nájemníci a platby (pilot)**.

Používá ji jeden člověk (pronajímatel) na jednom telefonu.

## 2. Technické řešení

> **Od verze 2.0:** React + Vite + Tailwind + Recharts (`web/`), logika v `core/`, stále PWA bez serveru, data jen v telefonu (IndexedDB `najemnik-v2`). Níže původní rozhodnutí z pilotu.

| Varianta | Popis | Pro | Proti |
|---|---|---|---|
| **A – webová aplikace instalovaná na plochu (PWA)** ✅ doporučeno | Otevře se v Chrome a přes „Přidat na plochu“ se nainstaluje jako běžná ikona. Funguje bez internetu, data zůstávají jen v telefonu. | Žádný Obchod Play, rychlé úpravy (nová verze se načte sama), stejný kód později poběží i na PC | Data jsou v úložišti prohlížeče → **nutná záloha** (export souboru); vymazání dat Chrome by je smazalo |
| B – nativní aplikace pro Android (Kotlin) | Klasická aplikace instalovaná souborem APK | Nejrobustnější úložiště, notifikace bez omezení | Pomalejší vývoj, každá změna = nový APK k instalaci |

**Rozhodnuto: varianta A.**

**Kde bude na webu:** na webu je jen *program* (HTML/JS), ne data. Návrh: **GitHub Pages** (zdarma, účet czcri), adresa `https://czcri.github.io/najemnik/`. Telefon si ji jednou otevře, nainstaluje na plochu a dál běží i bez internetu; aktualizace si stáhne sám, když je online. Zdarma GitHub Pages vyžaduje veřejné repo – kód nic citlivého neobsahuje. Pokud má být i kód neveřejný: Cloudflare Pages / Vercel (zdarma, soukromé repo).

**Data** (nájemníci, platby) jsou jen v telefonu (IndexedDB) + měsíční záloha e-mailem. Pokud by se úložiště ukázalo jako slabé místo, lze aplikaci zabalit do nativní bez přepisování.

## 3. Pojmy

- **Nájemník** – osoba, která platí nájem.
- **Bydliště / označení** – volný text (v pilotu tvoje vlastní označení, např. „Byt 2 – Kolín“). Strukturovaná adresa se domyslí později.
- **Nájem (předpis)** – kolik má nájemník platit za měsíc a od kdy.
- **Platba** – skutečně přijaté peníze: datum, částka, poznámka.
- **Saldo** – součet předpisů do aktuálního měsíce − součet plateb. Kladné = **dluh**, záporné = **přeplatek**.

## 4. Data

### Nájemník
| Pole | Povinné | Poznámka |
|---|---|---|
| Jméno | ano | |
| Označení bydliště | ano | volný text |
| Telefon | ne | pro budoucí upomínky |
| Poznámka | ne | |
| Začátek nájmu (měsíc/rok) | ano | od tohoto měsíce naskakují předpisy |
| Konec nájmu (měsíc/rok) | ne | po něm se předpisy přestanou tvořit; nájemník se přesune do „Ukončení“ |

### Nájem (předpis) – s historií změn
| Pole | Povinné | Poznámka |
|---|---|---|
| Platí od (měsíc/rok) | ano | |
| Složky | ano | seznam {název, částka}; v pilotu jediná složka „Nájem“ |

Při zvýšení nájmu se přidá nový řádek „od měsíce X nová částka“ – staré měsíce se nezmění.

Všechny částky jsou **celé koruny** (ukládají se jako celé číslo).

**Příprava na rozdělení:** předpis je už v datech uložen jako seznam složek. V pilotu se zadává a zobrazuje jen jedna částka; později lze přidat složky (služby, energie…) bez převodu dat. Platby se na složky nedělí.

### Platba
| Pole | Povinné | Poznámka |
|---|---|---|
| Datum | ano | předvyplní se dnešní |
| Částka (Kč) | ano | předvyplní se měsíční nájem |
| Poznámka | ne | krátký text |

Platbu lze **upravit** i **smazat** (smazání s potvrzením).

## 5. Měsíční předpisy – jak „naskočí“

- Předpisy se neukládají ručně, aplikace je **vypočítá**: pro každý měsíc od začátku nájmu do aktuálního měsíce (včetně) vezme částku platnou v daném měsíci. Vždy **celý měsíc** (i když nájem začne v jeho půlce).
- **1. den v měsíci** naskočí nový předpis, **splatnost je do konce měsíce**.
- Hlavní srovnání je **„měl zaplatit“ vs. „zaplatil“**:
  - **Měl zaplatit** = součet předpisů do aktuálního měsíce včetně.
  - **Zaplatil** = součet všech plateb.
  - **Rozdíl** se dělí na:
    - **Dluh po splatnosti** = předpisy *ukončených* měsíců − platby (je-li kladný), červeně.
    - **K zaplacení tento měsíc** (do konce měsíce) = zbytek aktuálního předpisu, oranžově – ještě to není dluh.
    - **Přeplatek** (je-li zaplaceno víc), modře.
- Platba se v měsíční tabulce počítá do měsíce **podle data platby**. Stav měsíce se určuje průběžně (kumulativně), takže pozdní doplatek „srovná“ i starší měsíc:
  - ✅ průběžně vyrovnáno · 🟠 běžící měsíc, ještě nezaplaceno · 🔴 po splatnosti, průběžně v dluhu.

## 6. Obrazovky

### 6.1 Přehled (úvodní obrazovka = „souhrn odjinud“)
- Nahoře: **celkový dluh po splatnosti** všech nájemníků, počet dlužníků a **k zaplacení tento měsíc** (kolik ještě nepřišlo).
- Seznam nájemníků (do ~20): jméno, označení, stav (červeně dluh, oranžově „tento měsíc ještě nezaplatil“, zeleně v pořádku, modře přeplatek).
- Řazení: dlužníci nahoře.
- Tlačítko **+ Nájemník**.
- Klepnutí na nájemníka → detail.

### 6.2 Detail nájemníka
- Hlavička: jméno, označení, aktuální nájem Kč/měs, **měl zaplatit**, **zaplatil**, **dluh po splatnosti / k zaplacení tento měsíc / přeplatek**.
- Velké tlačítko **+ Platba**.
- Dvě záložky:
  - **Platby** – seznam (nejnovější nahoře): datum, částka, poznámka. Klepnutí = úprava.
  - **Měsíce** – měsíc po měsíci: měl zaplatit · zaplatil (platby v tom měsíci) · průběžný rozdíl · stav (✅ 🟠 🔴).
- Menu: upravit nájemníka, změnit nájem, ukončit nájem.

### 6.3 Zadání / úprava platby
Datum · Částka · Poznámka · **Uložit** (· Smazat při úpravě). Jedna obrazovka, zadání do 10 sekund.

### 6.4 Nájemník – nový / úprava
Jméno · Označení · Telefon · Poznámka · Začátek nájmu · Měsíční nájem.

### 6.5 Nastavení
- **Záloha do telefonu každý měsíc:** od 1. dne v měsíci (dokud se nezálohuje) svítí na přehledu výzva **„Zálohovat“**. Jedno klepnutí → soubor `najemnik-zaloha-RRRR-MM-DD.json` se uloží do **Stažených souborů** telefonu. Bez dalšího výběru.
  - Chrání proti smazání dat aplikace / prohlížeče (soubor ve Stažených zůstane).
  - **Nechrání** proti ztrátě nebo rozbití telefonu → v Nastavení je i **„Poslat zálohu jinam“** (sdílení Androidu: Gmail, Disk…). Doporučení: občas (např. čtvrtletně) poslat jinam.
- **Obnova** ze souboru (výběr souboru v telefonu) – nahradí všechna data, s potvrzením.
- Aplikace si při startu vyžádá od Chrome „trvalé úložiště“ (data nesmí být automaticky uvolněna).

## 7. Mimo pilot (budoucí moduly – návrhy)

1. Upomínky – předvyplněná SMS/WhatsApp zpráva dlužníkovi.
1. Zámek aplikace (PIN / otisk) – „časem ano“.
2. Notifikace 1. v měsíci / po splatnosti.
3. Kauce (jistota).
4. Služby a energie – zálohy, odečty měřidel, roční vyúčtování.
5. Nemovitosti a jednotky – strukturované adresy, více nájemníků v jedné jednotce.
6. Dokumenty a fotky – smlouvy, předávací protokoly.
7. Synchronizace / druhé zařízení, vazba na účetní aplikaci.
8. Den splatnosti a penále z prodlení.

## 8. Akceptační scénáře pilotu

Dnes = 15. 10. 2026.

1. Založím nájemníka „Test, Byt 1“, začátek 08/2026, nájem 10 000 Kč → měl zaplatit 30 000, zaplatil 0; **dluh po splatnosti 20 000** (srpen, září), **k zaplacení tento měsíc 10 000** (říjen).
2. Zadám platbu 10 000 Kč (5. 10.) → dluh po splatnosti 10 000, tento měsíc 10 000.
3. Zadám platbu 15 000 Kč (10. 10.) → dluh po splatnosti 0, k zaplacení tento měsíc 5 000; srpen a září ✅ (srovnáno pozdní platbou), říjen 🟠.
4. Upravím druhou platbu na 25 000 Kč → přeplatek 5 000, všechny měsíce ✅.
5. Smažu platbu → vše se přepočítá.
6. Změním nájem od 11/2026 na 11 000 Kč → říjen se nezmění, 1. 11. naskočí 11 000 Kč a říjen přejde do „po splatnosti“, pokud není uhrazen.
7. 1. 11. svítí výzva „Zálohovat“ → soubor je ve Stažených → po smazání dat a obnově ze souboru je vše zpět.
8. Aplikace funguje v režimu letadlo.

## 9. Rozhodnutí (odpovědi 2026-10-27)

1. Webová aplikace na ploše (PWA) na GitHub Pages (veřejný kód, data jen v telefonu).
2. Vždy celý měsíc; podstatné je srovnání **měl zaplatit vs. zaplatil**.
3. Předpis naskočí 1. den v měsíci, splatnost do konce měsíce.
4. Teď jedna částka, data připravena na rozdělení do složek.
5. Vždy celé koruny.
6. Záloha do telefonu každý měsíc (výzva + 1 klepnutí), občas poslat jinam.
7. Zámek teď ne, později modul.
8. Do ~20 nájemníků.

## 10. Otevřené otázky

Žádné – pilot ve stavbě.

## 11. Připravovaný modul: Import bankovních výpisů (návrh, ve fázi zadání)

*Zapsáno 2026-10-27 z rozhovoru, k doplnění.*

**Cíl:** ručně stažený výpis (soubor) z internetového bankovnictví → aplikace najde příchozí nájemné a přiřadí ho nájemníkům; uživatel jen potvrdí. Vše lokálně v telefonu, bez serveru.

**Více účtů:** pronajímatel má víc účtů (i u různých bank). V nastavení seznam „Moje účty“ (číslo účtu, banka, název). Výpis se k účtu přiřadí automaticky podle čísla účtu v souboru. Lze importovat víc výpisů najednou.

**Banky (2026-10-27):** Fio, Komerční banka, Česká spořitelna. Každý nájemník platí na **jeden konkrétní účet** (nové pole „účet pro platby“ u nájemníka → zúží párování, použije se i pro QR platbu).

**Formáty:** ne každá banka umí CSV → aplikace musí číst to, co daná banka nabízí: CSV, XLSX, ABO/GPC, XML a jako poslední možnost **PDF výpis** (textové PDF, čtené lokálně v telefonu). Pro každou banku vlastní čtečka, ověřená na vzorovém výpisu. Fio má navíc bezplatné API – možná pozdější automatika.

**Párování platby → nájemník (v tomto pořadí):**

Realita (2026-10-27): nájemníci mají vyplňovat VS, ale ne vždy to udělají; většinou platí ze svého jednoho účtu. → **Hlavní klíč je účet plátce**, VS je pojistka.

1. **Známý účet plátce** (zapamatovaný u nájemníka, může jich mít víc) a platba přišla na účet, kam nájemník platí → přiřazeno jistě, i bez VS.
2. **VS nájemníka** → přiřazeno jistě; je-li účet plátce nový, aplikace nabídne „zapamatovat účet pro příště“.
3. **Rozpor** (účet patří nájemníkovi A, VS nájemníkovi B) → jen návrh, nutné potvrzení.
4. Jméno plátce / zpráva pro příjemce ~ jméno nájemníka → jen **návrh**, nutné potvrzení (a nabídka zapamatovat účet).
5. Nic nesedí → „Nepřiřazené“: ručně vybrat nájemníka (účet se zapamatuje), nebo „Není nájem“ (jednorázově / natrvalo pro účet plátce).

Po prvním importu, kdy se účty nájemníků naučí, by mělo být přiřazení téměř vždy automatické.

**Pravidla:**
- Odchozí platby se ignorují.
- **Bez duplicit:** opakovaný import téhož nebo překrývajícího se výpisu nezapíše platbu dvakrát (identifikace podle ID pohybu v bance, jinak podle účtu + data + částky + protiúčtu + VS).
- Platba z výpisu se uloží jako běžná platba s odkazem na zdroj (účet, výpis); dál jde upravit/smazat. Hotovost se zapisuje ručně jako dosud.
- Náhled před uložením: „Nalezeno 12 příchozích plateb: 9 přiřazeno jistě, 2 návrhy, 1 nepřiřazená“.

**Související:** QR platba pro nájemníka (účet, VS, částka) – snižuje počet nepřiřazených plateb.

**Platby, které nejsou nájem:** na účty chodí i jiné platby → „Není nájem“ (jednorázově nebo natrvalo pro účet plátce); platby od neznámých plátců jdou do „Nepřiřazené“, nikdy se nepřiřadí automaticky jen podle částky.

**Vzorové výpisy (dodány 2026-10-27, `vzory-vypisu/`, mimo git – skutečná data nikdy do dokumentace ani testů):**

| Banka | Formát | Kódování | Číslo vlastního účtu | Poznámky ke čtení |
|---|---|---|---|---|
| Fio (2010) | CSV „Pohyby na účtu“ | UTF-8 s BOM, `;`, uvozovky | **jen v názvu souboru** (`Pohyby_na_uctu-<účet>_…`) → jinak zeptat se | částka `11093` / `-11411,77` (desetinná čárka); sloupce Protiúčet + Kód banky zvlášť; Zpráva pro příjemce, Poznámka, Název protiúčtu, VS (sloupec VS je v hlavičce 2×); typy „Bezhotovostní příjem“, „Okamžitá příchozí platba“ |
| Česká spořitelna (0800) | CSV (George) | **UTF-16 LE**, `;`, uvozovky | sloupec „Číslo účtu vlastníka“ | částka `110 000,00` (mezery v tisících); protiúčet ve tvaru `číslo/kód`; VS; „Zpráva pro příjemce“; typ „Příchozí úhrada“ |
| Komerční banka (0100) | **jen PDF** (periodický výpis) | textové PDF | v hlavičce „k účtu: …/0100“ | transakce = blok více řádků: datum, popis (PŘÍCHOZÍ ÚHRADA…), název a číslo protiúčtu, VS/KS/SS, částka (kladná = připsáno); „Zpráva pro příjemce:“ na dalších řádcích; čtení podle pozic sloupců |
| ČS – PDF | PDF výpis | textové PDF, rozházené pořadí | – | nepoužívat, ČS umí CSV |

**Haléře:** výpisy obsahují haléře; nájemné chodí v celých korunách. Při importu se částka zaokrouhlí na celé Kč (původní hodnota se uloží ke zdroji platby).

**Stav 2026-10-27:** čtečky a párování hotové a otestované (viz STAV.md), chybí obrazovky.

**Postup vývoje:** čtečky (Fio CSV, ČS CSV, KB PDF) + párování jako čistá logika s testy na **vymyšlených** datech ve stejném formátu; kontrola na skutečných vzorech jen lokálně.

## 12. Verze 2 – redesign (zadání 2026-10-27; vzhled z Lovable, implementováno ve verzi 2.0)

Podrobně: `lovable zadani/zadani-ucesane.txt` (učesané představy uživatele), prompt: `lovable zadani/prompt-pro-lovable.txt` (nahrazuje `docs/lovable-prompt.md`). Složka `lovable zadani/` je mimo git.

Změny proti pilotu:
- Úvod = 6 dlaždic s živými čísly: Nájemníci, Platby (stav aktuálního měsíce), Dlužníci, Vložit platbu, Záloha, Import z banky.
- Nájemník navíc: e-mail, účty plátce (víc), VS, **poznámka k dluhu** s datem (co řekl naposledy).
- **Jednorázový výdaj / dluh** (nová entita `Vydaj`: datum, částka, popis) – navyšuje „měl zaplatit“; slouží i pro počáteční dluh, protože evidence začíná od 10/2026. → úprava `stavNajemnika`.
- Záložka Měsíce: poslední sloupec **dluh kumulativně**.
- Dlužníci: poslední platba (kolik, kdy), zavolat, upomínka (SMS/WhatsApp/e-mail).
- Vložit platbu: výběr nájemníka + výsledek po uložení (uhrazeno / zbývá / přeplatek).
- Záloha: připomínka po **60 dnech** (místo každý měsíc).
- **Zdroj platby** viditelný u každé platby: `vypis` (import, banka + účet) / `hotove` / `prevod` (ručně zapsaný převod bez výpisu). Ruční zápis má volbu Hotově / Převodem. Import: platba odpovídající ručnímu převodu (stejný nájemník, částka, datum ± 5 dní) → stav `rucne` = nabídka „Nahradit ruční záznam“ / „Je to jiná platba“, nikdy automaticky.
- **Upomínky se šablonami:** šablony zpráv (Nastavení) se značkami {osloveni} {jmeno} {dluh} {tento_mesic} {mesic} {najem} {nemovitost} {ucet} {vs} {termin}; odeslání = náhled (lze upravit) → otevřít SMS (`sms:?body=`) / WhatsApp (`wa.me`) / e-mail (`mailto:`); historie upomínek u nájemníka; nové pole nájemníka `osloveni`. Výchozí šablony: přátelská připomínka, upomínka po splatnosti, důrazná upomínka, potvrzení platby.
- **Statistiky** (dlaždice 5 místo Zálohy; záloha uvnitř, odznak po 60 dnech): filtry období / způsob platby / nemovitost; KPI (přijato účet+hotově, očekáváno, úspěšnost %, dluh); grafy: příjmy po měsících (skládané účet+hotově + čára očekáváno), podíl hotově/účet, vývoj dluhu, dochvilnost; tabulka po nájemnících.
- **Detail nájemníka:** malý hravý graf posledních 6–12 měsíců (zaplatil – barva podle účet/hotově – vs. měl zaplatit, dluhové měsíce podbarvené).
- **Hotově vs. na účet je zásadní:** nájemník má `zpusobPlaceni: 'ucet' | 'hotove'` (výchozí pro nové platby, filtr, ikona); statistiky počítají podle skutečného zdroje platby (`vypis`/`prevod` = účet, `hotove` = hotovost).
- Návrhy na později (nerozhodnuto): QR platba, kauce, zámek PIN, notifikace 1. v měsíci.

## 13. Posuvná hlavní karta: Hotovost a Na účet (odsouhlaseno a implementováno 2026-10-28, verze 2.1)

**Hlavní karta na přehledu je posuvná do strany** (tečky pod kartou); po otevření se ukáže **Hotovost** (pořadí změněno 2026-10-28):
1. **Hotovost** – kontrolní seznam převzetí hotovosti v aktuálním měsíci.
2. **Měsíc** – jako dosud (přišlo, % vybráno, dluh po splatnosti, očekáváno).
3. **Na účet** – kdo z platících převodem už v tomto měsíci zaplatil (připraveno; závisí na tom, kdy se nahrávají výpisy – viz níže).

**Nájemník – nové pole** „Hotovost čekám k … dni v měsíci“ (1–31, jen u způsobu placení Hotově).

**Strana Hotovost:**
- Seznam nájemníků s výchozím způsobem placení **Hotově**, kteří v aktuálním měsíci ještě nemají zaplaceno; **seřazeno podle dne „čekám k“** (bez dne na konec).
- Položka: jméno, nemovitost, „čekám k 5. 11.“, částka, která za tento měsíc ještě chybí; po termínu zvýrazněno.
- **Tři stavy:** nezaplaceno · **částečně – chybí X Kč** · zaplaceno (= zmizí ze seznamu).
- **Zaškrtnutí** (i klepnutí na částku) = otevře **potvrzení převzetí** (jméno, chybějící částka, datum – lze upravit); teprve **Potvrdit převzetí** zapíše platbu *hotově* → položka zmizí, platba je v platbách, detailu, statistikách. Poté ještě krátké „Zpět“. *(Změna 2026-10-28: dříve se zapisovalo hned bez potvrzení.)*
- Nižší částka → položka zůstane ve stavu „částečně“.
- Dole souhrn „Převzato 3 z 7 · 33 000 Kč“.
- **Obnova 1. dne v měsíci** je automatická: stav se počítá z plateb s datem v aktuálním měsíci vůči nájmu (+ výdajům) tohoto měsíce, takže nový měsíc začíná s plným seznamem. Starší dluh se zde neřeší (je v Dlužnících); platba převodem od hotovostního nájemníka se také započte.

**Strana Na účet:** stejný princip pro nájemníky „Na účet“ (bez zaškrtávání – platby přicházejí z výpisu nebo ručního zápisu), s informací „poslední import výpisu: …“. Protože výpisy se nahrávají až na konci měsíce, bude v průběhu měsíce většinou prázdná → **k doladění** (možnosti: automatické načítání Fio přes API, e-mailová oznámení banky, ruční odškrtnutí převodu).

**Zkratky na ikoně** (podržet ikonu aplikace): Vložit platbu · Hotovost · Dlužníci.

**Widget na plochu** – odloženo; vyžaduje nativní obal (Capacitor, APK), který by zároveň umožnil skutečné notifikace bez serveru.

**Upozornění (implementováno a + b; c odloženo):** webová aplikace bez serveru nemůže sama poslat notifikaci, když je zavřená. Možnosti:
- a) **Kalendář** – aplikace vytvoří opakované události („Hotovost – Novák, každého 5.“) do Google Kalendáře; upozornění pak dělá kalendář. Bez serveru, data neodcházejí. *(doporučeno jako první krok)*
- b) Při otevření aplikace banner „Dnes čekáš hotovost od …“.
- c) Skutečné push notifikace – potřebují malý server; na něj by odcházel jen rozpis dnů, ne jména a částky.

## 14. Logo autora aplikace (2026-10-28, verze 2.2)

- **Úvodní obrazovka při každém spuštění** (~1,4 s, klepnutím přeskočit): ikona a název „Nájemník“, dole „Vytvořilo“ + logo Simply Software (symbol nad nápisem).
- **Záhlaví přehledu:** vpravo symbol SS → panel „O aplikaci“ (verze, „Vytvořilo“ + logo).
- **Nastavení dole:** verze + „Vytvořilo“ + logo (symbol vedle nápisu).
- Ikona aplikace na ploše zůstává domek (logo patří k „Vytvořilo“).
- Logo: přesné křivky z `logo/Logo-02.pdf` a `Logo-03.pdf` (písma vložená v PDF, převedeno přes Poppler `pdftocairo -svg`) → `web/public/logo/simply-software-{pod,vedle}[-svetle].svg`; světlá varianta pro tmavý režim. Symbol SS v záhlaví z `Logo-01.svg` (barva podle režimu). Zdrojová složka `logo/` je mimo git.
