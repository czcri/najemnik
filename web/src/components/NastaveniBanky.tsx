// Nastavení → Platby z banky (spec. kap. 23): napojení odkazem, stav účtů, upozornění, odpojení.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bell, BellOff, Landmark } from 'lucide-react';
import { Chyba, Nadpis, usePotvrzeni, useToast } from './ui';
import { zapomenStavBanky } from './BankaBanner';
import { useData } from '../data/store';
import { lzeUpozornit, stavBanky, vypniUpozorneni, zOdkazu, zapniUpozorneni, type StavBanky } from '../lib/banka';
import { pocet } from '../lib/format';

const cas = (iso?: string) => (iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const BANKY: Record<string, string> = { fio: 'Fio banka', kb: 'Komerční banka' };

export function NastaveniBanky() {
  const { data, akce } = useData();
  const toast = useToast();
  const potvrd = usePotvrzeni();
  const n = data.nastaveni;
  const b = n.banka;
  const [parametry, setParametry] = useSearchParams();
  const [stav, setStav] = useState<StavBanky | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pracuji, setPracuji] = useState(false);

  // Napojení odkazem z přípravy služby: #/nastaveni?banka=<adresa>&klic=<klíč>
  useEffect(() => {
    const nova = zOdkazu(parametry);
    if (!nova) return;
    setParametry({}, { replace: true });
    (async () => {
      if (!await potvrd({ nadpis: 'Napojit platby z banky?', text: 'Aplikace si bude z této služby brát příchozí platby. Zapisovat se budou až po vašem potvrzení.', radky: [{ l: 'Služba', po: nova.url }], tlacitko: 'Napojit' })) return;
      await akce.ulozNastaveni({ ...n, banka: nova });
      zapomenStavBanky();
      toast('Platby z banky napojeny');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!b) return;
    let zruseno = false;
    stavBanky(b).then(s => { if (!zruseno) { setStav(s); setChyba(null); } }, (e: Error) => { if (!zruseno) setChyba(e.message); });
    return () => { zruseno = true; };
  }, [b]);

  async function upozorneni(zapnout: boolean) {
    if (!b) return;
    if (!await potvrd({ nadpis: zapnout ? 'Zapnout upozornění?' : 'Vypnout upozornění?', radky: [{ l: 'Upozornění na platby z banky', pred: zapnout ? 'vypnuto' : 'zapnuto', po: zapnout ? 'zapnuto' : 'vypnuto' }] })) return;
    setPracuji(true);
    try {
      if (zapnout) await zapniUpozorneni(b); else await vypniUpozorneni(b);
      await akce.ulozNastaveni({ ...n, banka: { ...b, upozorneni: zapnout } });
      toast(zapnout ? 'Upozornění zapnuta' : 'Upozornění vypnuta');
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    } finally {
      setPracuji(false);
    }
  }

  async function odpojit() {
    if (!b || !await potvrd({ nadpis: 'Odpojit platby z banky?', text: 'Platby se přestanou načítat. Zapsané platby zůstanou. Služba na Cloudflare tím nezanikne.', radky: [{ l: 'Služba', po: b.url }], tlacitko: 'Odpojit', nebezpecne: true })) return;
    await vypniUpozorneni(b).catch(() => {});
    const { banka: _b, ...zbytek } = n;
    await akce.ulozNastaveni(zbytek);
    zapomenStavBanky();
    setStav(null);
    toast('Odpojeno');
  }

  return (
    <>
      <Nadpis>Platby z banky</Nadpis>
      <section id="banka" className="card-soft-2 space-y-3 p-4">
        {!b && (
          <p className="text-sm text-muted-foreground">Příchozí platby z Fio se mohou načítat samy každé ráno. Napojení se zapíná odkazem, který vytvoří příprava služby (návod v projektu: docs/banka-napojeni.md).</p>
        )}
        {b && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-over-soft text-status-over"><Landmark className="size-5" /></span>
              <p className="min-w-0 flex-1 text-sm"><b className="block">Napojeno</b><span className="block truncate text-xs text-muted-foreground">{b.url}</span></p>
            </div>
            {stav?.ucty.map((u, i) => (
              <div key={i} className="rounded-2xl bg-muted px-3 py-2 text-xs">
                <b className="block text-sm">{BANKY[u.banka] ?? u.banka} {u.ucet ?? ''}</b>
                {u.chyba ? <span className="font-semibold text-status-debt">{u.chyba}</span> : <span className="text-muted-foreground">Naposledy načteno {cas(u.posledni)}</span>}
              </div>
            ))}
            {stav && !stav.ucty.length && <p className="text-xs text-muted-foreground">Služba zatím nemá žádný účet (chybí token Fio) nebo ještě neproběhlo první načtení.</p>}
            {stav && stav.fronta > 0 && (
              <Link to="/import?banka=1" className="card-hero flex h-12 items-center justify-center text-sm font-bold">Zkontrolovat {pocet(stav.fronta, 'novou platbu', 'nové platby', 'nových plateb')}</Link>
            )}
            {lzeUpozornit() && (
              <button onClick={() => upozorneni(!b.upozorneni)} disabled={pracuji} className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-muted text-sm font-bold disabled:opacity-50">
                {b.upozorneni ? <><BellOff className="size-4" />Vypnout upozornění</> : <><Bell className="size-4" />Zapnout upozornění v telefonu</>}
              </button>
            )}
            <button onClick={odpojit} className="h-11 w-full rounded-2xl bg-status-debt-soft text-sm font-bold text-status-debt">Odpojit</button>
          </>
        )}
        <Chyba text={chyba} />
      </section>
    </>
  );
}
