import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { AppShell, Card, Chip, Main, STAV_TECKA, ZpusobIkona, stavPopis } from '../components/ui';
import { FormNajemnik } from '../components/formulare';
import { useData, type Prehled } from '../data/store';
import { kc, pocet } from '../lib/format';
import type { Stav } from '../types';

export function RadekNajemnika({ r, vpravo }: { r: Prehled; vpravo?: ReactNode }) {
  return (
    <Link to={`/najemnici/${r.najemnik.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors active:bg-muted">
      <ZpusobIkona m={r.najemnik.zpusobPlaceni ?? 'ucet'} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{r.najemnik.jmeno}</p>
        <p className="truncate text-xs text-muted-foreground">{r.najemnik.oznaceni}</p>
      </div>
      <div className="shrink-0 text-right">
        {vpravo ?? <p className="text-sm font-bold tabular">{kc(r.najem)}</p>}
        {!vpravo && <span className="mt-1 block"><Chip stav={r.stav}>{stavPopis(r)}</Chip></span>}
      </div>
    </Link>
  );
}

const FILTRY: { k: Stav | 'vse' | 'ucet' | 'hotove'; l: string }[] = [
  { k: 'vse', l: 'Všichni' }, { k: 'dluh', l: 'Dluží' }, { k: 'bezi', l: 'Chybí' }, { k: 'ok', l: 'Zaplaceno' },
  { k: 'preplatek', l: 'Přeplatek' }, { k: 'ucet', l: 'Na účet' }, { k: 'hotove', l: 'Hotově' },
];
const bezDiakritiky = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Najemnici() {
  const { prehled } = useData();
  const navigate = useNavigate();
  const [filtr, setFiltr] = useState<(typeof FILTRY)[number]['k']>('vse');
  const [hledat, setHledat] = useState('');
  const [novy, setNovy] = useState(false);
  const aktivni = prehled.filter(r => !r.ukonceny);
  const vyhovuje = (r: Prehled) =>
    (filtr === 'vse' || r.stav === filtr || (r.najemnik.zpusobPlaceni ?? 'ucet') === filtr)
    && bezDiakritiky(`${r.najemnik.jmeno} ${r.najemnik.oznaceni}`).includes(bezDiakritiky(hledat));
  const seznam = aktivni.filter(vyhovuje);
  const ukonceni = prehled.filter(r => r.ukonceny && vyhovuje(r));

  return (
    <AppShell title="Nájemníci" subtitle={pocet(aktivni.length, 'nájemník', 'nájemníci', 'nájemníků')} active="Nájemníci"
      right={<button aria-label="Nový nájemník" onClick={() => setNovy(true)} className="card-hero flex size-12 shrink-0 items-center justify-center rounded-full"><Plus className="size-5" /></button>}>
      <Main>
        <label className="card-soft flex min-h-12 items-center gap-3 px-4">
          <Search className="size-5 text-muted-foreground" />
          <input value={hledat} onChange={e => setHledat(e.target.value)} placeholder="Hledat nájemníka" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
        </label>
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTRY.map(x => (
            <button key={x.k} onClick={() => setFiltr(x.k)} className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ${filtr === x.k ? 'bg-foreground text-background' : 'card-soft text-muted-foreground'}`}>
              {x.k in STAV_TECKA && <span className={`size-2 rounded-full ${STAV_TECKA[x.k as Stav]}`} />}
              {x.l}
            </button>
          ))}
        </div>
        {aktivni.length === 0 && !hledat ? (
          <div className="card-soft-2 mt-4 p-8 text-center">
            <p className="font-bold">Zatím žádní nájemníci</p>
            <p className="mt-1 text-sm text-muted-foreground">Začněte prvním nájemníkem.</p>
            <button onClick={() => setNovy(true)} className="card-hero mt-5 h-12 w-full font-bold">+ Nájemník</button>
          </div>
        ) : (
          <Card className="mt-4">
            {seznam.map(r => <RadekNajemnika key={r.najemnik.id} r={r} />)}
            {seznam.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nikdo neodpovídá hledání.</p>}
          </Card>
        )}
        {ukonceni.length > 0 && (
          <details className="mt-6">
            <summary className="px-2 py-2 text-sm font-bold text-muted-foreground">Ukončené nájmy ({ukonceni.length})</summary>
            <Card className="mt-2">{ukonceni.map(r => <RadekNajemnika key={r.najemnik.id} r={r} />)}</Card>
          </details>
        )}
      </Main>
      {novy && <FormNajemnik onClose={() => setNovy(false)} onUlozeno={id => navigate(`/najemnici/${id}`)} />}
    </AppShell>
  );
}
