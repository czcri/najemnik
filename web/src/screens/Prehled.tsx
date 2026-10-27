import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, Building2, ChevronRight, FileUp, Plus, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppShell, Main } from '../components/ui';
import { useData } from '../data/store';
import { mesicZData, statistiky } from '../lib/core';
import { NazevMesice, kc, pocet, posunMesic } from '../lib/format';

export const ZALOHA_PO_DNECH = 60;

export function zalohaStara(posledni: string | null, dnes: string, maData: boolean) {
  if (!maData) return false;
  if (!posledni) return true;
  return (Date.parse(dnes) - Date.parse(posledni)) / 86400000 > ZALOHA_PO_DNECH;
}

function Sparkline({ hodnoty }: { hodnoty: number[] }) {
  if (hodnoty.length < 2 || Math.max(...hodnoty) === 0) return null;
  const w = 64, h = 22, max = Math.max(...hodnoty), min = Math.min(...hodnoty) * 0.9;
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;
  const body = hodnoty.map((v, i) => `${(i / (hodnoty.length - 1)) * w},${y(v)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`-3 -3 ${w + 6} ${h + 6}`} className="text-status-ok" aria-hidden>
      <polyline points={body} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={y(hodnoty.at(-1)!)} r="2.5" fill="currentColor" />
    </svg>
  );
}

type Dlazdice = { to: string; label: string; sub: ReactNode; icon: LucideIcon; tone: string; extra?: ReactNode };

export default function Prehled() {
  const { data, dnes, prehled, souhrn } = useData();
  const mesic = mesicZData(dnes);
  const aktivni = prehled.filter(r => !r.ukonceny);
  const st = statistiky(data, posunMesic(mesic, -5), mesic, dnes);
  const tento = st.mesice.at(-1) ?? { prijato: 0, ocekavano: 0 };
  const procento = tento.ocekavano ? Math.min(100, (tento.prijato / tento.ocekavano) * 100) : 0;
  const zaplatilo = aktivni.filter(r => r.tentoMesic === 0 && r.mel > 0).length;
  const zaloha = zalohaStara(data.nastaveni.posledniZaloha, dnes, data.najemnici.length > 0);

  const dlazdice: Dlazdice[] = [
    { to: '/najemnici', label: 'Nájemníci', sub: pocet(aktivni.length, 'nájemník', 'nájemníci', 'nájemníků'), icon: Users, tone: 'bg-status-over-soft text-status-over' },
    { to: '/platby', label: 'Platby', sub: <>{NazevMesice(mesic).split(' ')[0]}: zaplatilo <b className="text-foreground">{zaplatilo} z {aktivni.length}</b></>, icon: Wallet, tone: 'bg-status-due-soft text-status-due' },
    {
      to: '/dluznici', label: 'Dlužníci', icon: AlertTriangle, tone: 'bg-status-debt-soft text-status-debt',
      sub: souhrn.dluzniku
        ? <>{pocet(souhrn.dluzniku, 'dlužník', 'dlužníci', 'dlužníků')} · <b className="text-status-debt">{kc(souhrn.dluhCelkem)}</b></>
        : <span className="font-semibold text-status-ok">Nikdo nedluží</span>,
    },
    { to: '/vlozit-platbu', label: 'Vložit platbu', sub: '', icon: Plus, tone: '' },
    {
      to: '/statistiky', label: 'Statistiky', icon: BarChart3, tone: 'bg-status-ok-soft text-status-ok',
      sub: <>{NazevMesice(mesic).split(' ')[0]}: přišlo {kc(tento.prijato)}</>,
      extra: zaloha
        ? <span className="rounded-full bg-status-due-soft px-2 py-0.5 text-[10px] font-bold text-status-due">Zálohovat</span>
        : <Sparkline hodnoty={st.mesice.map(m => m.prijato)} />,
    },
    { to: '/import', label: 'Import z banky', sub: 'Nahrát výpisy', icon: FileUp, tone: 'bg-muted text-muted-foreground' },
  ];

  return (
    <AppShell active="Přehled">
      <header className="flex items-center gap-3 px-6 pt-8 pb-4">
        <div className="flex size-11 items-center justify-center rounded-2xl card-navy"><Building2 className="size-5" /></div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Nájemník</h1>
          <p className="text-sm font-medium text-muted-foreground">{NazevMesice(mesic)}</p>
        </div>
      </header>

      <Main>
        <Link to="/platby" className="card-navy block p-6">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{NazevMesice(mesic)}</span>
            <span className="text-xs font-semibold opacity-70 tabular">{Math.round(procento)} % vybráno</span>
          </div>
          <p className="mt-5 text-sm opacity-70">Přišlo tento měsíc</p>
          <p className="text-[40px] leading-tight font-extrabold tracking-tight tabular">{kc(tento.prijato)}</p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[oklch(0.7_0.13_162)] transition-all duration-700" style={{ width: `${procento}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-xs opacity-60">Dluh po splatnosti</p>
              <p className={`text-lg font-bold tabular ${souhrn.dluhCelkem ? 'text-[oklch(0.75_0.16_25)]' : 'text-[oklch(0.8_0.12_162)]'}`}>{kc(souhrn.dluhCelkem)}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-xs opacity-60">Očekáváno</p>
              <p className="text-lg font-bold tabular">{kc(tento.ocekavano)}</p>
            </div>
          </div>
        </Link>

        <h2 className="mt-8 mb-3 px-2 text-sm font-bold text-muted-foreground">Rychlé akce</h2>
        <div className="grid grid-cols-2 gap-3">
          {dlazdice.map(t => t.label === 'Vložit platbu' ? (
            <Link to={t.to} key={t.label} className="card-hero flex min-h-[128px] flex-col justify-between p-4 transition-transform active:scale-[0.97]">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/20"><Plus className="size-6" strokeWidth={2.5} /></span>
              <span><span className="block text-base font-bold">Vložit platbu</span><span className="block text-xs opacity-80">Rychlý zápis</span></span>
            </Link>
          ) : (
            <Link to={t.to} key={t.label} className="card-soft-2 flex min-h-[128px] flex-col justify-between p-4 transition-transform active:scale-[0.97]">
              <div className="flex items-start justify-between">
                <span className={`flex size-11 items-center justify-center rounded-2xl ${t.tone}`}><t.icon className="size-5" /></span>
                {t.extra ?? <ChevronRight className="size-4 text-muted-foreground" />}
              </div>
              <span>
                <span className="block text-[15px] font-bold">{t.label}</span>
                <span className="block text-xs leading-snug text-muted-foreground tabular">{t.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </Main>
    </AppShell>
  );
}
