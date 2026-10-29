// Posuvná hlavní karta na přehledu (spec. kap. 13): Hotovost · Měsíc · Na účet (po otevření Hotovost).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, FileUp } from 'lucide-react';
import { useData } from '../data/store';
import { parseCastka, seznamMesice, type PolozkaMesice } from '../lib/core';
import { NazevMesice, datumCz, datumKratce, kc, nazevMesice, noveId, pocet } from '../lib/format';
import { Chyba, Panel, Pole, Tlacitko, VSTUP, useChrana, useToast } from './ui';
import { mesicZData } from '../lib/core';
import { usePamet } from '../lib/pamet';

export type HlavniKartaRef = { ukaz: (strana: number) => void };

export const HlavniKarta = forwardRef<HlavniKartaRef, { mesic: ReactNode; uvodni?: number }>(function HlavniKarta({ mesic, uvodni = 0 }, ref) {
  const pas = useRef<HTMLDivElement>(null);
  const [strana, setStrana] = useState(uvodni);
  const ukaz = (i: number, plynule = true) => {
    const el = pas.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: plynule ? 'smooth' : 'auto' });
  };
  useImperativeHandle(ref, () => ({ ukaz }));
  useEffect(() => { ukaz(uvodni, false); }, [uvodni]);
  // Po změně velikosti (otočení telefonu) dorovnat na aktuální stranu – snap to sám neudělá vždy.
  const aktualni = useRef(strana);
  aktualni.current = strana;
  useEffect(() => {
    const el = pas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => ukaz(aktualni.current, false));
    ro.observe(el);
    // Návrat do aplikace z pozadí = „otevření“ → zase první strana (Hotovost).
    const navrat = () => { if (document.visibilityState === 'visible') ukaz(uvodni, false); };
    document.addEventListener('visibilitychange', navrat);
    return () => { ro.disconnect(); document.removeEventListener('visibilitychange', navrat); };
  }, [uvodni]);

  const strany = [{ nazev: 'Hotovost', obsah: <StranaSeznamu zpusob="hotove" /> }, { nazev: 'Měsíc', obsah: mesic }, { nazev: 'Na účet', obsah: <StranaSeznamu zpusob="ucet" /> }];
  return (
    <div>
      <div ref={pas} onScroll={e => setStrana(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="bez-posuvniku -mx-4 flex snap-x snap-mandatory overflow-x-auto">
        {strany.map(s => <div key={s.nazev} className="w-full shrink-0 snap-center px-4">{s.obsah}</div>)}
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        {strany.map((s, i) => (
          <button key={s.nazev} onClick={() => ukaz(i)} aria-label={`Ukázat ${s.nazev}`}
            className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold transition-all ${strana === i ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>
            <span className={`size-1.5 rounded-full ${strana === i ? 'bg-background' : 'bg-muted-foreground/50'}`} />{s.nazev}
          </button>
        ))}
      </div>
    </div>
  );
});

function StranaSeznamu({ zpusob }: { zpusob: 'hotove' | 'ucet' }) {
  const { data, dnes, akce } = useData();
  const toast = useToast();
  const [upravitId, setUpravitId] = usePamet<string | null>(`prevzeti:${zpusob}`, null);
  const mesic = mesicZData(dnes);
  const s = seznamMesice(data.najemnici, data.platby, data.vydaje, dnes, zpusob);
  const upravit = s.polozky.find(p => p.najemnik.id === upravitId) ?? null;
  const setUpravit = (p: PolozkaMesice | null) => setUpravitId(p?.najemnik.id ?? null);
  const hotove = zpusob === 'hotove';
  const posledniImport = data.nastaveni.importy[0]?.datum;

  async function prevzit(p: PolozkaMesice, castka = p.chybi, datum = dnes) {
    // Hotovost = „Hotově“; na straně Na účet ruční potvrzení převodu = „Převod – ručně“ (výpis zatím nenahrán).
    const platba = { id: noveId(), najemnikId: p.najemnik.id, datum, castka, zaMesic: p.zaMesic, poznamka: '', zdroj: { typ: hotove ? 'hotove' as const : 'prevod' as const } };
    await akce.ulozPlatbu(platba);
    toast(`${hotove ? 'Převzato' : 'Zapsán převod'} ${kc(castka)} · ${p.najemnik.jmeno.split(' ')[0]}`, { popis: 'Zpět', onClick: () => akce.smazPlatbu(platba.id) });
  }

  return (
    <section className="card-navy flex min-h-[340px] flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{hotove ? 'Hotovost' : 'Na účet'} · {NazevMesice(mesic).split(' ')[0]}</span>
        <span className="text-xs font-semibold opacity-70 tabular">{s.celkem ? `zaplatilo ${s.zaplaceno} z ${s.celkem}` : ''}</span>
      </div>

      {s.celkem === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-sm opacity-80">{hotove ? 'Nikdo nemá nastaveno placení hotově.' : 'Nikdo nemá nastaveno placení na účet.'}</p>
          <p className="mt-1 text-xs opacity-60">Nastavíte v profilu nájemníka (Způsob placení).</p>
        </div>
      ) : s.polozky.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-[oklch(0.7_0.13_162)]/25 text-[oklch(0.8_0.12_162)]"><Check className="size-7" /></span>
          <p className="mt-3 font-bold">{hotove ? 'Všechna hotovost za tento měsíc převzata' : 'Všichni na účet zaplatili'}</p>
        </div>
      ) : (
        <ul className="bez-posuvniku mt-4 max-h-[212px] flex-1 space-y-2 overflow-y-auto">
          {s.polozky.map(p => (
            <li key={p.najemnik.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5">
              {(
                <button aria-label={hotove ? `Převzato od ${p.najemnik.jmeno}` : `Převod od ${p.najemnik.jmeno} přišel`} onClick={() => setUpravit(p)}
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors active:bg-[oklch(0.7_0.13_162)] ${p.stav === 'castecne' ? 'border-[oklch(0.8_0.14_65)]' : 'border-white/40'}`}>
                  {p.stav === 'castecne' && <span className="size-3 rounded-full bg-[oklch(0.8_0.14_65)]" />}
                </button>
              )}
              <Link to={`/najemnici/${p.najemnik.id}`} className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{p.najemnik.jmeno}</p>
                <p className={`truncate text-xs ${p.poTerminu ? 'font-semibold text-[oklch(0.8_0.14_65)]' : p.dnes ? 'font-semibold text-[oklch(0.8_0.12_162)]' : 'opacity-60'}`}>
                  {p.ocekavano ? (p.dnes ? 'čekám dnes' : `${p.poTerminu ? 'po termínu · ' : ''}čekám k ${datumKratce(p.ocekavano)}`) : p.najemnik.oznaceni}
                  {p.zaMesic !== mesic && ` · za ${nazevMesice(p.zaMesic).split(' ')[0]}`}
                </p>
              </Link>
              <button onClick={() => setUpravit(p)} className="shrink-0 text-right">
                <p className="text-[15px] font-bold tabular">{kc(p.chybi)}</p>
                {p.stav === 'castecne' && <p className="text-[11px] text-[oklch(0.8_0.14_65)] tabular">chybí z {kc(p.mel)}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
        <span className="opacity-70 tabular">{hotove ? `Převzato ${kc(s.prevzato)}` : `Přišlo ${kc(s.prevzato)}`}</span>
        {hotove
          ? <span className="text-right opacity-60">○ = převzít hotovost</span>
          : s.polozky.length > 0 && !posledniImport ? <span className="text-right opacity-60">○ = převod přišel</span>
          : <Link to="/import" className="flex items-center gap-1 font-semibold opacity-80"><FileUp className="size-3.5" />{posledniImport ? `Import ${datumCz(posledniImport)}` : 'Nahrát výpis'}<ChevronRight className="size-3.5" /></Link>}
      </div>
      {upravit && <PanelPrevzeti p={upravit} hotove={hotove} onClose={() => setUpravit(null)} onPotvrdit={async (c, d) => { await prevzit(upravit, c, d); setUpravit(null); }} />}
    </section>
  );
}

function PanelPrevzeti({ p, hotove, onClose, onPotvrdit }: { p: PolozkaMesice; hotove: boolean; onClose: () => void; onPotvrdit: (castka: number, datum: string) => unknown }) {
  const [busy, chran] = useChrana();
  const { dnes } = useData();
  const [castka, setCastka] = usePamet(`prevzeti:${p.najemnik.id}:castka`, String(p.chybi), String(p.chybi));
  const [datum, setDatum] = usePamet(`prevzeti:${p.najemnik.id}:datum`, dnes, String(p.chybi));
  const [chyba, setChyba] = useState<string | null>(null);
  return (
    <Panel title={hotove ? 'Potvrdit převzetí hotovosti' : 'Potvrdit přijetí převodu'} onClose={onClose}>
      <div className="space-y-4 text-foreground">
        <div className="rounded-2xl bg-status-ok-soft p-4">
          <p className="text-lg font-extrabold">{p.najemnik.jmeno}</p>
          <p className="text-sm text-muted-foreground">{p.najemnik.oznaceni} · za {nazevMesice(p.zaMesic)} chybí {kc(p.chybi)}{p.stav === 'castecne' ? ` z ${kc(p.mel)}` : ''}</p>
        </div>
        <p className="text-sm text-muted-foreground">Zkontrolujte částku a datum. Při nižší částce zůstane nájemník v seznamu jako „částečně“.{hotove ? '' : ' Zapíše se jako „Převod – ručně“; až nahrajete výpis, aplikace nabídne ruční záznam nahradit.'}</p>
        <Pole label={hotove ? 'Převzatá částka' : 'Přijatá částka'}>
          <div className="flex h-16 items-center rounded-2xl border border-border bg-card px-4 focus-within:border-primary">
            <input autoFocus inputMode="numeric" value={castka} onChange={e => setCastka(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[28px] font-extrabold tabular outline-none" />
            <span className="text-lg font-bold text-muted-foreground">Kč</span>
          </div>
        </Pole>
        <Pole label={hotove ? 'Datum převzetí' : 'Datum přijetí'}><input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={VSTUP} /></Pole>
        <Chyba text={chyba} />
        <Tlacitko disabled={busy} onClick={chran(async () => { const c = parseCastka(castka); if (!c) return setChyba('Částka musí být kladné celé číslo v korunách.'); await onPotvrdit(c, datum); })}>
          {hotove ? 'Potvrdit převzetí' : 'Potvrdit přijetí'}
        </Tlacitko>
        <Tlacitko typ="vedlejsi" onClick={onClose}>Zrušit</Tlacitko>
      </div>
    </Panel>
  );
}

export function useHotovostDnes() {
  const { data, dnes } = useData();
  const s = seznamMesice(data.najemnici, data.platby, data.vydaje, dnes, 'hotove');
  return { dnes: s.polozky.filter(p => p.dnes), poTerminu: s.polozky.filter(p => p.poTerminu), text: (n: number) => pocet(n, 'nájemník', 'nájemníci', 'nájemníků') };
}
