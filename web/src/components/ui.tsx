// Společné prvky vzhledu (podle návrhu z Lovable).
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, CalendarDays, ChevronLeft, ChevronRight, Home, Landmark, ListChecks, Plus, Settings, Users, X, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NazevMesice, kc, posunMesic } from '../lib/format';
import type { Stav, Zpusob } from '../types';

export function AppShell({ children, title, subtitle, active, right }: {
  children: ReactNode; title?: string; subtitle?: string; active?: string; right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
        {title && (
          <header className="flex items-center gap-3 px-4 pt-6 pb-4">
            <button aria-label="Zpět" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}
              className="flex size-12 shrink-0 items-center justify-center rounded-full card-soft">
              <ArrowLeft className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
              {subtitle && <p className="truncate text-sm font-medium text-muted-foreground">{subtitle}</p>}
            </div>
            {right}
          </header>
        )}
        {children}
        <BottomNav active={active} />
      </div>
    </div>
  );
}

function BottomNav({ active }: { active?: string }) {
  const left = [{ l: 'Přehled', i: Home, to: '/' }, { l: 'Nájemníci', i: Users, to: '/najemnici' }];
  const right = [{ l: 'Platby', i: ListChecks, to: '/platby' }, { l: 'Nastavení', i: Settings, to: '/nastaveni' }];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10">
      <div className="mx-auto max-w-[430px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="card-soft flex items-center justify-between px-2 py-2">
          {left.map(n => <NavItem key={n.l} {...n} active={active === n.l} />)}
          <Link to="/vlozit-platbu" aria-label="Vložit platbu" className="card-hero -mt-8 flex size-14 items-center justify-center rounded-full">
            <Plus className="size-6" strokeWidth={2.5} />
          </Link>
          {right.map(n => <NavItem key={n.l} {...n} active={active === n.l} />)}
        </div>
      </div>
    </nav>
  );
}

function NavItem({ l, i: Icon, to, active }: { l: string; i: LucideIcon; to: string; active?: boolean }) {
  return (
    <Link to={to} className={`flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
      <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
      {l}
    </Link>
  );
}

export const Main = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <main className={`flex-1 px-4 pb-32 ${className}`}>{children}</main>;

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card-soft-2 divide-y divide-border overflow-hidden ${className}`}>{children}</div>;
}

export const Nadpis = ({ children }: { children: ReactNode }) =>
  <h2 className="mt-8 mb-3 px-2 text-sm font-bold text-muted-foreground">{children}</h2>;

export function ZpusobIkona({ m, size = 'md' }: { m: Zpusob; size?: 'sm' | 'md' }) {
  const I = m === 'ucet' ? Landmark : Banknote;
  return (
    <span title={m === 'ucet' ? 'Na účet' : 'Hotově'}
      className={`flex shrink-0 items-center justify-center rounded-xl ${m === 'ucet' ? 'bg-status-over-soft text-bank' : 'bg-status-ok-soft text-cash'} ${size === 'sm' ? 'size-8' : 'size-10'}`}>
      <I className={size === 'sm' ? 'size-4' : 'size-[18px]'} />
    </span>
  );
}

export const STAV_CHIP: Record<Stav, string> = {
  dluh: 'bg-status-debt-soft text-status-debt',
  bezi: 'bg-status-due-soft text-status-due',
  ok: 'bg-status-ok-soft text-status-ok',
  preplatek: 'bg-status-over-soft text-status-over',
};
export const STAV_TEXT: Record<Stav, string> = { dluh: 'text-status-debt', bezi: 'text-status-due', ok: 'text-status-ok', preplatek: 'text-status-over' };
export const STAV_TECKA: Record<Stav, string> = { dluh: 'bg-status-debt', bezi: 'bg-status-due', ok: 'bg-status-ok', preplatek: 'bg-status-over' };

export function stavPopis(s: { stav: Stav; dluh: number; tentoMesic: number; preplatek: number }) {
  if (s.stav === 'dluh') return `Dluží ${kc(s.dluh)}`;
  if (s.stav === 'bezi') return `Chybí ${kc(s.tentoMesic)}`;
  if (s.stav === 'preplatek') return `Přeplatek ${kc(s.preplatek)}`;
  return 'Zaplaceno';
}

export const Chip = ({ stav, children }: { stav: Stav; children: ReactNode }) =>
  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold tabular ${STAV_CHIP[stav]}`}>{children}</span>;

// Ochrana proti dvojímu klepnutí: obalená akce neběží dvakrát současně (zablokuje se hned, ne až po překreslení).
export function useChrana() {
  const bezi = useRef(false);
  const [busy, setBusy] = useState(false);
  const chran = useCallback(<A extends unknown[]>(f: (...a: A) => unknown) => async (...a: A) => {
    // Odeslání formuláře zrušit vždy – i u zablokovaného druhého klepnutí (jinak by se stránka znovu načetla).
    (a[0] as { preventDefault?: () => void } | undefined)?.preventDefault?.();
    if (bezi.current) return;
    bezi.current = true;
    setBusy(true);
    try { await f(...a); } finally { bezi.current = false; setBusy(false); }
  }, []);
  return [busy, chran] as const;
}

// Spodní panel (formuláře, upomínka).
export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-30 flex items-end bg-black/40 text-foreground" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="animace-panel mx-auto max-h-[92vh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-background p-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button aria-label="Zavřít" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Pole({ label, children, napoveda }: { label: string; children: ReactNode; napoveda?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-sm font-bold text-muted-foreground">{label}</span>
      {children}
      {napoveda && <span className="mt-1 block px-1 text-xs text-muted-foreground">{napoveda}</span>}
    </label>
  );
}

export const VSTUP = 'h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none focus:border-primary';

export function Prepinac<T extends string>({ hodnota, volby, onChange }: {
  hodnota: T; volby: { k: T; l: string; i?: LucideIcon }[]; onChange: (k: T) => void;
}) {
  return (
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${volby.length}, minmax(0, 1fr))` }}>
      {volby.map(({ k, l, i: I }) => (
        <button type="button" key={k} onClick={() => onChange(k)}
          className={`flex h-12 items-center justify-center gap-2 rounded-[18px] border-2 text-sm font-bold ${hodnota === k ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-card text-muted-foreground'}`}>
          {I && <I className="size-[18px]" />}{l}
        </button>
      ))}
    </div>
  );
}

export function Tlacitko({ children, onClick, typ = 'hlavni', type = 'button', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; typ?: 'hlavni' | 'vedlejsi' | 'nebezpecne'; type?: 'button' | 'submit'; disabled?: boolean; className?: string;
}) {
  const styl = typ === 'hlavni' ? 'card-hero' : typ === 'nebezpecne' ? 'rounded-[20px] bg-status-debt-soft text-status-debt' : 'rounded-[20px] bg-muted';
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`flex h-14 w-full items-center justify-center gap-2 text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-50 ${styl} ${className}`}>
      {children}
    </button>
  );
}

// Záložky (segmentový přepínač) nad obsahem obrazovky.
export function Zalozky<T extends string>({ hodnota, volby, onChange }: { hodnota: T; volby: { k: T; l: string }[]; onChange: (k: T) => void }) {
  return (
    <nav className="grid gap-1 rounded-2xl bg-muted p-1 text-sm font-bold" style={{ gridTemplateColumns: `repeat(${volby.length}, minmax(0, 1fr))` }}>
      {volby.map(v => (
        <button key={v.k} onClick={() => onChange(v.k)} className={`h-10 rounded-xl px-1 ${hodnota === v.k ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{v.l}</button>
      ))}
    </nav>
  );
}

// Výběr měsíce: ‹ Říjen 2026 › – šipky po měsících, klepnutí na měsíc = výběr měsíce a roku.
export function VolbaMesice({ hodnota, onChange, min, max, kompaktni }: {
  hodnota: string; onChange: (m: string) => void; min?: string; max?: string; kompaktni?: boolean;
}) {
  const nastav = (m: string) => {
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    onChange(max && m > max ? max : min && m < min ? min : m);
  };
  const vyska = kompaktni ? 'h-11' : 'h-12';
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Předchozí měsíc" onClick={() => nastav(posunMesic(hodnota, -1))} disabled={!!min && hodnota <= min}
        className={`flex ${vyska} aspect-square shrink-0 items-center justify-center rounded-full card-soft disabled:opacity-30`}><ChevronLeft className="size-5" /></button>
      <label className={`card-soft relative flex ${vyska} flex-1 items-center justify-center gap-2 font-bold`}>
        <CalendarDays className="size-5 text-primary" />{NazevMesice(hodnota)}
        <input type="month" value={hodnota} min={min} max={max} onChange={e => nastav(e.target.value)}
          onClick={e => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
          aria-label="Vybrat měsíc a rok" className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
      <button type="button" aria-label="Další měsíc" onClick={() => nastav(posunMesic(hodnota, 1))} disabled={!!max && hodnota >= max}
        className={`flex ${vyska} aspect-square shrink-0 items-center justify-center rounded-full card-soft disabled:opacity-30`}><ChevronRight className="size-5" /></button>
    </div>
  );
}

// Nápověda pod částkou: odkud se vzala předvyplněná částka.
export const NapovedaCastky = ({ navrh, mesic }: { navrh: { doplatek: boolean; zaplaceno: number; mel: number }; mesic: string }) =>
  <span className="mt-1 block px-1 text-xs text-muted-foreground">
    {navrh.doplatek
      ? <>Předvyplněn <b className="text-status-due">doplatek za {mesic}</b> – zaplaceno už {kc(navrh.zaplaceno)} z {kc(navrh.mel)}.</>
      : navrh.zaplaceno >= navrh.mel && navrh.mel > 0
        ? <>{mesic[0].toUpperCase() + mesic.slice(1)} je už zaplacený celý – předvyplněn pravidelný nájem.</>
        : <>Předvyplněn pravidelný měsíční nájem.</>}
  </span>;

export const Chyba = ({ text }: { text: string | null }) =>
  text ? <p className="rounded-2xl bg-status-debt-soft px-4 py-3 text-sm font-semibold text-status-debt">{text}</p> : null;

// Krátká potvrzení („Platba uložena“).
type Akce = { popis: string; onClick: () => void };
const ToastCtx = createContext<(t: string, akce?: Akce) => void>(() => {});
let casovac: number | undefined;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; akce?: Akce } | null>(null);
  const ukaz = useCallback((text: string, akce?: Akce) => {
    setToast({ text, akce });
    window.clearTimeout(casovac);
    casovac = window.setTimeout(() => setToast(null), akce ? 6000 : 2200);
  }, []);
  return (
    <ToastCtx.Provider value={ukaz}>
      {children}
      {toast && (
        <div role="status" className="animace-toast pointer-events-none fixed inset-x-0 bottom-28 z-40 flex justify-center px-4">
          <span className="pointer-events-auto flex items-center gap-4 rounded-full bg-foreground py-2.5 pr-2.5 pl-5 text-sm font-semibold text-background shadow-lg">
            {toast.text}
            {toast.akce && (
              <button onClick={() => { toast.akce!.onClick(); setToast(null); }} className="rounded-full bg-background/15 px-3 py-1 font-bold text-[oklch(0.8_0.12_162)]">
                {toast.akce.popis}
              </button>
            )}
            {!toast.akce && <span className="pr-2.5" />}
          </span>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
