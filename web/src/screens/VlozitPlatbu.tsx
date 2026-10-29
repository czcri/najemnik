import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, CheckCircle2, Landmark, Search } from 'lucide-react';
import { AppShell, Chyba, Main, NapovedaCastky, Pole, Prepinac, Tlacitko, VSTUP, VolbaMesice, ZpusobIkona, useChrana, useToast } from '../components/ui';
import { vysledekPoPlatbe } from '../components/formulare';
import { useData } from '../data/store';
import { aktualniNajem, mesicZData, navrhPlatby, parseCastka, stavNajemnika } from '../lib/core';
import { kc, nazevMesice, noveId, posunMesic } from '../lib/format';
import { usePamet } from '../lib/pamet';

const bezDiakritiky = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function VlozitPlatbu() {
  const { data, dnes, prehled, akce } = useData();
  const toast = useToast();
  const [busy, chran] = useChrana();
  const aktivni = prehled.filter(r => !r.ukonceny);
  const [id, setId] = usePamet('vlozit:id', aktivni.find(r => r.dluh + r.tentoMesic > 0)?.najemnik.id ?? aktivni[0]?.najemnik.id ?? '');
  const [hledat, setHledat] = useState('');
  const r = prehled.find(x => x.najemnik.id === id);
  // Za nejstarší nezaplacený / běžný (u „dopředu“ příští) měsíc; pravidelný nájem, nebo doplatek.
  const navrhPro = (x = r, m?: string) => x ? navrhPlatby(x.najemnik, data.platby.filter(p => p.najemnikId === x.najemnik.id), dnes, data.vydaje.filter(v => v.najemnikId === x.najemnik.id), m) : null;
  const [zaMesic, setZaMesic] = usePamet('vlozit:zaMesic', navrhPro()?.zaMesic ?? mesicZData(dnes));
  const navrh = (x = r, m?: string) => String(navrhPro(x, m)?.castka ?? '');
  const [castka, setCastka] = usePamet('vlozit:castka', navrh(r, zaMesic));
  const [zpusob, setZpusob] = usePamet<'prevod' | 'hotove'>('vlozit:zpusob', r?.najemnik.zpusobPlaceni === 'hotove' ? 'hotove' : 'prevod');
  const [datum, setDatum] = usePamet('vlozit:datum', dnes);
  const [poznamka, setPoznamka] = usePamet('vlozit:poznamka', '');
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState<{ jmeno: string; castka: number; text: string; dalsi: string; ok: boolean; dluh: boolean; id: string } | null>(null);

  const nabidka = useMemo(() => aktivni.filter(x => bezDiakritiky(x.najemnik.jmeno + ' ' + x.najemnik.oznaceni).includes(bezDiakritiky(hledat))), [aktivni, hledat]);

  function vyber(novyId: string) {
    const x = prehled.find(y => y.najemnik.id === novyId);
    setId(novyId);
    const n = navrhPro(x);
    setZaMesic(n?.zaMesic ?? mesicZData(dnes));
    setCastka(String(n?.castka ?? ''));
    setZpusob(x?.najemnik.zpusobPlaceni === 'hotove' ? 'hotove' : 'prevod');
    setHledat('');
  }

  async function uloz(e: FormEvent) {
    e.preventDefault();
    if (!r) return setChyba('Vyberte nájemníka.');
    const c = parseCastka(castka);
    if (!c) return setChyba('Částka musí být kladné celé číslo v korunách.');
    const platba = { id: noveId(), najemnikId: r.najemnik.id, datum, castka: c, zaMesic, poznamka: poznamka.trim(), zdroj: { typ: zpusob } as const };
    await akce.ulozPlatbu(platba);
    // Výsledek spočítat hned z nových dat (stav v kontextu se obnoví až po překreslení).
    const s = stavNajemnika(r.najemnik, [...data.platby.filter(p => p.najemnikId === r.najemnik.id), platba], dnes, data.vydaje.filter(v => v.najemnikId === r.najemnik.id));
    toast('Platba uložena');
    setHotovo({ jmeno: r.najemnik.jmeno, castka: c, id: r.najemnik.id, ...vysledekPoPlatbe(s) });
  }

  if (hotovo) {
    return (
      <AppShell title="Vložit platbu">
        <Main className="flex flex-col items-center pt-12 text-center">
          <span className={`flex size-20 items-center justify-center rounded-full ${hotovo.ok ? 'bg-status-ok-soft text-status-ok' : 'bg-status-due-soft text-status-due'}`}><CheckCircle2 className="size-10" /></span>
          <h2 className={`mt-6 text-2xl font-extrabold ${hotovo.ok ? '' : hotovo.dluh ? 'text-status-debt' : 'text-status-due'}`}>{hotovo.text}</h2>
          {hotovo.dalsi && <p className="mt-1 font-semibold text-status-due">{hotovo.dalsi}</p>}
          <p className="mt-2 text-muted-foreground">{hotovo.jmeno} · {kc(hotovo.castka)} · {zpusob === 'prevod' ? 'převodem' : 'hotově'}</p>
          <Tlacitko className="mt-8" onClick={() => { setHotovo(null); setPoznamka(''); vyber(id); }}>Zapsat další platbu</Tlacitko>
          <Link to={`/najemnici/${hotovo.id}`} className="mt-3 flex h-14 w-full items-center justify-center rounded-[20px] bg-muted font-bold">Detail nájemníka</Link>
        </Main>
      </AppShell>
    );
  }

  if (aktivni.length === 0) {
    return <AppShell title="Vložit platbu"><Main><p className="card-soft-2 p-8 text-center text-sm text-muted-foreground">Nejdřív přidejte nájemníka. <Link to="/najemnici" className="font-bold text-primary">Nájemníci</Link></p></Main></AppShell>;
  }

  return (
    <AppShell title="Vložit platbu" subtitle="Rychlý zápis">
      <Main>
        <form onSubmit={chran(uloz)} className="space-y-5">
          <div>
            <p className="mb-2 px-2 text-sm font-bold text-muted-foreground">Nájemník</p>
            {r && !hledat && (
              <div className="card-soft-2 flex items-center gap-3 p-4">
                <ZpusobIkona m={r.najemnik.zpusobPlaceni ?? 'ucet'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.najemnik.jmeno}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.najemnik.oznaceni} · nájem {kc(aktualniNajem(r.najemnik, dnes))}
                    {r.dluh > 0 && <span className="font-bold text-status-debt"> · dluh {kc(r.dluh)}</span>}
                    {r.tentoMesic > 0 && <span className="font-bold text-status-due"> · tento měsíc {kc(r.tentoMesic)}</span>}</p>
                </div>
              </div>
            )}
            <label className="card-soft mt-2 flex min-h-12 items-center gap-3 px-4">
              <Search className="size-5 text-muted-foreground" />
              <input value={hledat} onChange={e => setHledat(e.target.value)} placeholder="Změnit nájemníka – hledat" className="h-12 flex-1 bg-transparent text-[15px] outline-none" />
            </label>
            {hledat && (
              <div className="card-soft-2 mt-2 max-h-64 divide-y divide-border overflow-y-auto">
                {nabidka.map(x => (
                  <button type="button" key={x.najemnik.id} onClick={() => vyber(x.najemnik.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted">
                    <span className="flex-1"><b className="block text-sm">{x.najemnik.jmeno}</b><span className="text-xs text-muted-foreground">{x.najemnik.oznaceni}</span></span>
                  </button>
                ))}
                {nabidka.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nikdo neodpovídá.</p>}
              </div>
            )}
          </div>
          <Pole label="Částka">
            <div className="card-soft flex h-20 items-center px-5">
              <input inputMode="numeric" value={castka} onChange={e => setCastka(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[34px] font-extrabold tabular outline-none" />
              <span className="text-xl font-bold text-muted-foreground">Kč</span>
            </div>
            {r && <NapovedaCastky navrh={navrhPro(r, zaMesic)!} mesic={nazevMesice(zaMesic)} />}
          </Pole>
          {r && (
            <div>
              <span className="mb-1.5 block px-1 text-sm font-bold text-muted-foreground">Za měsíc</span>
              <VolbaMesice hodnota={zaMesic} min={r.najemnik.zacatek} max={posunMesic(mesicZData(dnes), 12)}
                onChange={m => { setZaMesic(m); setCastka(navrh(r, m)); }} />
            </div>
          )}
          <Pole label="Způsob platby">
            <Prepinac hodnota={zpusob} onChange={setZpusob} volby={[{ k: 'prevod', l: 'Převodem', i: Landmark }, { k: 'hotove', l: 'Hotově', i: Banknote }]} />
          </Pole>
          <div className="grid grid-cols-2 gap-3">
            <Pole label="Datum"><input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={VSTUP} /></Pole>
            <Pole label="Poznámka"><input value={poznamka} onChange={e => setPoznamka(e.target.value)} placeholder="nepovinné" className={VSTUP} /></Pole>
          </div>
          <Chyba text={chyba} />
          <Tlacitko type="submit" disabled={!r || busy}>Uložit platbu</Tlacitko>
        </form>
      </Main>
    </AppShell>
  );
}
