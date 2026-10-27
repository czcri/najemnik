# Prompt pro Lovable – design aplikace Nájemník

Vložit do Lovable jako první zprávu. Části v [hranatých závorkách] doplnit / smazat.

---

Navrhni mobilní webovou aplikaci **„Nájemník“** pro pronajímatele (jeden uživatel, Android telefon, šířka 360–430 px). Celé UI česky.

## Důležitá omezení
- **Jen frontend s ukázkovými daty.** Žádný backend, žádný Supabase, žádná databáze, žádné přihlášení, žádné API.
- Ukázková data dej do jednoho souboru `src/data/ukazka.ts`, typy do `src/types.ts` (viz níže). Výpočty neřeš – čísla (dluh, zaplaceno…) ber přímo z ukázkových dat.
- React + TypeScript + Tailwind, komponenty jednoduché a přehledné. Navigace mezi obrazovkami přes router.
- Mobil na prvním místě: velké dotykové plochy (min. 48 px), hlavní akce dosažitelné palcem dole.
- Světlý i tmavý režim podle systému.

## Účel
Pronajímatel si zapisuje nájemníky, kolik mají měsíčně platit a kdy co zaplatili. Aplikace ukazuje **kolik měl zaplatit vs. kolik zaplatil** a jestli dluží. Nájem naskočí 1. dne v měsíci, splatný je do konce měsíce. Nejčastější akce: **rychle zapsat platbu** (do 10 sekund).

## Stavy nájemníka (barevně odlišit, všude stejně)
- **Dluh po splatnosti** – nezaplacené ukončené měsíce (červená)
- **Tento měsíc ještě chybí** – běžící měsíc, ještě to není dluh (oranžová)
- **V pořádku** – vše zaplaceno (zelená)
- **Přeplatek** (modrá)

## Obrazovky
1. **Přehled (úvodní)**
   - Souhrn nahoře: celkový dluh po splatnosti + počet dlužníků; kolik tento měsíc ještě chybí.
   - Výzva „Tento měsíc ještě není záloha – Zálohovat“ (zobrazí se jen někdy).
   - Seznam nájemníků (do ~20): jméno, označení bydliště, stav s částkou. Dlužníci nahoře.
   - Sbalená sekce „Ukončené nájmy“.
   - Tlačítko „+ Nájemník“. Ikona nastavení.
2. **Detail nájemníka**
   - Jméno, označení bydliště, telefon (klikací), nájem „10 000 Kč měsíčně · od srpna 2026“.
   - Výrazně: **Měl zaplatit** vs. **Zaplatil** a výsledek (dluh / tento měsíc chybí / přeplatek / vše zaplaceno).
   - Velké tlačítko **+ Platba**.
   - Záložky **Platby** (datum, částka, poznámka; klepnutí = úprava) a **Měsíce** (měsíc, měl, zaplatil, průběžný rozdíl, stav – např. „chybí 5 000 Kč“ / ✓).
   - Akce: Změnit nájem, Upravit / ukončit nájem.
3. **Platba – nová / úprava**: datum (předvyplněno dnes), částka (předvyplněna nájmem, číselná klávesnice), poznámka (nepovinná), Uložit, u úpravy Smazat (s potvrzením).
4. **Nájemník – nový / úprava**: jméno, označení bydliště, začátek nájmu (měsíc/rok), nájem měsíčně (jen u nového), telefon, poznámka, u úpravy konec nájmu a Smazat.
5. **Změna nájmu**: od měsíce, nová částka, historie nájmu („od srpna 2026 – 10 000 Kč“). Text „Dřívější měsíce se nezmění.“
6. **Nastavení**: poslední záloha (datum), „Zálohovat do telefonu“, „Poslat zálohu jinam (e-mail, Disk…)“, „Obnovit ze zálohy“, info „Data jsou uložena jen v tomto telefonu“, verze.
7. Prázdné stavy (žádní nájemníci, žádné platby), chybové hlášky ve formulářích, krátké potvrzení „Platba uložena“.

## České formátování
- Částky celé koruny s pevnou mezerou: „12 500 Kč“.
- Datum „5. 10. 2026“, měsíc „říjen 2026“, s předložkou „od srpna 2026“.

## Typy (zachovat názvy polí)
```ts
export type Slozka = { nazev: string; castka: number };           // v pilotu jediná: „Nájem“
export type Predpis = { od: string /* 'RRRR-MM' */; slozky: Slozka[] };
export type Najemnik = {
  id: string; jmeno: string; oznaceni: string; telefon?: string; poznamka?: string;
  zacatek: string /* 'RRRR-MM' */; konec: string | null; predpisy: Predpis[];
};
export type Platba = { id: string; najemnikId: string; datum: string /* 'RRRR-MM-DD' */; castka: number; poznamka?: string };
export type Stav = 'dluh' | 'bezi' | 'ok' | 'preplatek';
```

## Ukázková data (dnes = 15. 10. 2026)
- Jana Nováková, „Byt 2 – Kolín“, nájem 12 000 Kč od 03/2026 → dluh 12 000 + tento měsíc 12 000
- Tomáš Dvořák, „Garsonka – Praha 4“, 8 500 Kč → tento měsíc chybí 8 500
- Eva Svobodová, „Byt 1 – Kolín“, 10 000 → 11 000 Kč od 10/2026 → v pořádku
- Martin Černý, „Dům Kutná Hora“, 15 000 Kč → přeplatek 3 000
- Petra Malá, „Byt 3“, ukončený nájem 06/2026, v pořádku
Ke každému 3–8 plateb s realistickými daty a občas poznámkou („hotově“, „doplatek“).

## Design
[Vyber / uprav:]
- Vzhled: klidný, moderní, důvěryhodný – „osobní finance“, ne korporátní účetnictví. Hodně vzduchu, zaoblené karty, výrazná čísla.
- Primární barva: [tmavě modrá / petrolejová / zelená / …]
- Inspirace: [např. Revolut, George, YNAB – nebo vlastní]
- [Další přání ke vzhledu]

## Změny funkcí oproti současné verzi
[Sem doplnit, co chceš jinak – nebo smazat.]
