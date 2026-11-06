# Návrh: pasivní přístup k účtu Fio (automatické načtení příchozích plateb)

Stav: **návrh k rozhodnutí** (2026-11-06), nic není implementováno.

## Cíl
Příchozí platby z účtu u Fio se načtou samy (bez ručního stahování výpisu na konci měsíce) a přiřadí
nájemníkům stejným párováním jako dnešní import výpisu (účet plátce → VS → jméno; náhled → potvrzení).

## Proč ne „přihlášení do internetbankingu“
- Přihlašování do internetbankingu jménem uživatele a obcházení dvoufázového ověření (2FA) je
  nebezpečné a porušuje podmínky banky. 2FA má chránit právě před tím, aby se k účtu dostal někdo
  (nebo něco) jiný než majitel.
- Fio má pro tento účel **oficiální API s tokenem**. 2FA se použije jen jednou, při založení tokenu.

## Fio API – ověřená fakta (dokumentace „API Bankovnictví“, verze 16. 10. 2025)
- Token se zakládá v internetbankingu: **Nastavení → API → Přidat token**. Založení musí být silně
  autorizováno (SMS / push). Token jde použít **5 minut** po autorizaci.
- Práva tokenu: **„Sledování účtu“** = jen čtení (export dat). Zadávat platby tímto tokenem nelze.
  Pro Nájemníka stačí a jiný typ nepoužívat.
- **Jeden token = jeden účet.** Pro více účtů je potřeba víc tokenů.
- Platnost **max. 180 dní**. Při zvoleném automatickém prodlužování se při každém přihlášení do
  Internetbankingu nebo Smartbankingu prodlouží na 180 dní od přihlášení.
- Data **mladší 90 dní** bez další autorizace. Starší jen po dočasném odemčení v IB (na 10 minut).
- Doporučený nejmenší interval dotazů na jeden token: **30 sekund**.
- Pohyby za období: `https://fioapi.fio.cz/v1/rest/periods/{token}/{od}/{do}/transactions.json`
  (dále `/last/{token}/…` = od posledního stažení se „zarážkou“ na serveru).
- **Z prohlížeče nejde volat přímo**: API nepovoluje cizí původ (CORS). Ověřeno 2026-11-06:
  dotaz s `Origin: https://czcri.github.io` → 403. PWA v telefonu proto potřebuje prostředníka,
  nebo nativní obal.

## Varianty

| Varianta | Jak | Plus | Minus |
|---|---|---|---|
| **A. Malý prostředník na Cloudflare (doporučeno)** | Cloudflare Worker (zdarma) drží token jako tajný klíč a vrací jen pohyby za období. Aplikace volá Worker s vlastním klíčem aplikace. | Funguje v dnešní PWA; token není v telefonu ani v GitHubu; Cloudflare účet už je (Střední volá) | Další malá služba; kdo zná adresu i klíč aplikace, vidí pohyby (klíč jen v telefonu, jde kdykoli změnit) |
| B. Nativní aplikace (APK, Capacitor) | Aplikace volá Fio přímo (nativní HTTP nemá CORS); token jen v telefonu | Bez serveru; zároveň otevře widget a notifikace (odložené v 2.1) | Větší práce; instalace APK místo PWA |
| C. Na vyžádání přes Clauda / skript v PC | `npm run fio` stáhne pohyby (token v souboru mimo repo) a vytvoří soubor k importu v telefonu | Nejrychlejší, bez serveru | Není automatické; soubor se do telefonu přenáší ručně |

## Doporučení: varianta A
1. **Uživatel (jednorázově, asi 5 minut):** v IB Fio založit token „Sledování účtu“ s automatickým
   prodlužováním. Token předat jen do Cloudflare (ne do chatu, ne do repa). Klidně ho tam vloží sám.
2. **Worker `najemnik-fio`:** `GET /pohyby?ucet=…&od=…&do=…` s hlavičkou `X-Klic: <klíč aplikace>`
   → zavolá Fio `periods` → vrátí jen potřebná pole (datum, částka, protiúčet, název protiúčtu, VS,
   zpráva, ID pohybu). Hlídá 30 s mezi dotazy. Odpovídá jen původu `https://czcri.github.io`.
3. **Aplikace:**
   - Nastavení → Moje účty → u účtu Fio „Napojit na Fio“ (adresa Workeru a klíč aplikace).
   - Import → tlačítko **„Načíst z Fio“** (aktuální a minulý měsíc) → stejný náhled jako u výpisu
     (jistě / návrhy / nepřiřazené, duplicity podle ID pohybu) → **potvrzení** → zápis.
   - Volitelně: při otevření aplikace načíst nové pohyby sám, nejvýš jednou za hodinu, jen do náhledu.
     Zapisuje se vždy až po potvrzení.
   - Upozornění 14 dní před koncem platnosti tokenu (odhad podle data napojení), pokud se mezitím
     nepřihlásíte do IB.
4. Ostatní banky (ČS, KB) zůstávají přes výpisy jako dnes.

## Odhad provedení (varianta A)

| Krok | Odhad |
|---|---|
| Worker (proxy, klíč aplikace, CORS, limit 30 s) + nasazení | 30 min |
| Převod odpovědi Fio na dnešní formát výpisu + testy (vymyšlená data) | 25 min |
| Aplikace: napojení v Nastavení, „Načíst z Fio“ v Importu | 40 min |
| Kouřový test (Worker podvržený), STAV.md, zveřejnění | 20 min |
| **Celkem** | **asi 2 h** |

## Otevřené otázky
1. Varianta A, B, nebo C?
2. Kolik účtů u Fio se má napojit (každý účet = vlastní token)?
3. Načítat automaticky při otevření aplikace, nebo jen tlačítkem?
