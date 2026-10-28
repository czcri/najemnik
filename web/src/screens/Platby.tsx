import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell, Card, Main, Nadpis, VolbaMesice, Zalozky, ZpusobIkona } from '../components/ui';
import { RadekNajemnika } from './Najemnici';
import { ZdrojStitek } from './Detail';
import { useData } from '../data/store';
import { mesicZData, obdobiPlatby, zpusobPlatby } from '../lib/core';
import { NazevMesice, datumCz, datumKratce, kc, nazevMesice, pocet } from '../lib/format';
import type { Najemnik, Platba } from '../types';

// Dvě záložky: „Přijato v měsíci“ (podle data přijetí, výchozí) a „Za měsíc“ (podle měsíce, za který platba je).
export default function Platby() {
  const { data, dnes } = useData();
  const aktualni = mesicZData(dnes);
  const [mesic, setMesic] = useState(aktualni);
  const [zalozka, setZalozka] = useState<'prijato' | 'za'>('prijato');
  // Nejstarší měsíc = začátek prvního nájmu; do budoucna nelze (předpisy ještě nevznikly).
  const nejstarsi = data.najemnici.map(n => n.zacatek).sort()[0] ?? aktualni;
  const podleId = new Map(data.najemnici.map(n => [n.id, n]));

  return (
    <AppShell title="Platby" active="Platby">
      <Main>
        <div className="mb-4"><VolbaMesice hodnota={mesic} min={nejstarsi} max={aktualni} onChange={setMesic} /></div>
        {mesic !== aktualni && (
          <button onClick={() => setMesic(aktualni)} className="-mt-2 mb-4 w-full text-center text-sm font-semibold text-primary">Zpět na aktuální měsíc</button>
        )}
        <Zalozky hodnota={zalozka} onChange={setZalozka} volby={[{ k: 'prijato', l: 'Přijato v měsíci' }, { k: 'za', l: 'Za měsíc' }]} />
        {zalozka === 'prijato' ? <PrijatoVMesici mesic={mesic} podleId={podleId} /> : <ZaMesic mesic={mesic} podleId={podleId} />}
      </Main>
    </AppShell>
  );
}

function RadekPlatby({ p, n, mesic, ukazZa }: { p: Platba; n?: Najemnik; mesic: string; ukazZa: boolean }) {
  const za = obdobiPlatby(p, n);
  return (
    <Link to={`/najemnici/${p.najemnikId}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-muted">
      <ZpusobIkona m={zpusobPlatby(p, n)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{n?.jmeno ?? '—'}</p>
        <p className="text-xs text-muted-foreground">
          {mesicZData(p.datum) === mesic ? datumKratce(p.datum) : datumCz(p.datum)} <ZdrojStitek p={p} />
          {ukazZa && za !== mesic && <b className="ml-1 font-semibold text-status-over">za {nazevMesice(za)}</b>}
        </p>
      </div>
      <p className="text-sm font-bold text-status-ok tabular">+{kc(p.castka)}</p>
    </Link>
  );
}

function PrijatoVMesici({ mesic, podleId }: { mesic: string; podleId: Map<string, Najemnik> }) {
  const { data, dnes } = useData();
  const platby = data.platby.filter(p => mesicZData(p.datum) === mesic).sort((a, b) => b.datum.localeCompare(a.datum));
  const soucet = (f: (p: Platba) => boolean) => platby.filter(f).reduce((s, p) => s + p.castka, 0);
  const ucet = soucet(p => zpusobPlatby(p, podleId.get(p.najemnikId)) === 'ucet');
  const hotove = soucet(p => zpusobPlatby(p, podleId.get(p.najemnikId)) === 'hotove');
  return (
    <>
      <section className="card-navy mt-4 p-5">
        <p className="text-sm opacity-70">{mesic === mesicZData(dnes) ? 'Přišlo tento měsíc' : 'Přišlo v tomto měsíci'}</p>
        <p className="text-[34px] leading-tight font-extrabold tabular">{kc(ucet + hotove)}</p>
        <p className="mt-2 text-sm opacity-80 tabular">na účet {kc(ucet)} · hotově {kc(hotove)} · {pocet(platby.length, 'platba', 'platby', 'plateb')}</p>
      </section>
      <Nadpis>Přijaté platby · {NazevMesice(mesic)}</Nadpis>
      <Card>
        {platby.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">V tomto měsíci zatím nic nepřišlo.</p>}
        {platby.map(p => <RadekPlatby key={p.id} p={p} n={podleId.get(p.najemnikId)} mesic={mesic} ukazZa />)}
      </Card>
    </>
  );
}

function ZaMesic({ mesic, podleId }: { mesic: string; podleId: Map<string, Najemnik> }) {
  const { data, dnes, prehled } = useData();
  const minuly = mesic < mesicZData(dnes);
  // Nájemníci, kteří v daném měsíci měli platit (i ti, jejichž nájem mezitím skončil).
  const radkyMesice = prehled.map(r => ({ r, m: r.radky.find(x => x.mesic === mesic) })).filter(x => x.m && x.m.mel > 0);
  const zaplatili = radkyMesice.filter(x => x.m!.chybi === 0);
  const nezaplatili = radkyMesice.filter(x => x.m!.chybi > 0).sort((a, b) => b.m!.chybi - a.m!.chybi);
  const ocekavano = radkyMesice.reduce((s, x) => s + x.m!.mel, 0);
  // Platby ZA tento měsíc (i ty zaplacené dopředu v předchozím měsíci nebo později jako doplatek).
  const platby = data.platby.filter(p => obdobiPlatby(p, podleId.get(p.najemnikId)) === mesic).sort((a, b) => b.datum.localeCompare(a.datum));
  const prislo = platby.reduce((s, p) => s + p.castka, 0);
  return (
    <>
      <section className="card-navy mt-4 p-5">
        <p className="text-sm opacity-70">Zaplatilo</p>
        <p className="text-[34px] leading-tight font-extrabold tabular">{zaplatili.length} z {radkyMesice.length}</p>
        <div className="mt-3 flex gap-1">
          {radkyMesice.map(x => <span key={x.r.najemnik.id} className={`h-2 flex-1 rounded-full ${x.m!.chybi === 0 ? 'bg-[oklch(0.7_0.13_162)]' : x.m!.chybi < x.m!.mel ? 'bg-[oklch(0.75_0.14_65)]' : 'bg-white/15'}`} />)}
        </div>
        <p className="mt-4 text-sm opacity-80 tabular">Za {nazevMesice(mesic)} přišlo {kc(prislo)} z {kc(ocekavano)}</p>
      </section>

      {nezaplatili.length > 0 && <>
        <Nadpis>{minuly ? 'Dosud nezaplaceno' : 'Ještě nezaplatili'} · {nezaplatili.length}</Nadpis>
        <Card>{nezaplatili.map(({ r, m }) => (
          <RadekNajemnika key={r.najemnik.id} r={r} vpravo={
            <p className="text-xs font-semibold text-status-due tabular">{m!.chybi < m!.mel ? `Zaplatil ${kc(m!.mel - m!.chybi)} z ${kc(m!.mel)}` : minuly ? 'Nezaplaceno' : 'Ještě nezaplatil'}</p>} />
        ))}</Card>
      </>}
      {zaplatili.length > 0 && <>
        <Nadpis>Zaplaceno · {zaplatili.length}</Nadpis>
        <Card>{zaplatili.map(({ r }) => <RadekNajemnika key={r.najemnik.id} r={r} vpravo={<p className="text-xs font-bold text-status-ok">Zaplaceno ✓</p>} />)}</Card>
      </>}

      <Nadpis>Platby za {nazevMesice(mesic)}</Nadpis>
      <Card>
        {platby.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Za tento měsíc zatím žádná platba.</p>}
        {platby.map(p => <RadekPlatby key={p.id} p={p} n={podleId.get(p.najemnikId)} mesic={mesic} ukazZa={false} />)}
      </Card>
    </>
  );
}
