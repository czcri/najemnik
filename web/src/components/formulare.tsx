// Formuláře ve spodním panelu: platba, nájemník, výdaj / dluh, změna nájmu.
import { useState, type FormEvent } from 'react';
import { Banknote, Landmark, Plus, Trash2 } from 'lucide-react';
import { useData } from '../data/store';
import { aktualniNajem, castkaPredpisu, mesicZData, navrhPlatby, normalizujUcet, obdobiPlatby, parseCastka, zmenNajem } from '../lib/core';
import { datumCz, kc, nazevMesice, noveId, odMesice, posunMesic } from '../lib/format';
import { Chyba, NapovedaCastky, Panel, Pole, Prepinac, Tlacitko, VSTUP, VolbaMesice, useToast } from './ui';
import type { Najemnik, Platba, Vydaj, Zpusob } from '../types';
import { usePamet } from '../lib/pamet';

const BANKY: Record<string, string> = { fio: 'Fio', cs: 'Česká spořitelna', kb: 'Komerční banka' };
const ZPUSOBY = [{ k: 'prevod' as const, l: 'Převodem', i: Landmark }, { k: 'hotove' as const, l: 'Hotově', i: Banknote }];

export function vysledekPoPlatbe(s: { dluh: number; tentoMesic: number; preplatek: number }) {
  const zbyva = s.dluh + s.tentoMesic;
  if (zbyva > 0) return { text: `Zbývá dluh ${kc(zbyva)}`, ok: false };
  if (s.preplatek > 0) return { text: `Přeplatek ${kc(s.preplatek)}`, ok: true };
  return { text: 'Vše uhrazeno ✓', ok: true };
}

export function FormPlatba({ najemnik, platba, onClose }: { najemnik: Najemnik; platba?: Platba; onClose: () => void }) {
  const { akce, dnes, data } = useData();
  const toast = useToast();
  // Nová platba: za nejstarší nezaplacený / běžný (u „dopředu“ příští) měsíc; pravidelný nájem, nebo doplatek.
  const platbyNajemnika = data.platby.filter(p => p.najemnikId === najemnik.id && p.id !== platba?.id);
  const vydajeNajemnika = data.vydaje.filter(v => v.najemnikId === najemnik.id);
  const navrhZa = (m?: string) => navrhPlatby(najemnik, platbyNajemnika, dnes, vydajeNajemnika, m);
  const k = `platba:${najemnik.id}:${platba?.id ?? 'nova'}`;
  const [zaMesic, setZaMesic] = usePamet(`${k}:zaMesic`, platba ? obdobiPlatby(platba, najemnik) : navrhZa().zaMesic);
  const navrh = navrhZa(zaMesic);
  const predvyplneno = navrh.castka;
  const [datum, setDatum] = usePamet(`${k}:datum`, platba?.datum ?? dnes);
  const [castka, setCastka] = usePamet(`${k}:castka`, String(platba?.castka ?? predvyplneno));
  const [zpusob, setZpusob] = usePamet<'prevod' | 'hotove'>(`${k}:zpusob`, 
    platba?.zdroj?.typ === 'hotove' ? 'hotove' : platba?.zdroj?.typ === 'prevod' ? 'prevod' : najemnik.zpusobPlaceni === 'hotove' ? 'hotove' : 'prevod');
  const [poznamka, setPoznamka] = usePamet(`${k}:poznamka`, platba?.poznamka ?? '');
  const [chyba, setChyba] = useState<string | null>(null);
  const zVypisu = platba?.zdroj?.typ === 'vypis' ? platba.zdroj : null;

  async function uloz(e: FormEvent) {
    e.preventDefault();
    const c = parseCastka(castka);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return setChyba('Vyplňte datum.');
    if (!c) return setChyba('Částka musí být kladné celé číslo v korunách.');
    await akce.ulozPlatbu({
      ...platba, id: platba?.id ?? noveId(), najemnikId: najemnik.id, datum, castka: c, zaMesic, poznamka: poznamka.trim(),
      zdroj: zVypisu ?? { typ: zpusob },
    });
    toast(platba ? 'Platba upravena' : 'Platba uložena');
    onClose();
  }
  async function smaz() {
    if (!platba || !confirm(`Smazat platbu ${kc(platba.castka)} z ${datumCz(platba.datum)}?`)) return;
    await akce.smazPlatbu(platba.id);
    toast('Platba smazána');
    onClose();
  }

  return (
    <Panel title={platba ? 'Upravit platbu' : `Platba · ${najemnik.jmeno}`} onClose={onClose}>
      <form onSubmit={uloz} className="space-y-4">
        <Pole label="Částka">
          <div className="flex h-16 items-center rounded-2xl border border-border bg-card px-4 focus-within:border-primary">
            <input inputMode="numeric" value={castka} onChange={e => setCastka(e.target.value)} autoFocus={!platba}
              className="min-w-0 flex-1 bg-transparent text-[28px] font-extrabold tabular outline-none" />
            <span className="text-lg font-bold text-muted-foreground">Kč</span>
          </div>
          {!platba && <NapovedaCastky navrh={navrh} mesic={nazevMesice(zaMesic)} />}
        </Pole>
        <div>
          <span className="mb-1.5 block px-1 text-sm font-bold text-muted-foreground">Za měsíc</span>
          <VolbaMesice hodnota={zaMesic} min={najemnik.zacatek} max={posunMesic(mesicZData(dnes), 12)} kompaktni
            onChange={m => { setZaMesic(m); if (!platba) setCastka(String(navrhZa(m).castka)); }} />
        </div>
        <Pole label="Datum"><input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={VSTUP} /></Pole>
        {zVypisu
          ? <p className="rounded-2xl bg-status-over-soft p-3 text-sm text-status-over">
              Importováno z výpisu ({BANKY[zVypisu.banka]}, {zVypisu.ucet}){zVypisu.protiucet && ` · plátce ${zVypisu.protiucet}`}{zVypisu.nazevProtiuctu && ` (${zVypisu.nazevProtiuctu})`}{zVypisu.vs && ` · VS ${zVypisu.vs}`}
            </p>
          : <Pole label="Způsob platby"><Prepinac hodnota={zpusob} volby={ZPUSOBY} onChange={setZpusob} /></Pole>}
        <Pole label="Poznámka"><input value={poznamka} onChange={e => setPoznamka(e.target.value)} maxLength={200} placeholder="nepovinné" className={VSTUP} /></Pole>
        <Chyba text={chyba} />
        <Tlacitko type="submit">Uložit platbu</Tlacitko>
        {platba && <Tlacitko typ="nebezpecne" onClick={smaz}><Trash2 className="size-5" />Smazat platbu</Tlacitko>}
      </form>
    </Panel>
  );
}

export function FormVydaj({ najemnik, vydaj, onClose }: { najemnik: Najemnik; vydaj?: Vydaj; onClose: () => void }) {
  const { akce, dnes, data } = useData();
  const toast = useToast();
  const prvni = !data.vydaje.some(v => v.najemnikId === najemnik.id) && !data.platby.some(p => p.najemnikId === najemnik.id);
  const k = `vydaj:${najemnik.id}:${vydaj?.id ?? 'novy'}`;
  const [datum, setDatum] = usePamet(`${k}:datum`, vydaj?.datum ?? dnes);
  const [popis, setPopis] = usePamet(`${k}:popis`, vydaj?.popis ?? (prvni ? 'Počáteční dluh' : ''));
  const [castka, setCastka] = usePamet(`${k}:castka`, vydaj ? String(vydaj.castka) : '');
  const [chyba, setChyba] = useState<string | null>(null);

  async function uloz(e: FormEvent) {
    e.preventDefault();
    const c = parseCastka(castka);
    if (!popis.trim()) return setChyba('Vyplňte popis (např. „Oprava bojleru“).');
    if (!c) return setChyba('Částka musí být kladné celé číslo v korunách.');
    await akce.ulozVydaj({ id: vydaj?.id ?? noveId(), najemnikId: najemnik.id, datum, castka: c, popis: popis.trim() });
    toast('Uloženo');
    onClose();
  }
  async function smaz() {
    if (!vydaj || !confirm(`Smazat „${vydaj.popis}“ (${kc(vydaj.castka)})?`)) return;
    await akce.smazVydaj(vydaj.id);
    onClose();
  }
  return (
    <Panel title={vydaj ? 'Upravit výdaj / dluh' : 'Výdaj / dluh'} onClose={onClose}>
      <form onSubmit={uloz} className="space-y-4">
        <p className="text-sm text-muted-foreground">Jednorázová částka, kterou má {najemnik.jmeno} zaplatit navíc k nájmu – oprava, doplatek, nebo dluh z doby před zahájením evidence.</p>
        <Pole label="Popis"><input value={popis} onChange={e => setPopis(e.target.value)} placeholder="Oprava bojleru" className={VSTUP} /></Pole>
        <Pole label="Částka (Kč)"><input inputMode="numeric" value={castka} onChange={e => setCastka(e.target.value)} className={VSTUP} /></Pole>
        <Pole label="Datum" napoveda="Částka se přičte k měsíci tohoto data a je splatná do jeho konce.">
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={VSTUP} />
        </Pole>
        <Chyba text={chyba} />
        <Tlacitko type="submit">Uložit</Tlacitko>
        {vydaj && <Tlacitko typ="nebezpecne" onClick={smaz}><Trash2 className="size-5" />Smazat</Tlacitko>}
      </form>
    </Panel>
  );
}

export function FormNajem({ najemnik, onClose }: { najemnik: Najemnik; onClose: () => void }) {
  const { akce, dnes } = useData();
  const toast = useToast();
  const [od, setOd] = usePamet(`najem:${najemnik.id}:od`, mesicZData(dnes) < najemnik.zacatek ? najemnik.zacatek : mesicZData(dnes));
  const [castka, setCastka] = usePamet(`najem:${najemnik.id}:castka`, String(aktualniNajem(najemnik, dnes)));
  const [chyba, setChyba] = useState<string | null>(null);
  async function uloz(e: FormEvent) {
    e.preventDefault();
    const c = parseCastka(castka);
    if (!/^\d{4}-\d{2}$/.test(od)) return setChyba('Vyplňte měsíc.');
    if (od < najemnik.zacatek) return setChyba(`Nájem začíná od ${odMesice(najemnik.zacatek)} – změna nemůže být dřív.`);
    if (!c) return setChyba('Nájem musí být kladné celé číslo v korunách.');
    await akce.ulozNajemnika({ ...najemnik, predpisy: zmenNajem(najemnik.predpisy, od, c) });
    toast('Nájem změněn');
    onClose();
  }
  return (
    <Panel title="Změnit nájem" onClose={onClose}>
      <form onSubmit={uloz} className="space-y-4">
        <Pole label="Od měsíce"><input type="month" value={od} onChange={e => setOd(e.target.value)} className={VSTUP} /></Pole>
        <Pole label="Nový nájem měsíčně vč. služeb (Kč)" napoveda="Dřívější měsíce se nezmění.">
          <input inputMode="numeric" value={castka} onChange={e => setCastka(e.target.value)} className={VSTUP} />
        </Pole>
        <Chyba text={chyba} />
        <Tlacitko type="submit">Uložit</Tlacitko>
        <div>
          <p className="mb-2 px-1 text-sm font-bold text-muted-foreground">Historie nájmu</p>
          <div className="card-soft-2 divide-y divide-border overflow-hidden">
            {[...najemnik.predpisy].reverse().map(p => (
              <div key={p.od} className="flex justify-between px-4 py-3 text-sm"><span>od {odMesice(p.od)}</span><b className="tabular">{kc(castkaPredpisu(p))}</b></div>
            ))}
          </div>
        </div>
      </form>
    </Panel>
  );
}

export function FormNajemnik({ najemnik, onClose, onUlozeno }: { najemnik?: Najemnik; onClose: () => void; onUlozeno?: (id: string) => void }) {
  const { akce, dnes, data } = useData();
  const toast = useToast();
  const k = `najemnik:${najemnik?.id ?? 'novy'}`;
  const [f, setF] = usePamet(`${k}:pole`, {
    jmeno: najemnik?.jmeno ?? '', osloveni: najemnik?.osloveni ?? '', oznaceni: najemnik?.oznaceni ?? '',
    zacatek: najemnik?.zacatek ?? mesicZData(dnes), castka: '', telefon: najemnik?.telefon ?? '', email: najemnik?.email ?? '',
    vs: najemnik?.vs ?? '', poznamka: najemnik?.poznamka ?? '', konec: najemnik?.konec ?? '', platiDopredu: najemnik?.platiDopredu ? 'ano' : 'ne',
    ucetProPlatby: najemnik?.ucetProPlatby ?? '', denHotovosti: najemnik?.denHotovosti ? String(najemnik.denHotovosti) : '',
  });
  const [zpusob, setZpusob] = usePamet<Zpusob>(`${k}:zpusob`, najemnik?.zpusobPlaceni ?? 'ucet');
  const [ucty, setUcty] = usePamet<string[]>(`${k}:ucty`, najemnik?.uctyPlatce ?? []);
  const [novyUcet, setNovyUcet] = usePamet(`${k}:novyUcet`, '');
  const [chyba, setChyba] = useState<string | null>(null);
  const zmen = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  function pridejUcet() {
    const u = normalizujUcet(novyUcet);
    if (!u || !u.includes('/')) return setChyba('Číslo účtu zadejte ve tvaru 123456789/0800.');
    if (!ucty.includes(u)) setUcty([...ucty, u]);
    setNovyUcet('');
    setChyba(null);
  }

  async function uloz(e: FormEvent) {
    e.preventDefault();
    if (!f.jmeno.trim()) return setChyba('Vyplňte jméno.');
    if (!f.oznaceni.trim()) return setChyba('Vyplňte označení nemovitosti.');
    if (!/^\d{4}-\d{2}$/.test(f.zacatek)) return setChyba('Vyplňte, od kdy platí nájem.');
    if (f.konec && f.konec < f.zacatek) return setChyba('Konec nájmu je před jeho začátkem.');
    const den = f.denHotovosti.trim() ? Number(f.denHotovosti) : undefined;
    if (den !== undefined && !(Number.isInteger(den) && den >= 1 && den <= 31)) return setChyba('Den, kdy čekáte hotovost, musí být číslo 1–31.');
    let predpisy: Najemnik['predpisy'];
    if (najemnik) {
      // Posun začátku: nájem platný k novému začátku začne od něj, pozdější změny zůstanou.
      const platny = [...najemnik.predpisy].reverse().find(p => p.od <= f.zacatek) ?? najemnik.predpisy[0];
      predpisy = [{ ...platny, od: f.zacatek }, ...najemnik.predpisy.filter(p => p.od > f.zacatek)];
    } else {
      const c = parseCastka(f.castka);
      if (!c) return setChyba('Nájem musí být kladné celé číslo v korunách.');
      predpisy = zmenNajem([], f.zacatek, c);
    }
    const novy: Najemnik = {
      ...najemnik, id: najemnik?.id ?? noveId(), jmeno: f.jmeno.trim(), oznaceni: f.oznaceni.trim(), zacatek: f.zacatek,
      konec: f.konec || null, predpisy, osloveni: f.osloveni.trim(), telefon: f.telefon.trim(), email: f.email.trim(),
      vs: f.vs.trim(), poznamka: f.poznamka.trim(), zpusobPlaceni: zpusob, uctyPlatce: ucty, ucetProPlatby: f.ucetProPlatby,
      denHotovosti: zpusob === 'hotove' ? den : undefined,
      platiDopredu: f.platiDopredu === 'ano',
    };
    await akce.ulozNajemnika(novy);
    toast('Uloženo');
    onUlozeno?.(novy.id);
    onClose();
  }
  async function smaz() {
    if (!najemnik) return;
    const n = data.platby.filter(p => p.najemnikId === najemnik.id).length;
    if (!confirm(`Opravdu smazat nájemníka ${najemnik.jmeno}${n ? ` i s ${n} platbami` : ''}?\n\nUkončený nájem raději označte „Konec nájmu“ – historie zůstane.`)) return;
    await akce.smazNajemnika(najemnik.id);
    toast('Nájemník smazán');
    onClose();
    location.hash = '#/najemnici';
  }

  return (
    <Panel title={najemnik ? 'Upravit nájemníka' : 'Nový nájemník'} onClose={onClose}>
      <form onSubmit={uloz} className="space-y-4">
        <Pole label="Jméno"><input value={f.jmeno} onChange={zmen('jmeno')} autoFocus={!najemnik} className={VSTUP} /></Pole>
        <Pole label="Způsob placení"><Prepinac hodnota={zpusob} onChange={setZpusob}
          volby={[{ k: 'ucet', l: 'Na účet', i: Landmark }, { k: 'hotove', l: 'Hotově', i: Banknote }]} /></Pole>
        <Pole label="Obvykle platí" napoveda="Podle toho se u nové platby předvybere „Za měsíc“.">
          <Prepinac hodnota={f.platiDopredu} onChange={v => setF({ ...f, platiDopredu: v })}
            volby={[{ k: 'ne', l: 'Za běžný měsíc' }, { k: 'ano', l: 'Dopředu' }]} />
        </Pole>
        {zpusob === 'hotove' && (
          <Pole label="Hotovost čekám k (den v měsíci)" napoveda="Např. 5 = každého 5. Podle toho se řadí seznam Hotovost na přehledu.">
            <input inputMode="numeric" value={f.denHotovosti} onChange={zmen('denHotovosti')} placeholder="1–31" className={VSTUP} />
          </Pole>
        )}
        <Pole label="Nemovitost" napoveda="Adresa nebo vlastní označení, např. „Byt 2 – Kolín“."><input value={f.oznaceni} onChange={zmen('oznaceni')} className={VSTUP} /></Pole>
        <div className="grid grid-cols-2 gap-3">
          <Pole label="Nájem od"><input type="month" value={f.zacatek} onChange={zmen('zacatek')} className={VSTUP} /></Pole>
          {najemnik
            ? <Pole label="Konec nájmu"><input type="month" value={f.konec} onChange={zmen('konec')} className={VSTUP} /></Pole>
            : <Pole label="Nájem vč. služeb"><input inputMode="numeric" value={f.castka} onChange={zmen('castka')} placeholder="Kč" className={VSTUP} /></Pole>}
        </div>
        {najemnik && <p className="px-1 text-xs text-muted-foreground">Konec nájmu vyplňte, až nájem skončí – další měsíce se už nepředepisují. Výši nájmu měníte v detailu „Změnit nájem“.</p>}
        <Pole label="Oslovení ve zprávách" napoveda="Např. „pane Nováku“. Když chybí, použije se jméno."><input value={f.osloveni} onChange={zmen('osloveni')} className={VSTUP} /></Pole>
        <div className="grid grid-cols-2 gap-3">
          <Pole label="Telefon"><input type="tel" value={f.telefon} onChange={zmen('telefon')} className={VSTUP} /></Pole>
          <Pole label="Variabilní symbol"><input inputMode="numeric" value={f.vs} onChange={zmen('vs')} className={VSTUP} /></Pole>
        </div>
        <Pole label="E-mail"><input type="email" value={f.email} onChange={zmen('email')} className={VSTUP} /></Pole>
        {zpusob === 'ucet' && (
          <>
            <Pole label="Platí na můj účet">
              <select value={f.ucetProPlatby} onChange={zmen('ucetProPlatby')} className={VSTUP}>
                <option value="">— neurčeno —</option>
                {data.nastaveni.ucty.map(u => <option key={u.ucet} value={u.ucet}>{u.nazev || u.banka} · {u.ucet}</option>)}
              </select>
            </Pole>
            <div>
              <span className="mb-1.5 block px-1 text-sm font-bold text-muted-foreground">Účty, ze kterých platí</span>
              {ucty.map(u => (
                <div key={u} className="mb-2 flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm tabular">
                  <span className="flex-1">{u}</span>
                  <button type="button" aria-label="Odebrat účet" onClick={() => setUcty(ucty.filter(x => x !== u))}><Trash2 className="size-4 text-muted-foreground" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={novyUcet} onChange={e => setNovyUcet(e.target.value)} placeholder="123456789/0800" className={VSTUP} />
                <button type="button" onClick={pridejUcet} aria-label="Přidat účet" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Plus className="size-5" /></button>
              </div>
              <span className="mt-1 block px-1 text-xs text-muted-foreground">Import z banky si účty doplní sám po prvním přiřazení.</span>
            </div>
          </>
        )}
        <Pole label="Poznámka"><textarea value={f.poznamka} onChange={zmen('poznamka')} rows={2} className={`${VSTUP} h-auto py-3`} /></Pole>
        <Chyba text={chyba} />
        <Tlacitko type="submit">Uložit</Tlacitko>
        {najemnik && <Tlacitko typ="nebezpecne" onClick={smaz}><Trash2 className="size-5" />Smazat nájemníka</Tlacitko>}
      </form>
    </Panel>
  );
}
