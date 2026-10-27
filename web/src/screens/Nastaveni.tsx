import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Database, Plus, Trash2 } from 'lucide-react';
import { AppShell, Card, Main, Nadpis, Pole, Tlacitko, VSTUP, useToast } from '../components/ui';
import { useData } from '../data/store';
import { VYCHOZI_SABLONY } from '../data/vychozi';
import { normalizujUcet } from '../lib/core';
import { datumCz, noveId } from '../lib/format';
import { ZNACKY, doplnSablonu } from '../lib/zpravy';
import type { Najemnik, Sablona } from '../types';

export const VERZE_APLIKACE = '2.0';

const UKAZKA: Najemnik = {
  id: 'x', jmeno: 'Jana Nováková', osloveni: 'paní Nováková', oznaceni: 'Byt 2 – Kolín', zacatek: '2026-01', konec: null,
  predpisy: [{ od: '2026-01', slozky: [{ nazev: 'Nájem', castka: 12000 }] }], vs: '1001',
};

export default function Nastaveni() {
  const { data, dnes, akce } = useData();
  const toast = useToast();
  const n = data.nastaveni;
  const [vybrana, setVybrana] = useState(n.sablony[0]?.id ?? '');
  const sablona = n.sablony.find(s => s.id === vybrana);
  const [ucet, setUcet] = useState({ ucet: '', nazev: '' });

  const ulozSablony = (sablony: Sablona[]) => akce.ulozNastaveni({ ...n, sablony });
  const upravSablonu = (zmena: Partial<Sablona>) => ulozSablony(n.sablony.map(s => (s.id === vybrana ? { ...s, ...zmena } : s)));

  function pridejSablonu() {
    const nova = { id: noveId(), nazev: 'Nová šablona', text: 'Dobrý den {osloveni}, ' };
    ulozSablony([...n.sablony, nova]);
    setVybrana(nova.id);
  }
  function smazSablonu() {
    if (!sablona || !confirm(`Smazat šablonu „${sablona.nazev}“?`)) return;
    const zbyle = n.sablony.filter(s => s.id !== vybrana);
    ulozSablony(zbyle);
    setVybrana(zbyle[0]?.id ?? '');
  }
  async function pridejUcet() {
    const u = normalizujUcet(ucet.ucet);
    if (!u.includes('/')) return toast('Číslo účtu ve tvaru 123456789/0800');
    if (n.ucty.some(x => x.ucet === u)) return toast('Účet už je v seznamu');
    const kod = u.split('/')[1];
    const banka = { '2010': 'Fio banka', '0800': 'Česká spořitelna', '0100': 'Komerční banka' }[kod] ?? `banka ${kod}`;
    await akce.ulozNastaveni({ ...n, ucty: [...n.ucty, { ucet: u, banka, nazev: ucet.nazev.trim() }] });
    setUcet({ ucet: '', nazev: '' });
  }

  return (
    <AppShell title="Nastavení" active="Nastavení">
      <Main>
        <Link to="/statistiky#zaloha" className="card-soft-2 flex items-center gap-3 p-4">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-status-ok-soft text-status-ok"><Database className="size-5" /></span>
          <span className="flex-1"><b className="block">Data a záloha</b>
            <span className="text-xs text-muted-foreground">Poslední záloha: {n.posledniZaloha ? datumCz(n.posledniZaloha) : 'zatím žádná'}</span></span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>

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
        {sablona && (
          <section className="card-soft-2 mt-4 space-y-3 p-4">
            <Pole label="Název"><input value={sablona.nazev} onChange={e => upravSablonu({ nazev: e.target.value })} className={VSTUP} /></Pole>
            <Pole label="Text">
              <textarea value={sablona.text} onChange={e => upravSablonu({ text: e.target.value })} rows={5} className="w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none focus:border-primary" />
            </Pole>
            <div className="flex flex-wrap gap-1.5">
              {ZNACKY.map(z => <button key={z} onClick={() => upravSablonu({ text: `${sablona.text}{${z}}` })} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{`{${z}}`}</button>)}
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Náhled</p>
              <p className="mt-1 rounded-2xl bg-status-ok-soft p-3 text-sm">{doplnSablonu(sablona.text, UKAZKA, { dluh: 12000, tentoMesic: 12000 }, dnes, n)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={smazSablonu} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-status-debt-soft text-sm font-bold text-status-debt"><Trash2 className="size-4" />Smazat</button>
              <button onClick={() => { if (confirm('Vrátit výchozí šablony? Vlastní úpravy se ztratí.')) { ulozSablony(VYCHOZI_SABLONY); setVybrana(VYCHOZI_SABLONY[0].id); } }}
                className="h-11 rounded-2xl bg-muted text-sm font-bold">Výchozí šablony</button>
            </div>
          </section>
        )}

        <Nadpis>Moje účty</Nadpis>
        <Card>
          {n.ucty.length === 0 && <p className="p-4 text-sm text-muted-foreground">Účty, kam vám chodí nájem. Import z banky je doplní sám.</p>}
          {n.ucty.map(u => (
            <div key={u.ucet} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <input value={u.nazev} placeholder={u.banka} onChange={e => akce.ulozNastaveni({ ...n, ucty: n.ucty.map(x => (x.ucet === u.ucet ? { ...x, nazev: e.target.value } : x)) })}
                  className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-foreground" />
                <p className="text-xs text-muted-foreground tabular">{u.ucet} · {u.banka}</p>
              </div>
              <button aria-label="Odebrat účet" onClick={() => confirm(`Odebrat účet ${u.ucet}?`) && akce.ulozNastaveni({ ...n, ucty: n.ucty.filter(x => x.ucet !== u.ucet) })}>
                <Trash2 className="size-4 text-muted-foreground" />
              </button>
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
                  <button aria-label="Zrušit pravidlo" onClick={() => akce.ulozNastaveni({ ...n, pravidla: { ...n.pravidla, nenajemUcty: n.pravidla.nenajemUcty.filter(x => x !== u) } })}>
                    <Trash2 className="size-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </Card>
          </>
        )}

        <Nadpis>Zabezpečení</Nadpis>
        <div className="card-soft-2 flex items-center justify-between p-4 opacity-60">
          <span><b className="block text-sm">Zámek aplikace (PIN / otisk)</b><span className="text-xs text-muted-foreground">Připravujeme</span></span>
          <span className="h-7 w-12 rounded-full bg-muted" />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">Nájemník {VERZE_APLIKACE} · data jsou uložena jen v tomto telefonu</p>
        <div className="h-4" />
        <Tlacitko typ="vedlejsi" onClick={() => location.reload()}>Načíst znovu</Tlacitko>
      </Main>
    </AppShell>
  );
}
