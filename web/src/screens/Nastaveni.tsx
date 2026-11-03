import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Check, ChevronRight, Database, Download, Plus, Trash2 } from 'lucide-react';
import { AppShell, Card, Main, Nadpis, Panel, Pole, Tlacitko, VSTUP, usePotvrzeni, useToast, zmeny } from '../components/ui';
import { LogoSimplySoftware } from '../components/logo';
import { Zaloha } from '../components/Zaloha';
import { useData } from '../data/store';
import { VYCHOZI_SABLONY } from '../data/vychozi';
import { aktualniNajem, icsHotovosti, mesicZData, normalizujUcet, odkazKalendare, prvniVyskyt } from '../lib/core';
import { datumCz, kc, noveId, posunMesic } from '../lib/format';
import { ZNACKY, doplnSablonu } from '../lib/zpravy';
import type { Najemnik, Sablona } from '../types';

export const VERZE_APLIKACE = '2.13';

const UKAZKA: Najemnik = {
  id: 'x', jmeno: 'Jana Nováková', osloveni: 'paní Nováková', oznaceni: 'Byt 2 – Kolín', zacatek: '2026-01', konec: null,
  predpisy: [{ od: '2026-01', slozky: [{ nazev: 'Nájem', castka: 12000 }] }], vs: '1001',
};

export default function Nastaveni() {
  const { data, dnes, akce } = useData();
  const toast = useToast();
  const potvrd = usePotvrzeni();
  const n = data.nastaveni;
  const [vybrana, setVybrana] = useState(n.sablony[0]?.id ?? '');
  const sablona = n.sablony.find(s => s.id === vybrana);
  const [ucet, setUcet] = useState({ ucet: '', nazev: '' });
  // Úpravy šablony a názvů účtů se drží jen ve formuláři; uloží se až tlačítkem Uložit po potvrzení.
  const [koncept, setKoncept] = useState<Sablona | null>(null);
  const upravovana = koncept?.id === vybrana ? koncept : sablona;
  const zmenena = !!koncept && koncept.id === vybrana && (koncept.nazev !== sablona?.nazev || koncept.text !== sablona?.text);
  const [nazvy, setNazvy] = useState<Record<string, string>>({});

  const ulozSablony = (sablony: Sablona[]) => akce.ulozNastaveni({ ...n, sablony });
  const upravSablonu = (zmena: Partial<Sablona>) => upravovana && setKoncept({ ...upravovana, ...zmena });

  async function ulozSablonu() {
    if (!koncept || !sablona || !zmenena) return;
    const radky = zmeny(sablona, koncept, [{ l: 'Název', v: s => s.nazev }, { l: 'Text', v: s => s.text }]);
    if (!await potvrd({ nadpis: 'Uložit šablonu?', radky })) return;
    await ulozSablony(n.sablony.map(s => (s.id === koncept.id ? koncept : s)));
    setKoncept(null);
    toast('Šablona uložena');
  }
  async function pridejSablonu() {
    const nova = { id: noveId(), nazev: 'Nová šablona', text: 'Dobrý den {osloveni}, ' };
    if (!await potvrd({ nadpis: 'Přidat šablonu?', radky: [{ l: 'Název', po: nova.nazev }], tlacitko: 'Přidat šablonu' })) return;
    await ulozSablony([...n.sablony, nova]);
    setVybrana(nova.id);
  }
  async function smazSablonu() {
    if (!sablona || !await potvrd({ nadpis: 'Smazat šablonu?', radky: [{ l: 'Šablona', po: sablona.nazev }], tlacitko: 'Smazat šablonu', nebezpecne: true })) return;
    const zbyle = n.sablony.filter(s => s.id !== vybrana);
    await ulozSablony(zbyle);
    setKoncept(null);
    setVybrana(zbyle[0]?.id ?? '');
  }
  async function vychoziSablony() {
    if (!await potvrd({ nadpis: 'Vrátit výchozí šablony?', text: 'Vlastní šablony a jejich úpravy se ztratí.', tlacitko: 'Vrátit výchozí', nebezpecne: true })) return;
    await ulozSablony(VYCHOZI_SABLONY);
    setKoncept(null);
    setVybrana(VYCHOZI_SABLONY[0].id);
  }
  async function pridejUcet() {
    const u = normalizujUcet(ucet.ucet);
    if (!u.includes('/')) return toast('Číslo účtu ve tvaru 123456789/0800');
    if (n.ucty.some(x => x.ucet === u)) return toast('Účet už je v seznamu');
    const kod = u.split('/')[1];
    const banka = { '2010': 'Fio banka', '0800': 'Česká spořitelna', '0100': 'Komerční banka' }[kod] ?? `banka ${kod}`;
    const novy = { ucet: u, banka, nazev: ucet.nazev.trim() };
    if (!await potvrd({ nadpis: 'Přidat můj účet?', radky: zmeny(undefined, novy, [{ l: 'Účet', v: x => x.ucet }, { l: 'Banka', v: x => x.banka }, { l: 'Název', v: x => x.nazev }]) })) return;
    await akce.ulozNastaveni({ ...n, ucty: [...n.ucty, novy] });
    setUcet({ ucet: '', nazev: '' });
  }
  async function ulozNazevUctu(u: { ucet: string; nazev: string }) {
    const novy = (nazvy[u.ucet] ?? u.nazev).trim();
    if (!await potvrd({ nadpis: 'Uložit název účtu?', radky: [{ l: u.ucet, pred: u.nazev || '—', po: novy || '—' }] })) return;
    await akce.ulozNastaveni({ ...n, ucty: n.ucty.map(x => (x.ucet === u.ucet ? { ...x, nazev: novy } : x)) });
    setNazvy(({ [u.ucet]: _, ...zbytek }) => zbytek);
  }
  async function odeberUcet(u: string) {
    if (!await potvrd({ nadpis: 'Odebrat účet?', radky: [{ l: 'Účet', po: u }], tlacitko: 'Odebrat účet', nebezpecne: true })) return;
    await akce.ulozNastaveni({ ...n, ucty: n.ucty.filter(x => x.ucet !== u) });
  }
  async function zrusPravidlo(u: string) {
    if (!await potvrd({ nadpis: 'Zrušit pravidlo „není nájem“?', text: 'Platby z tohoto účtu se budou znovu nabízet k přiřazení.', radky: [{ l: 'Účet plátce', po: u }], tlacitko: 'Zrušit pravidlo' })) return;
    await akce.ulozNastaveni({ ...n, pravidla: { ...n.pravidla, nenajemUcty: n.pravidla.nenajemUcty.filter(x => x !== u) } });
  }

  return (
    <AppShell title="Nastavení">
      <Main>
        <Zaloha />

        <Nadpis>Šablony zpráv</Nadpis>
        <Card>
          {n.sablony.map(s => (
            <button key={s.id} onClick={() => setVybrana(s.id)} className={`block w-full px-4 py-3 text-left ${s.id === vybrana ? 'bg-primary-soft' : ''}`}>
              <p className="text-[15px] font-bold">{s.nazev}</p>
              <p className="truncate text-xs text-muted-foreground">{s.text}</p>
            </button>
          ))}
          <button onClick={pridejSablonu} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-primary"><Plus className="size-4" />Nová šablona</button>
        </Card>
        {upravovana && (
          <section className="card-soft-2 mt-4 space-y-3 p-4">
            <Pole label="Název"><input value={upravovana.nazev} onChange={e => upravSablonu({ nazev: e.target.value })} className={VSTUP} /></Pole>
            <Pole label="Text">
              <textarea value={upravovana.text} onChange={e => upravSablonu({ text: e.target.value })} rows={5} className="w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary" />
            </Pole>
            <div className="flex flex-wrap gap-1.5">
              {ZNACKY.map(z => <button key={z} onClick={() => upravSablonu({ text: `${upravovana.text}{${z}}` })} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{`{${z}}`}</button>)}
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Náhled</p>
              <p className="mt-1 rounded-2xl bg-status-ok-soft p-3 text-sm">{doplnSablonu(upravovana.text, UKAZKA, { dluh: 12000, tentoMesic: 12000 }, dnes, n)}</p>
            </div>
            {zmenena && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={ulozSablonu} className="card-hero flex h-11 items-center justify-center gap-2 text-sm font-bold"><Check className="size-4" />Uložit šablonu</button>
                <button onClick={() => setKoncept(null)} className="h-11 rounded-2xl bg-muted text-sm font-bold">Zrušit úpravy</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={smazSablonu} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-status-debt-soft text-sm font-bold text-status-debt"><Trash2 className="size-4" />Smazat</button>
              <button onClick={vychoziSablony} className="h-11 rounded-2xl bg-muted text-sm font-bold">Výchozí šablony</button>
            </div>
          </section>
        )}

        <Kalendar />

        <Nadpis>Moje účty</Nadpis>
        <Card>
          {n.ucty.length === 0 && <p className="p-4 text-sm text-muted-foreground">Účty, kam vám chodí nájem. Import z banky je doplní sám.</p>}
          {n.ucty.map(u => (
            <div key={u.ucet} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <input value={nazvy[u.ucet] ?? u.nazev} placeholder={u.banka} onChange={e => setNazvy({ ...nazvy, [u.ucet]: e.target.value })}
                  className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-foreground" />
                <p className="text-xs text-muted-foreground tabular">{u.ucet} · {u.banka}</p>
              </div>
              {nazvy[u.ucet] !== undefined && nazvy[u.ucet].trim() !== u.nazev
                ? <button aria-label="Uložit název účtu" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" onClick={() => ulozNazevUctu(u)}>
                    <Check className="size-5" />
                  </button>
                : <button aria-label="Odebrat účet" className="flex size-11 shrink-0 items-center justify-center rounded-xl active:bg-muted" onClick={() => odeberUcet(u.ucet)}>
                    <Trash2 className="size-5 text-muted-foreground" />
                  </button>}
            </div>
          ))}
        </Card>
        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
          <input value={ucet.ucet} onChange={e => setUcet({ ...ucet, ucet: e.target.value })} placeholder="123456789/2010" className={VSTUP} />
          <input value={ucet.nazev} onChange={e => setUcet({ ...ucet, nazev: e.target.value })} placeholder="Název (nepovinné)" className={VSTUP} />
          <button onClick={pridejUcet} aria-label="Přidat účet" className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Plus className="size-5" /></button>
        </div>
        {n.pravidla.nenajemUcty.length > 0 && (
          <>
            <Nadpis>Plátci „není nájem“</Nadpis>
            <Card>
              {n.pravidla.nenajemUcty.map(u => (
                <div key={u} className="flex items-center gap-3 px-4 py-3 text-sm tabular">
                  <span className="flex-1">{u}</span>
                  <button aria-label="Zrušit pravidlo" className="flex size-11 shrink-0 items-center justify-center rounded-xl active:bg-muted" onClick={() => zrusPravidlo(u)}>
                    <Trash2 className="size-5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </Card>
          </>
        )}

        <Ulozeni />

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-muted-foreground">Nájemník {VERZE_APLIKACE} · data jsou uložena jen v tomto telefonu</p>
          <p className="mt-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Vytvořilo</p>
          <LogoSimplySoftware className="block h-10" />
        </div>
        <div className="h-4" />
        <Tlacitko typ="vedlejsi" onClick={() => location.reload()}>Načíst znovu (načte novou verzi)</Tlacitko>
      </Main>
    </AppShell>
  );
}

// Připomínky hotovosti v kalendáři telefonu (upozornění dělá kalendář, aplikace nepotřebuje server).
function Kalendar() {
  const { data, dnes } = useData();
  const hotovostni = data.najemnici
    .filter(n => n.zpusobPlaceni === 'hotove' && Number.isInteger(n.denHotovosti) && (!n.konec || n.konec >= mesicZData(dnes)))
    .sort((a, b) => a.denHotovosti! - b.denHotovosti!);
  // První výskyt: tento měsíc, pokud den ještě nebyl, jinak příští (31. = poslední den měsíce).
  const prvni = (den: number) => prvniVyskyt(den, dnes);
  function stahniIcs() {
    const text = icsHotovosti(hotovostni.map(n => ({ najemnik: n, castka: aktualniNajem(n, dnes) })), dnes,
      new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/calendar' })), download: 'najemnik-hotovost.ics' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  return (
    <>
      <Nadpis>Připomínky hotovosti v kalendáři</Nadpis>
      <Card>
        {hotovostni.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nájemníkům, kteří platí hotově, vyplňte v profilu „Hotovost čekám k (den v měsíci)“.</p>}
        {hotovostni.map(n => (
          <a key={n.id} href={odkazKalendare(n, aktualniNajem(n, dnes), prvni(n.denHotovosti!))} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 px-4 py-3 active:bg-muted">
            <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-status-ok-soft text-cash">
              <span className="text-sm leading-none font-extrabold">{n.denHotovosti}.</span>
            </span>
            <span className="min-w-0 flex-1"><b className="block truncate text-sm">{n.jmeno}</b><span className="text-xs text-muted-foreground">každý měsíc · {kc(aktualniNajem(n, dnes))}</span></span>
            <CalendarPlus className="size-5 text-primary" />
          </a>
        ))}
      </Card>
      {hotovostni.length > 0 && (
        <>
          <p className="mt-2 px-2 text-xs text-muted-foreground">Klepnutím otevřete Google Kalendář s opakovanou událostí – stačí uložit. Při změně dne nebo částky událost upravte i v kalendáři. Událost (jméno a částka) se uloží do vašeho Google účtu.</p>
          <button onClick={stahniIcs} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-muted text-sm font-bold"><Download className="size-4" />Vše jako soubor .ics (jiný kalendář)</button>
        </>
      )}
    </>
  );
}

export function PanelOAplikaci({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="O aplikaci" onClose={onClose}>
      <div className="flex flex-col items-center pb-2 text-center">
        <img src="ikony/ikona-192.png" alt="" className="size-20 rounded-3xl shadow-lg" />
        <p className="mt-4 text-2xl font-extrabold">Nájemník</p>
        <p className="text-sm text-muted-foreground">verze {VERZE_APLIKACE}</p>
        <p className="mt-3 text-sm text-muted-foreground">Nájemníci, nájem a platby. Data jsou uložena jen v tomto telefonu.</p>
        <p className="mt-8 mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Vytvořilo</p>
        <LogoSimplySoftware varianta="pod" className="block h-20" />
      </div>
    </Panel>
  );
}

// Stav úložiště: zda Chrome data trvale drží (nesmaže je při nedostatku místa).
function Ulozeni() {
  const [trvale, setTrvale] = useState<boolean | null>(null);
  useEffect(() => { navigator.storage?.persisted?.().then(setTrvale).catch(() => setTrvale(null)); }, []);
  if (trvale === null) return null;
  return (
    <p className={`mt-6 rounded-2xl p-3 text-xs ${trvale ? 'bg-status-ok-soft text-status-ok' : 'bg-status-due-soft text-status-due'}`}>
      {trvale ? 'Úložiště v telefonu je trvalé – Chrome data sám nesmaže.' : 'Chrome zatím nepovolil trvalé úložiště (obvykle až po instalaci na plochu a delším používání). Pravidelně zálohujte.'}
    </p>
  );
}
