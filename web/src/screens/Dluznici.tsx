import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Phone, Send } from 'lucide-react';
import { AppShell, Main, ZpusobIkona } from '../components/ui';
import { PanelUpominky } from '../components/upominka';
import { useData, type Prehled } from '../data/store';
import { datumCz, kc, pocet } from '../lib/format';
import type { Najemnik } from '../types';
import { usePamet } from '../lib/pamet';

export default function Dluznici() {
  const { prehled, souhrn } = useData();
  const [zprava, setZprava] = usePamet<Najemnik | null>('dluznici:zprava', null);
  const seznam = prehled.filter(r => r.dluh > 0).sort((a, b) => b.dluh - a.dluh);
  return (
    <AppShell title="Dlužníci" subtitle={seznam.length ? pocet(seznam.length, 'dlužník', 'dlužníci', 'dlužníků') : 'Nikdo nedluží'}>
      <Main className="space-y-4">
        {seznam.length === 0 ? (
          <section className="rounded-[24px] bg-status-ok-soft p-8 text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-3 text-lg font-extrabold text-status-ok">Nikdo nedluží</p>
            <p className="mt-1 text-sm text-muted-foreground">Všechny ukončené měsíce jsou zaplacené.</p>
          </section>
        ) : (
          <section className="rounded-[24px] bg-status-debt-soft p-5">
            <p className="text-sm font-semibold text-status-debt">Celkem po splatnosti</p>
            <p className="text-[34px] leading-tight font-extrabold text-status-debt tabular">{kc(souhrn.dluhCelkem)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Bez nájmu za tento měsíc, který je splatný do jeho konce.</p>
          </section>
        )}
        {seznam.map(r => <KartaDluznika key={r.najemnik.id} r={r} onZprava={() => setZprava(r.najemnik)} />)}
      </Main>
      {zprava && <PanelUpominky najemnik={zprava} onClose={() => setZprava(null)} />}
    </AppShell>
  );
}

function KartaDluznika({ r, onZprava }: { r: Prehled; onZprava: () => void }) {
  const { data, dnes, akce } = useData();
  const n = r.najemnik;
  const [text, setText] = usePamet(`dluh:${n.id}:text`, n.poznamkaDluh?.text ?? '');
  const [upravuji, setUpravuji] = usePamet(`dluh:${n.id}:upravuji`, false);
  const posledni = data.platby.filter(p => p.najemnikId === n.id).sort((a, b) => b.datum.localeCompare(a.datum))[0];
  const upominka = data.upominky.filter(u => u.najemnikId === n.id).sort((a, b) => b.datum.localeCompare(a.datum))[0];

  async function ulozPoznamku() {
    await akce.ulozNajemnika({ ...n, poznamkaDluh: text.trim() ? { text: text.trim(), datum: dnes } : undefined });
    setUpravuji(false);
  }

  return (
    <div>
      <div className="card-soft-2 p-4">
        <Link to={`/najemnici/${n.id}`} className="flex items-center gap-3">
          <ZpusobIkona m={n.zpusobPlaceni ?? 'ucet'} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold">{n.jmeno}</p>
            <p className="truncate text-xs text-muted-foreground">{n.oznaceni}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold text-status-debt tabular">{kc(r.dluh)}</p>
            {r.tentoMesic > 0 && <p className="text-[11px] text-status-due tabular">+ {kc(r.tentoMesic)} tento měsíc</p>}
          </div>
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">Poslední platba: {posledni ? `${kc(posledni.castka)}, ${datumCz(posledni.datum)}` : '—'}</p>
        <div className="mt-3 rounded-2xl bg-muted p-3">
          {upravuji ? (
            <div className="flex gap-2">
              <input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && ulozPoznamku()}
                placeholder="Co řekl naposledy…" className="h-10 min-w-0 flex-1 rounded-xl bg-background px-3 text-sm outline-none" />
              <button onClick={ulozPoznamku} className="h-10 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground">Uložit</button>
            </div>
          ) : (
            <button onClick={() => setUpravuji(true)} className="flex w-full items-start gap-2 text-left text-sm">
              <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">
                {n.poznamkaDluh?.text || <span className="text-muted-foreground">Přidat poznámku k dluhu</span>}
                {n.poznamkaDluh && <span className="block text-[11px] text-muted-foreground">zapsáno {datumCz(n.poznamkaDluh.datum)}</span>}
              </span>
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {n.telefon
            ? <a href={`tel:${n.telefon.replace(/\s/g, '')}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary-soft font-bold text-primary"><Phone className="size-4" />Zavolat</a>
            : <span className="flex h-12 items-center justify-center rounded-2xl bg-muted text-sm text-muted-foreground">Bez telefonu</span>}
          <button onClick={onZprava} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-status-debt font-bold text-white"><Send className="size-4" />Upomínka</button>
        </div>
      </div>
      {upominka && <p className="mt-1.5 px-3 text-[11px] text-muted-foreground">Poslední upomínka: {datumCz(upominka.datum)} ({upominka.kanal === 'sms' ? 'SMS' : upominka.kanal === 'whatsapp' ? 'WhatsApp' : 'e-mail'})</p>}
    </div>
  );
}
