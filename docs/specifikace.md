# Aplikace Nájemník – specifikace (návrh v0.1)

*Stav: návrh v0.2 k odladění · 2026-10-27 (zapracovány odpovědi na otázky 1–8)*

## 1. Účel

Jednoduchá aplikace v telefonu (Android) pro pronajímatele. Eviduje nájemníky, kolik mají měsíčně platit, co skutečně zaplatili a kolik dluží. Aplikace se bude rozšiřovat po modulech. Tento dokument popisuje **modul 1 – Nájemníci a platby (pilot)**.

Používá ji jeden člověk (pronajímatel) na jednom telefonu.

## 2. Technické řešení (návrh)

| Varianta | Popis | Pro | Proti |
|---|---|---|---|
| **A – webová aplikace instalovaná na plochu (PWA)** ✅ doporučeno | Otevře se v Chrome a přes „Přidat na plochu“ se nainstaluje jako běžná ikona. Funguje bez internetu, data zůstávají jen v telefonu. | Žádný Obchod Play, rychlé úpravy (nová verze se načte sama), stejný kód později poběží i na PC | Data jsou v úložišti prohlížeče → **nutná záloha** (export souboru); vymazání dat Chrome by je smazalo |
| B – nativní aplikace pro Android (Kotlin) | Klasická aplikace instalovaná souborem APK | Nejrobustnější úložiště, notifikace bez omezení | Pomalejší vývoj, každá změna = nový APK k instalaci |

**Rozhodnuto: varianta A.**

**Kde bude na webu:** na webu je jen *program* (HTML/JS), ne data. Návrh: **GitHub Pages** (zdarma, účet petrvg), adresa typu `https://petrvg.github.io/najemnik/`. Telefon si ji jednou otevře, nainstaluje na plochu a dál běží i bez internetu; aktualizace si stáhne sám, když je online. Zdarma GitHub Pages vyžaduje veřejné repo – kód nic citlivého neobsahuje. Pokud má být i kód neveřejný: Cloudflare Pages / Vercel (zdarma, soukromé repo).

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
