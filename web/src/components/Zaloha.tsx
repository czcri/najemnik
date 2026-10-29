// Data a záloha (Nastavení): záloha do telefonu, poslat jinam, obnova.
import { Download, Share2, Upload } from 'lucide-react';
import { useToast } from './ui';
import { useData } from '../data/store';
import { datumCz, pocet } from '../lib/format';
import { ZALOHA_PO_DNECH, lzeSdilet, prectiZalohu, sdilejZalohu, stahniZalohu, zalohaStara } from '../lib/zaloha';

export function Zaloha() {
  const { data, dnes, akce } = useData();
  const toast = useToast();
  const stara = zalohaStara(data.nastaveni.posledniZaloha, dnes, data.najemnici.length > 0);
  const oznac = () => akce.ulozNastaveni({ ...data.nastaveni, posledniZaloha: dnes });

  async function obnov(f: File | undefined) {
    if (!f) return;
    try {
      const { data: z, varovani } = await prectiZalohu(f);
      const pocty = (d: typeof z) => `${d.najemnici.length} nájemníků, ${d.platby.length} plateb, ${d.vydaje.length} výdajů, ${d.upominky.length} upomínek`;
      if (!confirm(`Obnovit ze zálohy ${f.name}?\n\nV záloze: ${pocty(z)} + nastavení (šablony, účty).\nTeď v telefonu: ${pocty(data)}.\n\nSoučasná data se NAHRADÍ. Před obnovou se jejich záloha automaticky uloží do Stažených souborů.${varovani.length ? `\n\nPozor: ${varovani.join(' ')}` : ''}`)) return;
      if (data.najemnici.length || data.platby.length) stahniZalohu(data);
      await akce.nahradVse(z);
      toast('Data obnovena ze zálohy');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section id="zaloha" className={`rounded-[24px] p-5 ${stara ? 'bg-status-due-soft' : 'card-soft-2'}`}>
      <h2 className="font-extrabold">Data a záloha</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Poslední záloha: <b className={stara ? 'text-status-due' : 'text-foreground'}>{data.nastaveni.posledniZaloha ? datumCz(data.nastaveni.posledniZaloha) : 'zatím žádná'}</b>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Data jsou uložena jen v tomto telefonu. Zálohujte aspoň jednou za 2–3 měsíce{stara ? ` – připomínka se ukazuje po ${ZALOHA_PO_DNECH} dnech` : ''}.</p>
      <div className="mt-4 space-y-2">
        <button onClick={async () => { stahniZalohu(data); await oznac(); toast('Záloha uložena do Stažených souborů'); }}
          className="card-hero flex h-14 w-full items-center justify-center gap-2 font-bold"><Download className="size-5" />Zálohovat do telefonu</button>
        {lzeSdilet() && (
          <button onClick={async () => { try { if (await sdilejZalohu(data)) { await oznac(); toast('Záloha odeslána'); } } catch { toast('Sdílení se nepodařilo'); } }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-muted font-bold"><Share2 className="size-4" />Poslat zálohu jinam (e-mail, Disk…)</button>
        )}
        <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-muted font-bold">
          <Upload className="size-4" />Obnovit ze zálohy
          <input type="file" accept=".json,application/json" className="hidden" onChange={e => { obnov(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Obnova nahradí všechna současná data obsahem zálohy. Záloha v telefonu chrání před smazáním dat aplikace; proti ztrátě telefonu občas pošlete zálohu jinam.</p>
      <p className="mt-2 text-xs text-muted-foreground">{pocet(data.najemnici.length, 'nájemník', 'nájemníci', 'nájemníků')} · {pocet(data.platby.length, 'platba', 'platby', 'plateb')} · {pocet(data.vydaje.length, 'výdaj', 'výdaje', 'výdajů')}</p>
    </section>
  );
}

