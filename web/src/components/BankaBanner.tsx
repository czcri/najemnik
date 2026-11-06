// Přehled: kolik nových plateb čeká ve službě banky, případně chyba napojení (např. vypršelý token).
// Stav se zjišťuje nejvýš jednou za 5 minut; po zápisu plateb se zapomene (zapomenStavBanky).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Landmark } from 'lucide-react';
import { useData } from '../data/store';
import { stavBanky, type StavBanky } from '../lib/banka';
import { pocet } from '../lib/format';

type Zjisteno = { cas: number; stav: StavBanky | null; chyba: string | null };
let posledni: Zjisteno | null = null;
export const zapomenStavBanky = () => { posledni = null; };

export function BankaBanner() {
  const { data } = useData();
  const b = data.nastaveni.banka;
  const [z, setZ] = useState<Zjisteno | null>(posledni);
  useEffect(() => {
    if (!b || (posledni && Date.now() - posledni.cas < 5 * 60_000)) return;
    let zruseno = false;
    stavBanky(b)
      .then(stav => ({ cas: Date.now(), stav, chyba: null }), (e: Error) => ({ cas: Date.now(), stav: null, chyba: e.message }))
      .then(x => { posledni = x; if (!zruseno) setZ(x); });
    return () => { zruseno = true; };
  }, [b]);
  if (!b || !z) return null;

  const n = z.stav?.fronta ?? 0;
  const chyba = z.chyba ?? z.stav?.ucty.find(u => u.chyba)?.chyba;
  if (n > 0) {
    return (
      <Link to="/import?banka=1" className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-status-over-soft px-4 py-3 text-sm">
        <Landmark className="size-5 shrink-0 text-status-over" />
        <span className="flex-1"><b className="block">Z banky {n === 1 ? 'přišla' : n < 5 ? 'přišly' : 'přišlo'} {pocet(n, 'platba', 'platby', 'plateb')}</b>
          <span className="text-xs text-muted-foreground">Zkontrolovat a zapsat nájemníkům</span></span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    );
  }
  if (chyba) {
    return (
      <Link to="/nastaveni#banka" className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-status-due-soft px-4 py-3 text-sm">
        <AlertTriangle className="size-5 shrink-0 text-status-due" />
        <span className="flex-1"><b className="block">Načítání z banky nefunguje</b><span className="text-xs text-muted-foreground">{chyba}</span></span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    );
  }
  return null;
}
