import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell, Card, Main, Nadpis, VolbaMesice, ZpusobIkona } from '../components/ui';
import { RadekNajemnika } from './Najemnici';
import { ZdrojStitek } from './Detail';
import { useData } from '../data/store';
import { mesicZData, obdobiPlatby, zpusobPlatby } from '../lib/core';
import { NazevMesice, datumCz, datumKratce, kc } from '../lib/format';

export default function Platby() {
  const { data, dnes, prehled } = useData();
  const aktualni = mesicZData(dnes);
  const [mesic, setMesic] = useState(aktualni);
  // Nejstarší měsíc = začátek prvního nájmu; do budoucna nelze (předpisy ještě nevznikly).
  const nejstarsi = data.najemnici.map(n => n.zacatek).sort()[0] ?? aktualni;
  const nastav = (m: string) => { if (/^\d{4}-\d{2}$/.test(m)) setMesic(m > aktualni ? aktualni : m < nejstarsi ? nejstarsi : m); };
  const minuly = mesic < aktualni;
  // Nájemníci, kteří v daném měsíci měli platit (i ti, jejichž nájem mezitím skončil).
  const radkyMesice = prehled
    .map(r => ({ r, m: r.radky.find(x => x.mesic === mesic) }))
    .filter(x => x.m && x.m.mel > 0);
  const zaplatili = radkyMesice.filter(x => x.m && x.m.chybi === 0);
  const nezaplatili = radkyMesice.filter(x => x.m && x.m.chybi > 0).sort((a, b) => b.m!.chybi - a.m!.chybi);
  const ocekavano = radkyMesice.reduce((s, x) => s + (x.m?.mel ?? 0), 0);
  const podleId = new Map(data.najemnici.map(n => [n.id, n]));
  // Platby ZA tento měsíc (i ty zaplacené dopředu v předchozím měsíci nebo později jako doplatek).
  const platbyMesice = data.platby.filter(p => obdobiPlatby(p, podleId.get(p.najemnikId)) === mesic).sort((a, b) => b.datum.localeCompare(a.datum));
  const prislo = platbyMesice.reduce((s, p) => s + p.castka, 0);

  return (
    <AppShell title="Platby" active="Platby">
      <Main>
        <div className="mb-4"><VolbaMesice hodnota={mesic} min={nejstarsi} max={aktualni} onChange={nastav} /></div>
        {mesic !== aktualni && (
          <button onClick={() => setMesic(aktualni)} className="-mt-2 mb-4 w-full text-center text-sm font-semibold text-primary">Zpět na aktuální měsíc</button>
        )}
        <section className="card-navy p-5">
          <p className="text-sm opacity-70">Zaplatilo</p>
          <p className="text-[34px] leading-tight font-extrabold tabular">{zaplatili.length} z {radkyMesice.length}</p>
          <div className="mt-3 flex gap-1">
            {radkyMesice.map(x => <span key={x.r.najemnik.id} className={`h-2 flex-1 rounded-full ${x.m && x.m.chybi === 0 ? 'bg-[oklch(0.7_0.13_162)]' : x.m && x.m.chybi < x.m.mel ? 'bg-[oklch(0.75_0.14_65)]' : 'bg-white/15'}`} />)}
          </div>
          <p className="mt-4 text-sm opacity-80 tabular">Přišlo {kc(prislo)} z {kc(ocekavano)}</p>
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

        <Nadpis>Platby za {NazevMesice(mesic).toLowerCase()}</Nadpis>
        <Card>
          {platbyMesice.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{minuly ? 'Za tento měsíc nepřišla žádná platba.' : 'Za tento měsíc zatím žádná platba.'}</p>}
          {platbyMesice.map(p => {
            const n = podleId.get(p.najemnikId);
            return (
              <Link key={p.id} to={`/najemnici/${p.najemnikId}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-muted">
                <ZpusobIkona m={zpusobPlatby(p, n)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{n?.jmeno ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{mesicZData(p.datum) === mesic ? datumKratce(p.datum) : datumCz(p.datum)} <ZdrojStitek p={p} /></p>
                </div>
                <p className="text-sm font-bold text-status-ok tabular">+{kc(p.castka)}</p>
              </Link>
            );
          })}
        </Card>
      </Main>
    </AppShell>
  );
}
