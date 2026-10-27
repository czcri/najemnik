import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Bar, ComposedChart, ReferenceArea, ResponsiveContainer, Scatter, Tooltip, XAxis } from 'recharts';
import { Mail, MessageSquare, Pencil, Phone, Plus, Receipt, RefreshCw } from 'lucide-react';
import { AppShell, Card, Main, STAV_TEXT, ZpusobIkona } from '../components/ui';
import { FormNajem, FormNajemnik, FormPlatba, FormVydaj } from '../components/formulare';
import { PanelUpominky } from '../components/upominka';
import { useData } from '../data/store';
import { aktualniNajem, mesicZData, zpusobPlatby } from '../lib/core';
import { NazevMesice, datumCz, kc, kratkyMesic, odMesice } from '../lib/format';
import type { Najemnik, Platba, Vydaj } from '../types';

type Okno = { typ: 'platba'; platba?: Platba } | { typ: 'vydaj'; vydaj?: Vydaj } | { typ: 'najem' } | { typ: 'upravit' } | { typ: 'zprava' } | null;

const BANKY: Record<string, string> = { fio: 'Fio', cs: 'ČS', kb: 'KB' };
export function ZdrojStitek({ p }: { p: Platba }) {
  const z = p.zdroj;
  const [text, styl] = z?.typ === 'vypis' ? [`Výpis · ${BANKY[z.banka] ?? z.banka}`, 'bg-status-over-soft text-status-over']
    : z?.typ === 'hotove' ? ['Hotově', 'bg-status-ok-soft text-cash']
    : z?.typ === 'prevod' ? ['Převod – ručně', 'bg-muted text-muted-foreground']
    : ['Ručně', 'bg-muted text-muted-foreground'];
  return <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${styl}`}>{text}</span>;
}

function MalyGraf({ najemnik, platby }: { najemnik: Najemnik; platby: Platba[] }) {
  const { stav } = useData();
  const radky = stav(najemnik.id).radky.slice(-12);
  if (radky.length === 0) return null;
  const body = radky.map(r => {
    const vMesici = platby.filter(p => mesicZData(p.datum) === r.mesic);
    const ucet = vMesici.filter(p => zpusobPlatby(p, najemnik) === 'ucet').reduce((s, p) => s + p.castka, 0);
    return { mesic: r.mesic, popisek: kratkyMesic(r.mesic), ucet, hotove: r.zaplatil - ucet, mel: r.mel, dluh: r.stav === 'dluh' };
  });
  return (
    <section className="card-soft-2 mt-4 px-3 pt-4 pb-2">
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="text-sm font-bold">Měsíc po měsíci</p>
        <div className="flex gap-3 text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-bank" />účet</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-cash" />hotově</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-foreground/60" />měl</span>
        </div>
      </div>
      <div className="h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={body} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
            {body.filter(b => b.dluh).map(b => (
              <ReferenceArea key={b.mesic} x1={b.popisek} x2={b.popisek} fill="var(--status-debt)" fillOpacity={0.1} ifOverflow="extendDomain" />
            ))}
            <XAxis dataKey="popisek" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval={0} />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const b = payload[0].payload as (typeof body)[number];
              return <div className="rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background shadow-lg">
                {NazevMesice(b.mesic).split(' ')[0]}: měl {kc(b.mel)} · zaplatil {kc(b.ucet + b.hotove)}
              </div>;
            }} />
            <Bar dataKey="ucet" stackId="z" fill="var(--bank)" animationDuration={700} />
            <Bar dataKey="hotove" stackId="z" fill="var(--cash)" radius={[6, 6, 0, 0]} animationDuration={700} />
            <Scatter dataKey="mel" shape={(p: { cx?: number; cy?: number }) =>
              <rect x={(p.cx ?? 0) - 9} y={(p.cy ?? 0) - 1.5} width={18} height={3} rx={1.5} fill="var(--foreground)" opacity={0.55} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default function Detail() {
  const { id } = useParams();
  const { data, dnes, stav } = useData();
  const [okno, setOkno] = useState<Okno>(null);
  const [zalozka, setZalozka] = useState<'platby' | 'mesice' | 'vydaje'>('platby');
  const n = data.najemnici.find(x => x.id === id);
  if (!n) return <Navigate to="/najemnici" replace />;

  const s = stav(n.id);
  const platby = data.platby.filter(p => p.najemnikId === n.id).sort((a, b) => b.datum.localeCompare(a.datum));
  const vydaje = data.vydaje.filter(v => v.najemnikId === n.id).sort((a, b) => b.datum.localeCompare(a.datum));
  const mesic = mesicZData(dnes);
  const tento = s.radky.find(r => r.mesic === mesic);
  const zaplacenoTentoMesic = tento ? tento.mel - tento.chybi : 0;
  const posledniUpominka = data.upominky.filter(u => u.najemnikId === n.id).sort((a, b) => b.datum.localeCompare(a.datum))[0];

  const [hlavni, barva] = s.stav === 'dluh' ? [`Dluží ${kc(s.dluh)}`, STAV_TEXT.dluh]
    : s.stav === 'preplatek' ? [`Přeplatek ${kc(s.preplatek)}`, 'text-[oklch(0.8_0.1_250)]']
    : s.stav === 'bezi' ? [`Chybí ${kc(s.tentoMesic)}`, 'text-[oklch(0.82_0.14_65)]']
    : ['Vše zaplaceno', 'text-[oklch(0.8_0.12_162)]'];

  return (
    <AppShell title={n.jmeno} subtitle={n.oznaceni} active="Nájemníci"
      right={<button aria-label="Upravit" onClick={() => setOkno({ typ: 'upravit' })} className="flex size-12 shrink-0 items-center justify-center rounded-full card-soft"><Pencil className="size-5" /></button>}>
      <Main>
        <section className="card-navy p-5">
          <p className="text-sm opacity-70">Stav</p>
          <p className={`text-[32px] leading-tight font-extrabold tabular ${s.stav === 'dluh' ? 'text-[oklch(0.75_0.16_25)]' : barva}`}>{hlavni}</p>
          {s.stav === 'dluh' && s.tentoMesic > 0 && <p className="text-sm opacity-80">+ tento měsíc chybí {kc(s.tentoMesic)}</p>}
          {tento && <p className="mt-2 text-sm opacity-80 tabular">{NazevMesice(mesic).split(' ')[0]}: zaplaceno {kc(zaplacenoTentoMesic)} z {kc(tento.mel)}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs opacity-60">Měl zaplatit</p><p className="text-lg font-bold tabular">{kc(s.mel)}</p></div>
            <div className="rounded-2xl bg-white/5 p-3"><p className="text-xs opacity-60">Zaplatil</p><p className="text-lg font-bold tabular">{kc(s.zaplatil)}</p></div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs opacity-70">
            <ZpusobIkona m={n.zpusobPlaceni ?? 'ucet'} size="sm" />
            Nájem {kc(aktualniNajem(n, dnes))} měsíčně · od {odMesice(n.zacatek)}{n.konec ? ` do ${odMesice(n.konec)}` : ''}
          </p>
        </section>

        <MalyGraf najemnik={n} platby={platby} />

        <button onClick={() => setOkno({ typ: 'platba' })} className="card-hero mt-4 flex h-14 w-full items-center justify-center gap-2 text-base font-bold active:scale-[0.98]"><Plus className="size-5" />Platba</button>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-bold">
          <button onClick={() => setOkno({ typ: 'vydaj' })} className="card-soft-2 flex h-16 flex-col items-center justify-center gap-1"><Receipt className="size-5 text-primary" />Výdaj / dluh</button>
          <button onClick={() => setOkno({ typ: 'najem' })} className="card-soft-2 flex h-16 flex-col items-center justify-center gap-1"><RefreshCw className="size-5 text-primary" />Změnit nájem</button>
          <button onClick={() => setOkno({ typ: 'zprava' })} className="card-soft-2 flex h-16 flex-col items-center justify-center gap-1"><MessageSquare className="size-5 text-primary" />Zpráva</button>
        </div>

        {(n.telefon || n.email) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {n.telefon && <a href={`tel:${n.telefon.replace(/\s/g, '')}`} className="card-soft-2 flex h-12 items-center justify-center gap-2 text-sm font-bold text-primary"><Phone className="size-4" />{n.telefon}</a>}
            {n.email && <a href={`mailto:${n.email}`} className="card-soft-2 flex h-12 min-w-0 items-center justify-center gap-2 px-2 text-sm font-bold text-primary"><Mail className="size-4 shrink-0" /><span className="truncate">{n.email}</span></a>}
          </div>
        )}
        {(n.poznamkaDluh?.text || posledniUpominka) && (
          <p className="mt-3 px-2 text-xs text-muted-foreground">
            {n.poznamkaDluh?.text && <>📝 {n.poznamkaDluh.text} <span className="opacity-70">({datumCz(n.poznamkaDluh.datum)})</span><br /></>}
            {posledniUpominka && <>Poslední zpráva: {datumCz(posledniUpominka.datum)} ({posledniUpominka.kanal === 'sms' ? 'SMS' : posledniUpominka.kanal === 'whatsapp' ? 'WhatsApp' : 'e-mail'})</>}
          </p>
        )}

        <nav className="mt-6 grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1 text-sm font-bold">
          {([['platby', `Platby (${platby.length})`], ['mesice', 'Měsíce'], ['vydaje', `Výdaje (${vydaje.length})`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setZalozka(k)} className={`h-10 rounded-xl ${zalozka === k ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{l}</button>
          ))}
        </nav>

        {zalozka === 'platby' && (
          <Card className="mt-3">
            {platby.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Zatím žádná platba.</p>}
            {platby.map(p => (
              <button key={p.id} onClick={() => setOkno({ typ: 'platba', platba: p })} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{datumCz(p.datum)} <ZdrojStitek p={p} /></p>
                  {p.poznamka && <p className="truncate text-xs text-muted-foreground">{p.poznamka}</p>}
                </div>
                <p className="font-bold text-status-ok tabular">+{kc(p.castka)}</p>
              </button>
            ))}
          </Card>
        )}

        {zalozka === 'mesice' && (
          <>
            <Card className="mt-3">
              <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-2 px-4 py-2 text-[11px] font-bold text-muted-foreground">
                <span>Měsíc</span><span className="text-right">Měl</span><span className="text-right">Zaplatil</span><span className="text-right">Dluh kum.</span>
              </div>
              {[...s.radky].reverse().map(r => (
                <div key={r.mesic} className={`grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center gap-2 border-l-4 px-4 py-2.5 text-[13px] tabular ${r.stav === 'dluh' ? 'border-l-status-debt' : r.stav === 'bezi' ? 'border-l-status-due' : 'border-l-status-ok'}`}>
                  <span>
                    <span className="block font-semibold">{NazevMesice(r.mesic).split(' ')[0]} {r.mesic.slice(2, 4)}</span>
                    <span className={`block text-[11px] ${STAV_TEXT[r.stav]}`}>{r.chybi ? `chybí ${kc(r.chybi)}` : '✓'}{r.vydaj ? ` · výdaj ${kc(r.vydaj)}` : ''}</span>
                  </span>
                  <span className="text-right">{kc(r.mel)}</span>
                  <span className="text-right">{kc(r.zaplatil)}</span>
                  <span className={`text-right font-bold ${r.prubeznyRozdil > 0 ? 'text-status-debt' : r.prubeznyRozdil < 0 ? 'text-status-over' : 'text-status-ok'}`}>{kc(r.prubeznyRozdil)}</span>
                </div>
              ))}
              {s.radky.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nájem začne od {odMesice(n.zacatek)}.</p>}
            </Card>
            <p className="mt-2 px-2 text-xs text-muted-foreground">Zaplatil = platby s datem v daném měsíci. Dluh kum. = kolik k tomu měsíci celkem chybělo (záporný = přeplatek). Stav vlevo počítá i pozdější doplatky.</p>
          </>
        )}

        {zalozka === 'vydaje' && (
          <Card className="mt-3">
            {vydaje.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Žádné jednorázové výdaje ani dluhy.</p>}
            {vydaje.map(v => (
              <button key={v.id} onClick={() => setOkno({ typ: 'vydaj', vydaj: v })} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{v.popis}</p><p className="text-xs text-muted-foreground">{datumCz(v.datum)}</p></div>
                <p className="font-bold text-status-debt tabular">{kc(v.castka)}</p>
              </button>
            ))}
          </Card>
        )}
        {n.poznamka && <p className="mt-6 px-2 text-sm text-muted-foreground">{n.poznamka}</p>}
      </Main>

      {okno?.typ === 'platba' && <FormPlatba najemnik={n} platba={okno.platba} onClose={() => setOkno(null)} />}
      {okno?.typ === 'vydaj' && <FormVydaj najemnik={n} vydaj={okno.vydaj} onClose={() => setOkno(null)} />}
      {okno?.typ === 'najem' && <FormNajem najemnik={n} onClose={() => setOkno(null)} />}
      {okno?.typ === 'upravit' && <FormNajemnik najemnik={n} onClose={() => setOkno(null)} />}
      {okno?.typ === 'zprava' && <PanelUpominky najemnik={n} onClose={() => setOkno(null)} />}
    </AppShell>
  );
}
