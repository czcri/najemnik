import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Download, Share2, Upload } from 'lucide-react';
import { AppShell, Card, Chip, Main, Nadpis, Prepinac, VolbaMesice, ZpusobIkona, useToast } from '../components/ui';
import { useData } from '../data/store';
import { mesicZData, statistiky } from '../lib/core';
import { NazevMesice, datumCz, kc, kratkyMesic, posunMesic } from '../lib/format';
import { lzeSdilet, prectiZalohu, sdilejZalohu, stahniZalohu } from '../lib/zaloha';
import { ZALOHA_PO_DNECH, zalohaStara } from './Prehled';

type Obdobi = 'mesic' | 'rok' | '12' | 'vlastni';
const kcKratce = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)} tis.` : String(n));

function GrafKarta({ nadpis, children, legenda }: { nadpis: string; children: ReactNode; legenda?: ReactNode }) {
  return (
    <section className="card-soft-2 mt-4 p-4">
      <h2 className="px-1 font-bold">{nadpis}</h2>
      <div className="mt-3 h-48">{children}</div>
      {legenda && <div className="mt-3 flex flex-wrap gap-4 px-1 text-xs font-semibold text-muted-foreground">{legenda}</div>}
    </section>
  );
}
const Leg = ({ barva, text, cara }: { barva: string; text: string; cara?: boolean }) =>
  <span className="flex items-center gap-1.5">{cara ? <span className="w-4 border-t-2 border-dashed" style={{ borderColor: barva }} /> : <span className="size-2.5 rounded-sm" style={{ background: barva }} />}{text}</span>;

const bublina = (radky: (p: Record<string, number | string>) => ReactNode) => ({ active, payload }: TooltipProps<ValueType, NameType>) =>
  active && payload?.length ? <div className="rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background shadow-lg">{radky(payload[0].payload as Record<string, number | string>)}</div> : null;

export default function Statistiky() {
  const { data, dnes } = useData();
  const mesic = mesicZData(dnes);
  const [obdobi, setObdobi] = useState<Obdobi>('12');
  const [vybranyMesic, setVybranyMesic] = useState(mesic);
  const [od, setOd] = useState(posunMesic(mesic, -11));
  const [doM, setDoM] = useState(mesic);
  const [zpusob, setZpusob] = useState<'vse' | 'ucet' | 'hotove'>('vse');
  const [oznaceni, setOznaceni] = useState('');
  const [razeni, setRazeni] = useState<'prijato' | 'dluh' | 'jmeno'>('prijato');

  const rozsah = obdobi === 'mesic' ? [vybranyMesic, vybranyMesic] : obdobi === 'rok' ? [`${mesic.slice(0, 4)}-01`, mesic] : obdobi === '12' ? [posunMesic(mesic, -11), mesic] : [od, doM];
  // Začít až prvním měsícem, kdy něco běželo (prázdné měsíce na začátku jen zabírají místo).
  const prvni = data.najemnici.map(n => n.zacatek).sort()[0] ?? mesic;
  const zacatek = rozsah[0] < prvni ? prvni : rozsah[0];
  const st = statistiky(data, zacatek, rozsah[1], dnes, { zpusob, oznaceni: oznaceni || null });
  const body = st.mesice.map(m => ({ ...m, popisek: kratkyMesic(m.mesic) }));
  const nemovitosti = [...new Set(data.najemnici.map(n => n.oznaceni))].sort((a, b) => a.localeCompare(b, 'cs'));
  const tabulka = [...st.podleNajemniku].sort((a, b) => razeni === 'jmeno' ? a.najemnik.jmeno.localeCompare(b.najemnik.jmeno, 'cs') : b[razeni] - a[razeni]);
  const kolac = [{ k: 'Na účet', v: st.prijatoUcet, c: 'var(--bank)' }, { k: 'Hotově', v: st.prijatoHotove, c: 'var(--cash)' }].filter(x => x.v > 0);

  return (
    <AppShell title="Statistiky" subtitle={body.length === 1 ? NazevMesice(body[0].mesic) : body.length ? `${NazevMesice(body[0].mesic)} – ${NazevMesice(body.at(-1)!.mesic)}` : ''}>
      <Main>
        <div className="sticky top-0 z-[5] -mx-4 space-y-2 bg-background/90 px-4 pt-1 pb-3 backdrop-blur">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {([['mesic', 'Měsíc'], ['12', '12 měsíců'], ['rok', 'Tento rok'], ['vlastni', 'Vlastní']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setObdobi(k)} className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold ${obdobi === k ? 'bg-foreground text-background' : 'card-soft text-muted-foreground'}`}>{l}</button>
            ))}
            {nemovitosti.length > 1 && (
              <select value={oznaceni} onChange={e => setOznaceni(e.target.value)} className="card-soft h-9 shrink-0 rounded-full px-3 text-sm font-semibold text-muted-foreground outline-none">
                <option value="">Všechny nemovitosti</option>
                {nemovitosti.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            )}
          </div>
          {obdobi === 'mesic' && <VolbaMesice hodnota={vybranyMesic} min={prvni} max={mesic} onChange={setVybranyMesic} kompaktni />}
          {obdobi === 'vlastni' && (
            <div className="grid grid-cols-2 gap-2">
              <input type="month" value={od} onChange={e => setOd(e.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-sm" />
              <input type="month" value={doM} onChange={e => setDoM(e.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-sm" />
            </div>
          )}
          <Prepinac hodnota={zpusob} onChange={setZpusob} volby={[{ k: 'vse', l: 'Vše' }, { k: 'ucet', l: 'Na účet' }, { k: 'hotove', l: 'Hotově' }]} />
        </div>

        <section className="card-navy p-5">
          <p className="text-sm opacity-70">Přišlo za období</p>
          <p className="text-[34px] leading-tight font-extrabold tabular">{kc(st.prijato)}</p>
          {zpusob === 'vse' && <p className="mt-1 text-xs opacity-80 tabular">na účet {kc(st.prijatoUcet)} · hotově {kc(st.prijatoHotove)}</p>}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/5 p-2.5"><p className="text-[11px] opacity-60">Očekáváno</p><p className="text-sm font-bold tabular">{kc(st.ocekavano)}</p></div>
            <div className="rounded-2xl bg-white/5 p-2.5"><p className="text-[11px] opacity-60">Vybráno</p><p className="text-sm font-bold tabular">{st.uspesnost === null ? '—' : `${Math.round(st.uspesnost * 100)} %`}</p></div>
            <div className="rounded-2xl bg-white/5 p-2.5"><p className="text-[11px] opacity-60">Po splatnosti</p><p className={`text-sm font-bold tabular ${st.dluh ? 'text-[oklch(0.75_0.16_25)]' : ''}`}>{kc(st.dluh)}</p></div>
          </div>
        </section>

        {body.length === 0 ? <p className="card-soft-2 mt-4 p-8 text-center text-sm text-muted-foreground">Pro zvolené období nejsou data.</p> : <>
          <GrafKarta nadpis="Příjmy po měsících" legenda={<>
            {zpusob !== 'hotove' && <Leg barva="var(--bank)" text="Na účet" />}
            {zpusob !== 'ucet' && <Leg barva="var(--cash)" text="Hotově" />}
            <Leg barva="var(--muted-foreground)" text="Očekáváno" cara />
          </>}>
            <ResponsiveContainer>
              <ComposedChart data={body} margin={{ top: 4, right: 0, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="popisek" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tickFormatter={kcKratce} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} width={48} />
                <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={bublina(p => <>{NazevMesice(String(p.mesic))}<br />přišlo {kc(Number(p.prijato))} z {kc(Number(p.ocekavano))}<br />účet {kc(Number(p.ucet))} · hotově {kc(Number(p.hotove))}</>)} />
                <Bar dataKey="ucet" stackId="p" fill="var(--bank)" />
                <Bar dataKey="hotove" stackId="p" fill="var(--cash)" radius={[6, 6, 0, 0]} />
                <Line dataKey="ocekavano" stroke="var(--muted-foreground)" strokeDasharray="5 4" strokeWidth={2} dot={false} type="stepAfter" />
              </ComposedChart>
            </ResponsiveContainer>
          </GrafKarta>

          {zpusob === 'vse' && kolac.length > 0 && (
            <section className="card-soft-2 mt-4 flex items-center gap-4 p-4">
              <div className="size-32 shrink-0">
                <ResponsiveContainer>
                  <PieChart><Pie data={kolac} dataKey="v" nameKey="k" innerRadius="62%" outerRadius="100%" paddingAngle={kolac.length > 1 ? 3 : 0} stroke="none">
                    {kolac.map(x => <Cell key={x.k} fill={x.c} />)}
                  </Pie></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                <h2 className="font-bold">Hotově vs. na účet</h2>
                {[{ k: 'Na účet', v: st.prijatoUcet, c: 'var(--bank)' }, { k: 'Hotově', v: st.prijatoHotove, c: 'var(--cash)' }].map(x => (
                  <div key={x.k}>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><span className="size-2.5 rounded-sm" style={{ background: x.c }} />{x.k}</p>
                    <p className="text-sm font-bold tabular">{kc(x.v)} <span className="font-semibold text-muted-foreground">· {st.prijato ? Math.round((x.v / st.prijato) * 100) : 0} %</span></p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <GrafKarta nadpis="Vývoj dluhu" legenda={<span>Dluh po splatnosti na konci každého měsíce (u běžícího k dnešku)</span>}>
            <ResponsiveContainer>
              <LineChart data={body} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="popisek" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tickFormatter={kcKratce} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} width={48} />
                <Tooltip content={bublina(p => <>{NazevMesice(String(p.mesic))}: dluh {kc(Number(p.dluh))}</>)} />
                <Line dataKey="dluh" stroke="var(--status-debt)" strokeWidth={3} dot={{ r: 3, fill: 'var(--status-debt)' }} type="linear" />
              </LineChart>
            </ResponsiveContainer>
          </GrafKarta>

          {body.some(m => m.vcas + m.pozde + m.vubec > 0) && (
            <GrafKarta nadpis="Dochvilnost" legenda={<><Leg barva="var(--status-ok)" text="Včas" /><Leg barva="var(--status-due)" text="Pozdě" /><Leg barva="var(--status-debt)" text="Dosud ne" /></>}>
              <ResponsiveContainer>
                <BarChart data={body.filter(m => m.mesic < mesic)} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="popisek" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} width={40} />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={bublina(p => <>{NazevMesice(String(p.mesic))}: včas {p.vcas} · pozdě {p.pozde} · dosud ne {p.vubec}</>)} />
                  <Bar dataKey="vcas" stackId="d" fill="var(--status-ok)" />
                  <Bar dataKey="pozde" stackId="d" fill="var(--status-due)" />
                  <Bar dataKey="vubec" stackId="d" fill="var(--status-debt)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GrafKarta>
          )}

          <Nadpis>Podle nájemníků</Nadpis>
          <Card>
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-[11px] font-bold text-muted-foreground">
              <button className="text-left" onClick={() => setRazeni('jmeno')}>Nájemník{razeni === 'jmeno' && ' ↓'}</button>
              <button className="w-20 text-right" onClick={() => setRazeni('prijato')}>Přijato{razeni === 'prijato' && ' ↓'}</button>
              <button className="w-20 text-right" onClick={() => setRazeni('dluh')}>Dluh{razeni === 'dluh' && ' ↓'}</button>
            </div>
            {tabulka.map(r => (
              <Link key={r.najemnik.id} to={`/najemnici/${r.najemnik.id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 active:bg-muted">
                <span className="flex min-w-0 items-center gap-2"><ZpusobIkona m={r.najemnik.zpusobPlaceni ?? 'ucet'} size="sm" /><span className="truncate text-sm font-semibold">{r.najemnik.jmeno}</span></span>
                <span className="w-20 text-right text-sm font-bold tabular">{kc(r.prijato)}</span>
                <span className="w-20 text-right">{r.dluh ? <Chip stav="dluh">{kc(r.dluh)}</Chip> : <span className="text-xs text-muted-foreground">—</span>}</span>
              </Link>
            ))}
          </Card>
        </>}

        <Zaloha />
      </Main>
    </AppShell>
  );
}

function Zaloha() {
  const { data, dnes, akce } = useData();
  const toast = useToast();
  const stara = zalohaStara(data.nastaveni.posledniZaloha, dnes, data.najemnici.length > 0);
  const oznac = () => akce.ulozNastaveni({ ...data.nastaveni, posledniZaloha: dnes });

  async function obnov(f: File | undefined) {
    if (!f) return;
    try {
      const { data: z, varovani } = await prectiZalohu(f);
      const pocty = (d: typeof z) => `${d.najemnici.length} nájemníků, ${d.platby.length} plateb, ${d.vydaje.length} výdajů, ${d.upominky.length} upomínek`;
      if (!confirm(`Obnovit ze zálohy ${f.name}?\n\nV záloze: ${pocty(z)} + nastavení (šablony, účty).\nTeď v telefonu: ${pocty(data)}.\n\nSoučasná data se NAHRADÍ. Před obnovou se jejich záloha automaticky uloží do Stažených souborů.${varovani.length ? `\n\nPozor: ${varovani.join(' ')}` : ''}`)) return;
      if (data.najemnici.length || data.platby.length) stahniZalohu(data);
      await akce.nahradVse(z);
      toast('Data obnovena ze zálohy');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section id="zaloha" className={`mt-8 rounded-[24px] p-5 ${stara ? 'bg-status-due-soft' : 'card-soft-2'}`}>
      <h2 className="font-extrabold">Data a záloha</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Poslední záloha: <b className={stara ? 'text-status-due' : 'text-foreground'}>{data.nastaveni.posledniZaloha ? datumCz(data.nastaveni.posledniZaloha) : 'zatím žádná'}</b>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Data jsou uložena jen v tomto telefonu. Zálohujte aspoň jednou za 2–3 měsíce{stara ? ` – připomínka se ukazuje po ${ZALOHA_PO_DNECH} dnech` : ''}.</p>
      <div className="mt-4 space-y-2">
        <button onClick={async () => { stahniZalohu(data); await oznac(); toast('Záloha uložena do Stažených souborů'); }}
          className="card-hero flex h-14 w-full items-center justify-center gap-2 font-bold"><Download className="size-5" />Zálohovat do telefonu</button>
        {lzeSdilet() && (
          <button onClick={async () => { try { if (await sdilejZalohu(data)) { await oznac(); toast('Záloha odeslána'); } } catch { toast('Sdílení se nepodařilo'); } }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-muted font-bold"><Share2 className="size-4" />Poslat zálohu jinam (e-mail, Disk…)</button>
        )}
        <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-muted font-bold">
          <Upload className="size-4" />Obnovit ze zálohy
          <input type="file" accept=".json,application/json" className="hidden" onChange={e => { obnov(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Obnova nahradí všechna současná data obsahem zálohy. Záloha v telefonu chrání před smazáním dat aplikace; proti ztrátě telefonu občas pošlete zálohu jinam.</p>
      <p className="mt-2 text-xs text-muted-foreground">{data.najemnici.length} nájemníků · {data.platby.length} plateb · {data.vydaje.length} výdajů</p>
    </section>
  );
}

