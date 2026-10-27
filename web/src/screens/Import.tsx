import { useState, type ReactNode } from 'react';
import { CheckCircle2, FileText, FileUp } from 'lucide-react';
import { AppShell, Card, Chyba, Main, Nadpis, Tlacitko, useToast } from '../components/ui';
import { useData } from '../data/store';
import {
  jePdf, nactiCsvVypis, nactiKbPdf, prevedImport, sparuj, vychoziRozhodnuti,
  type Rozhodnuti, type Vypis, type VysledekParovani,
} from '../lib/core';
import { datumCz, datumKratce, kc, noveId, pocet } from '../lib/format';
import type { MujUcet, Najemnik, Platba } from '../types';

const BANKY: Record<string, string> = { fio: 'Fio banka', cs: 'Česká spořitelna', kb: 'Komerční banka' };
type Soubor = { nazev: string; vypis: Vypis | null; chyba?: string };

async function strankyPdf(bajty: Uint8Array) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: bajty }).promise;
  const stranky = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const obsah = await (await doc.getPage(i)).getTextContent();
    stranky.push(obsah.items.flatMap(p => ('str' in p ? [{ x: p.transform[4], y: p.transform[5], str: p.str }] : [])));
  }
  return stranky;
}

async function prectiSoubor(f: File): Promise<Soubor> {
  try {
    const bajty = new Uint8Array(await f.arrayBuffer());
    const vypis = jePdf(bajty) ? nactiKbPdf(await strankyPdf(bajty)) : nactiCsvVypis(bajty, f.name);
    return { nazev: f.name, vypis };
  } catch (e) {
    return { nazev: f.name, vypis: null, chyba: e instanceof Error ? e.message : String(e) };
  }
}

export default function Import() {
  const { data, dnes, akce } = useData();
  const toast = useToast();
  const [soubory, setSoubory] = useState<Soubor[]>([]);
  const [cte, setCte] = useState(false);
  const [vysledky, setVysledky] = useState<{ vypis: Vypis; nazev: string; v: VysledekParovani[] }[] | null>(null);
  const [rozhodnuti, setRozhodnuti] = useState<Record<string, Rozhodnuti>>({});
  const [hotovo, setHotovo] = useState<number | null>(null);
  const najemnici = data.najemnici;

  async function vyber(files: FileList | null) {
    if (!files?.length) return;
    setCte(true);
    setVysledky(null);
    setHotovo(null);
    setSoubory(await Promise.all(Array.from(files).map(prectiSoubor)));
    setCte(false);
  }

  function nastavUcet(i: number, ucet: string) {
    setSoubory(soubory.map((s, n) => (n === i && s.vypis ? { ...s, vypis: { ...s.vypis, ucet } } : s)));
  }

  function sparujVse() {
    const videne = new Set<string>();
    const vys = soubory.filter(s => s.vypis?.ucet).map(s => {
      const v = sparuj(s.vypis!, najemnici, data.platby, data.nastaveni.pravidla).map(x => {
        // Překrývající se výpisy v jednom importu: stejný pohyb jen jednou.
        if (videne.has(x.klic) && x.stav !== 'duplicita') return { ...x, stav: 'duplicita' as const, duvod: 'Je i v jiném vybraném výpisu.' };
        videne.add(x.klic);
        return x;
      });
      return { vypis: s.vypis!, nazev: s.nazev, v };
    });
    setVysledky(vys);
    setRozhodnuti(Object.fromEntries(vys.flatMap(x => vychoziRozhodnuti(x.v)).map(r => [r.klic, r])));
  }

  async function zapis() {
    if (!vysledky) return;
    let pravidla = data.nastaveni.pravidla;
    let aktualni = najemnici;
    const platby: Platba[] = [], smazat: string[] = [], zmeneni = new Map<string, Najemnik>();
    for (const { vypis, v } of vysledky) {
      const r = v.map(x => rozhodnuti[x.klic]).filter(Boolean);
      const z = prevedImport(vypis, v, r, aktualni, pravidla, noveId);
      platby.push(...z.platby);
      smazat.push(...z.smazatPlatby);
      pravidla = z.pravidla;
      z.najemnici.forEach(n => zmeneni.set(n.id, n));
      aktualni = aktualni.map(n => zmeneni.get(n.id) ?? n);
    }
    // Neznámé vlastní účty z výpisů se přidají do „Moje účty“.
    const ucty: MujUcet[] = [...data.nastaveni.ucty];
    for (const { vypis } of vysledky) {
      if (!ucty.some(u => u.ucet === vypis.ucet)) ucty.push({ ucet: vypis.ucet, banka: BANKY[vypis.banka], nazev: '' });
    }
    await akce.davka({
      uloz: { platby, najemnici: [...zmeneni.values()] },
      smaz: { platby: smazat },
      nastaveni: {
        ...data.nastaveni, pravidla, ucty,
        importy: [...vysledky.map(x => ({ soubor: x.nazev, datum: dnes, pocet: platby.filter(p => p.zdroj?.typ === 'vypis' && p.zdroj.ucet === x.vypis.ucet).length })), ...data.nastaveni.importy].slice(0, 20),
      },
    });
    toast(`Zapsáno ${pocet(platby.length, 'platba', 'platby', 'plateb')}`);
    setHotovo(platby.length);
    setVysledky(null);
    setSoubory([]);
  }

  const vse = vysledky?.flatMap(x => x.v) ?? [];
  const skupina = (stav: VysledekParovani['stav']) => vse.filter(x => x.stav === stav);
  const kZapisu = Object.values(rozhodnuti).filter(r => (r.akce === 'zapsat' || r.akce === 'nahradit') && r.najemnikId).length;
  const zmen = (klic: string, zmena: Partial<Rozhodnuti>) => setRozhodnuti({ ...rozhodnuti, [klic]: { ...rozhodnuti[klic], ...zmena } });

  return (
    <AppShell title="Import z banky" subtitle="Nahrát výpisy">
      <Main>
        {!vysledky && (
          <label className="flex cursor-pointer flex-col items-center rounded-[24px] border-2 border-dashed border-primary/40 bg-primary-soft/50 px-6 py-10 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              {hotovo !== null ? <CheckCircle2 className="size-8" /> : <FileUp className="size-8" />}
            </span>
            <p className="mt-4 text-base font-bold">{cte ? 'Čtu výpisy…' : hotovo !== null ? `Hotovo – zapsáno ${pocet(hotovo, 'platba', 'platby', 'plateb')}` : 'Vyberte výpisy z banky'}</p>
            <p className="mt-1 text-sm text-muted-foreground">Fio CSV, Česká spořitelna CSV, KB PDF · lze více najednou</p>
            <input type="file" multiple accept=".csv,.pdf,text/csv,application/pdf" className="hidden" onChange={e => { vyber(e.target.files); e.target.value = ''; }} />
          </label>
        )}

        {soubory.length > 0 && !vysledky && (
          <>
            <Card className="mt-4">
              {soubory.map((s, i) => (
                <div key={s.nazev} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><FileText className="size-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{s.nazev}</p>
                      <p className="text-xs text-muted-foreground">{s.vypis
                        ? `${BANKY[s.vypis.banka]} · ${s.vypis.ucet || 'účet neznámý'} · ${pocet(s.vypis.pohyby.filter(p => p.castkaHal > 0).length, 'příchozí platba', 'příchozí platby', 'příchozích plateb')}`
                        : <span className="text-status-debt">{s.chyba}</span>}</p>
                    </div>
                  </div>
                  {s.vypis && !s.vypis.ucet && (
                    <div className="mt-2">
                      <p className="mb-1 text-xs font-semibold text-status-due">Číslo účtu není v souboru (přejmenovaný výpis z Fio?). Vyberte ho:</p>
                      <select onChange={e => nastavUcet(i, e.target.value)} defaultValue="" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm">
                        <option value="" disabled>— můj účet —</option>
                        {data.nastaveni.ucty.filter(u => u.ucet.endsWith('/2010') || s.vypis!.banka !== 'fio').map(u => <option key={u.ucet} value={u.ucet}>{u.nazev || u.banka} · {u.ucet}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </Card>
            <Tlacitko className="mt-4" onClick={sparujVse} disabled={!soubory.some(s => s.vypis?.ucet)}>Spárovat platby</Tlacitko>
          </>
        )}

        {vysledky && (
          <>
            <section className="card-soft-2 p-5">
              <p className="text-sm font-semibold text-muted-foreground">Nalezeno {pocet(vse.length, 'příchozí platba', 'příchozí platby', 'příchozích plateb')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
                <span className="rounded-2xl bg-status-ok-soft p-3 text-status-ok">{skupina('jiste').length} přiřazeno</span>
                <span className="rounded-2xl bg-status-due-soft p-3 text-status-due">{skupina('navrh').length + skupina('rucne').length} ke kontrole</span>
                <span className="rounded-2xl bg-status-debt-soft p-3 text-status-debt">{skupina('neprirazeno').length} nepřiřazeno</span>
                <span className="rounded-2xl bg-muted p-3 text-muted-foreground">{skupina('nenajem').length + skupina('duplicita').length} není nájem / už zapsáno</span>
              </div>
            </section>

            <Skupina nazev="Ke kontrole" polozky={skupina('navrh')} barva="due">
              {x => <VolbaNajemnika x={x} r={rozhodnuti[x.klic]} najemnici={najemnici} zmen={zmen} />}
            </Skupina>
            <Skupina nazev="Možná už zapsáno ručně" polozky={skupina('rucne')} barva="due">
              {x => (
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs font-bold">
                  {([['nahradit', 'Nahradit ruční'], ['zapsat', 'Jiná platba'], ['preskocit', 'Přeskočit']] as const).map(([a, l]) => (
                    <button key={a} onClick={() => zmen(x.klic, { akce: a })} className={`h-10 rounded-xl ${rozhodnuti[x.klic]?.akce === a ? 'bg-foreground text-background' : 'bg-muted'}`}>{l}</button>
                  ))}
                </div>
              )}
            </Skupina>
            <Skupina nazev="Nepřiřazené" polozky={skupina('neprirazeno')} barva="debt">
              {x => <VolbaNajemnika x={x} r={rozhodnuti[x.klic]} najemnici={najemnici} zmen={zmen} />}
            </Skupina>
            <Skupina nazev="Přiřazeno" polozky={skupina('jiste')} barva="ok">
              {x => (
                <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <input type="checkbox" checked={rozhodnuti[x.klic]?.akce === 'zapsat'} onChange={e => zmen(x.klic, { akce: e.target.checked ? 'zapsat' : 'preskocit' })} className="size-4 accent-[var(--primary)]" />
                  Zapsat → {najemnici.find(n => n.id === x.najemnikId)?.jmeno}
                </label>
              )}
            </Skupina>
            {skupina('nenajem').length + skupina('duplicita').length > 0 && (
              <details className="mt-6">
                <summary className="px-2 py-2 text-sm font-bold text-muted-foreground">Není nájem / už zapsáno ({skupina('nenajem').length + skupina('duplicita').length})</summary>
                <Card className="mt-2">{[...skupina('nenajem'), ...skupina('duplicita')].map(x => <PohybRadek key={x.klic} x={x} />)}</Card>
              </details>
            )}

            <div className="sticky bottom-24 mt-6 space-y-2">
              <Tlacitko onClick={zapis}>Zapsat {pocet(kZapisu, 'platbu', 'platby', 'plateb')}</Tlacitko>
              <button onClick={() => setVysledky(null)} className="h-11 w-full rounded-2xl bg-muted text-sm font-bold">Zpět k souborům</button>
            </div>
          </>
        )}

        {!vysledky && data.nastaveni.importy.length > 0 && (
          <>
            <Nadpis>Předchozí importy</Nadpis>
            <Card>
              {data.nastaveni.importy.map((h, i) => (
                <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{h.soubor}</p><p className="text-xs text-muted-foreground">{datumCz(h.datum)}</p></div>
                  <span className="rounded-full bg-status-ok-soft px-2 py-0.5 text-[11px] font-bold text-status-ok">{pocet(h.pocet, 'platba', 'platby', 'plateb')}</span>
                </div>
              ))}
            </Card>
          </>
        )}
        {!vysledky && soubory.length === 0 && (
          <p className="mt-6 px-2 text-xs text-muted-foreground">Výpis si stáhněte v internetovém bankovnictví (Fio: Pohyby na účtu → CSV, ČS George: Transakce → Export CSV, KB: PDF výpis). Soubor zůstává v telefonu, nikam se neodesílá. Stejný výpis lze nahrát i podruhé – platby se nezapíšou dvakrát.</p>
        )}
      </Main>
    </AppShell>
  );
}

function PohybRadek({ x, children }: { x: VysledekParovani; children?: ReactNode }) {
  const p = x.pohyb;
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{p.nazevProtiuctu || p.protiucet || 'Neznámý plátce'}</p>
          <p className="truncate text-xs text-muted-foreground">{datumKratce(p.datum)} · {p.protiucet || '—'}{p.vs && ` · VS ${p.vs}`}</p>
          {p.zprava && <p className="truncate text-xs text-muted-foreground">„{p.zprava}“</p>}
        </div>
        <p className="shrink-0 font-bold text-status-ok tabular">+{kc(Math.round(p.castkaHal / 100))}</p>
      </div>
      {x.duvod && x.stav !== 'jiste' && <p className="mt-1 text-[11px] text-muted-foreground">{x.duvod}</p>}
      {children}
    </div>
  );
}

function Skupina({ nazev, polozky, barva, children }: { nazev: string; polozky: VysledekParovani[]; barva: 'ok' | 'due' | 'debt'; children: (x: VysledekParovani) => ReactNode }) {
  if (!polozky.length) return null;
  const tecka = { ok: 'bg-status-ok', due: 'bg-status-due', debt: 'bg-status-debt' }[barva];
  return (
    <>
      <h2 className="mt-6 mb-2 flex items-center gap-2 px-2 text-sm font-bold text-muted-foreground"><span className={`size-2 rounded-full ${tecka}`} />{nazev} · {polozky.length}</h2>
      <Card>{polozky.map(x => <PohybRadek key={x.klic} x={x}>{children(x)}</PohybRadek>)}</Card>
    </>
  );
}

function VolbaNajemnika({ x, r, najemnici, zmen }: { x: VysledekParovani; r?: Rozhodnuti; najemnici: Najemnik[]; zmen: (k: string, z: Partial<Rozhodnuti>) => void }) {
  if (!r) return <Chyba text="Chybí rozhodnutí." />;
  const kandidati = x.kandidati.length ? x.kandidati : [];
  return (
    <div className="mt-2 space-y-1.5">
      <select value={r.najemnikId ?? ''} onChange={e => zmen(x.klic, { najemnikId: e.target.value || null, akce: e.target.value ? 'zapsat' : 'preskocit', zapamatovatUcet: !!x.pohyb.protiucet })}
        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold">
        <option value="">— vyberte nájemníka —</option>
        {kandidati.length > 0 && <optgroup label="Návrh">{kandidati.map(id => <option key={id} value={id}>{najemnici.find(n => n.id === id)?.jmeno}</option>)}</optgroup>}
        <optgroup label="Všichni">{najemnici.filter(n => !kandidati.includes(n.id)).map(n => <option key={n.id} value={n.id}>{n.jmeno}</option>)}</optgroup>
      </select>
      <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
        <button onClick={() => zmen(x.klic, { akce: r.najemnikId ? 'zapsat' : 'preskocit' })} disabled={!r.najemnikId}
          className={`h-10 rounded-xl disabled:opacity-40 ${r.akce === 'zapsat' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>Zapsat</button>
        <button onClick={() => zmen(x.klic, { akce: 'nenajem' })} className={`h-10 rounded-xl ${r.akce === 'nenajem' ? 'bg-foreground text-background' : 'bg-muted'}`}>Není nájem</button>
        <button onClick={() => zmen(x.klic, { akce: 'nenajemVzdy' })} disabled={!x.pohyb.protiucet}
          className={`h-10 rounded-xl disabled:opacity-40 ${r.akce === 'nenajemVzdy' ? 'bg-foreground text-background' : 'bg-muted'}`}>Už se neptat</button>
      </div>
      {r.akce === 'zapsat' && x.pohyb.protiucet && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={r.zapamatovatUcet} onChange={e => zmen(x.klic, { zapamatovatUcet: e.target.checked })} className="size-4" />
          Zapamatovat účet {x.pohyb.protiucet} pro příště
        </label>
      )}
    </div>
  );
}
