// Úvodní obrazovka při každém spuštění aplikace: Nájemník + „Vytvořilo Simply Software“. Klepnutím přeskočit.
import { useEffect, useState } from 'react';
import { LogoSimplySoftware } from './logo';

const DELKA_MS = 3000;
let ukazano = false; // jen při spuštění, ne při přechodech mezi obrazovkami

export function Uvod() {
  const [viditelny, setViditelny] = useState(!ukazano);
  const [mizi, setMizi] = useState(false);
  useEffect(() => {
    if (ukazano) return;
    ukazano = true;
    const t1 = setTimeout(() => setMizi(true), DELKA_MS);
    const t2 = setTimeout(() => setViditelny(false), DELKA_MS + 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  if (!viditelny) return null;
  return (
    <div onClick={() => setViditelny(false)} role="presentation" aria-label="Úvodní obrazovka"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-8 pt-[30vh] pb-[max(3rem,env(safe-area-inset-bottom))]"
      style={mizi ? { animation: 'uvod-zmizet 0.45s ease-in forwards' } : undefined}>
      <div className="flex flex-col items-center" style={{ animation: 'uvod-objevit 0.5s ease-out' }}>
        <img src="ikony/ikona-192.png" alt="" className="size-24 rounded-[28px] shadow-xl" />
        <p className="mt-6 text-4xl font-extrabold tracking-tight">Nájemník</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Nájemníci, nájem a platby</p>
      </div>
      <div className="flex flex-col items-center" style={{ animation: 'uvod-objevit 0.7s ease-out' }}>
        <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Vytvořilo</p>
        <LogoSimplySoftware varianta="pod" className="block h-24" />
      </div>
    </div>
  );
}
