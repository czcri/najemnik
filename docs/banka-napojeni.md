# Platby z banky – návod k napojení (Fio)

Každé ráno si služba `najemnik-banka` (Cloudflare, zdarma) stáhne z Fio příchozí platby za posledních
10 dní. Pak pošle do telefonu upozornění a aplikace po otevření ukáže „Z banky přišly N plateb“.
Jistě spárované platby zapíšete jedním potvrzením a nejisté přiřadíte ručně, jako u importu výpisu.

Služba má jen pohyby na účtu (než je aplikace zpracuje), data nájemníků zůstávají jen v telefonu.
Token Fio umí jen číst a je uložený jen v Cloudflare. Nikdy ho neposílejte do chatu ani nedávejte
do repozitáře (repozitář je veřejný).

## 1. Token ve Fio (asi 5 minut)
1. Přihlaste se do internetbankingu Fio **na webu** (ib.fio.cz).
2. **Nastavení → API → Přidat token.**
3. Účet: ten, na který chodí nájem.
4. Oprávnění: **Sledování účtu** (jen čtení). Druhou volbu (zadávání příkazů) nevybírejte.
5. Platnost: 180 dní a zaškrtněte **automatické prodlužování**. Pak se token prodlouží při každém
   přihlášení do Fio (web nebo Smartbanking).
6. Potvrďte SMS / push. Token začne fungovat **za 5 minut**.
7. Token zkopírujte (zobrazí se jen teď) a nechte ho ve schránce pro krok 3.

Máte víc účtů u Fio? Na každý účet založte vlastní token (krok 3 zopakujte s FIO_TOKEN_2, …).

## 2. Služba na Cloudflare (asi 5 minut, jednou)
Ve složce `najemnik` v terminálu:
```
npx wrangler@4 login          ← otevře prohlížeč, přihlaste se do Cloudflare a povolte přístup
npm run banka:priprav         ← založí úložiště, nasadí službu, vytvoří klíč aplikace
```
Příprava vytvoří soubor `banka/.local/odkaz-pro-telefon.txt` s odkazem pro napojení telefonu
(soubor není v gitu).

## 3. Vložení tokenu Fio
```
npm run banka:token           ← vložte token z kroku 1 (při psaní se nezobrazuje) a Enter
```
Další účet: `npx wrangler@4 secret put FIO_TOKEN_2 -c banka/wrangler.toml`

## 4. Napojení telefonu
1. Otevřete `banka/.local/odkaz-pro-telefon.txt` a odkaz pošlete do telefonu (třeba zprávou sám sobě).
2. V telefonu odkaz otevřete **v Chrome** (stejném, kde je Nájemník nainstalovaný na ploše).
3. Aplikace se zeptá „Napojit platby z banky?“ → **Napojit**.
4. Nastavení → Platby z banky → **Zapnout upozornění v telefonu** → povolit.
5. Zprávu s odkazem pak smažte (odkaz obsahuje klíč aplikace).

## Každý den
- Ráno přijde upozornění „Z banky přišly nové platby“ (jen když něco přišlo).
- Klepnutí → náhled: **Přiřazeno** (zapíše se), **Nepřiřazené** (vyberte nájemníka, nebo „Není nájem“).
- **Zapsat** → potvrdit. Platby mají štítek **„Z banky · Fio“**.
- Přeskočené platby zůstanou ve frontě na příště. Stejná platba se nikdy nezapíše dvakrát,
  ani když nahrajete i výpis.
- Kdykoli: Import → **Načíst z banky teď** (nejvýš 1× za minutu).

## Když něco nefunguje
- Přehled ukáže „Načítání z banky nefunguje“ s důvodem. Nejčastěji vypršel token, protože jste se 180 dní
  nepřihlásil do Fio. Založte nový token (krok 1) a vložte ho znovu (krok 3).
- Odpojení: Nastavení → Platby z banky → Odpojit. Služba na Cloudflare tím nezanikne, smaže se
  v Cloudflare (Workers → najemnik-banka → Delete).
