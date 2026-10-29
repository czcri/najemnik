// Upomínka: výběr šablony → náhled (lze upravit) → SMS / WhatsApp / e-mail; odeslání se zapíše do historie.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../data/store';
import { doplnSablonu, odkaz } from '../lib/zpravy';
import { noveId } from '../lib/format';
import { Panel } from './ui';
import type { Kanal, Najemnik } from '../types';
import { usePamet } from '../lib/pamet';

// castka / mesic: upomínka z karty konkrétního měsíce – do {dluh} a {mesic} jde částka z karty.
export function PanelUpominky({ najemnik, onClose, castka, mesic }: { najemnik: Najemnik; onClose: () => void; castka?: number; mesic?: string }) {
  const { data, dnes, stav, akce } = useData();
  const celkovy = stav(najemnik.id);
  const s = castka !== undefined ? { ...celkovy, dluh: castka, tentoMesic: 0 } : celkovy;
  const sablony = data.nastaveni.sablony;
  // Výchozí šablona podle situace: dluh → upomínka, jinak připomínka / potvrzení.
  const vychozi = Math.max(0, sablony.findIndex(x => x.id === (s.dluh > 0 ? 'po-splatnosti' : s.tentoMesic > 0 ? 'pripominka' : 'potvrzeni')));
  const [i, setI] = usePamet(`zprava:${najemnik.id}:sablona`, vychozi);
  const [text, setText] = usePamet(`zprava:${najemnik.id}:text`, sablony[i] ? doplnSablonu(sablony[i].text, najemnik, s, dnes, data.nastaveni, mesic) : '', `${castka}:${mesic}`);
  const vyber = (n: number) => { setI(n); setText(doplnSablonu(sablony[n].text, najemnik, s, dnes, data.nastaveni, mesic)); };

  const kanaly: { k: Kanal; l: string; ok: boolean }[] = [
    { k: 'sms', l: 'SMS', ok: !!najemnik.telefon },
    { k: 'whatsapp', l: 'WhatsApp', ok: !!najemnik.telefon },
    { k: 'email', l: 'E-mail', ok: true },
  ];
  // Zapsat do historie až po klepnutí (odkaz otevře příslušnou aplikaci).
  const zapis = (k: Kanal) => akce.pridejUpominku({ id: noveId(), najemnikId: najemnik.id, datum: dnes, kanal: k, text, sablona: sablony[i]?.nazev });

  return (
    <Panel title={`Zpráva · ${najemnik.jmeno}`} onClose={onClose}>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {sablony.map((sb, n) => (
          <button key={sb.id} onClick={() => vyber(n)} className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${i === n ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{sb.nazev}</button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6} className="mt-4 w-full rounded-2xl bg-muted p-4 text-sm outline-none" />
      <p className="mt-1 px-1 text-xs text-muted-foreground">Text můžete před odesláním upravit. <Link to="/nastaveni" className="font-semibold text-primary">Upravit šablony</Link></p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {kanaly.map(k => k.ok ? (
          <a key={k.k} href={odkaz(k.k, najemnik, text)} target={k.k === 'whatsapp' ? '_blank' : undefined} rel="noreferrer"
            onClick={() => { zapis(k.k); setTimeout(onClose, 300); }}
            className={`flex h-12 items-center justify-center rounded-2xl font-bold ${k.k === 'sms' ? 'card-hero' : 'bg-muted'}`}>{k.l}</a>
        ) : (
          <span key={k.k} title="Chybí telefon" className="flex h-12 items-center justify-center rounded-2xl bg-muted font-bold opacity-40">{k.l}</span>
        ))}
      </div>
      {!najemnik.telefon && <p className="mt-2 px-1 text-xs text-muted-foreground">Pro SMS a WhatsApp doplňte nájemníkovi telefon.</p>}
    </Panel>
  );
}
