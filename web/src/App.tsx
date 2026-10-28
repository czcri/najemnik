import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DataProvider, useData } from './data/store';
import { ToastProvider, useToast } from './components/ui';
import { maKoncept } from './lib/pamet';
import { Uvod } from './components/Uvod';
import Prehled from './screens/Prehled';
import Najemnici from './screens/Najemnici';
import Detail from './screens/Detail';
import Platby from './screens/Platby';
import Dluznici from './screens/Dluznici';
import VlozitPlatbu from './screens/VlozitPlatbu';
import Statistiky from './screens/Statistiky';
import Import from './screens/Import';
import Nastaveni from './screens/Nastaveni';

// Při přechodu na jinou obrazovku nahoru; odkaz s #kotvou (např. #zaloha) na ni posune.
function Posun() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const kotva = hash && document.getElementById(hash.slice(1));
    if (kotva) setTimeout(() => kotva.scrollIntoView({ behavior: 'smooth' }), 50);
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

// Po obnovení aplikace s rozpracovaným zápisem krátce oznámit, že se pokračuje.
const obnovaPriStartu = maKoncept();
function HlaskaObnovy() {
  const toast = useToast();
  const { nacteno } = useData();
  useEffect(() => { if (nacteno && obnovaPriStartu) toast('Pokračujete v rozpracovaném zápisu'); }, [nacteno, toast]);
  return null;
}

function Obrazovky() {
  const { nacteno, chyba } = useData();
  if (!nacteno) return <p className="p-10 text-center text-muted-foreground">Načítám…</p>;
  if (chyba) return <p className="p-10 text-center text-muted-foreground">Nepodařilo se otevřít data v telefonu.<br /><small>{chyba}</small></p>;
  return (
    <Routes>
      <Route path="/" element={<Prehled />} />
      <Route path="/najemnici" element={<Najemnici />} />
      <Route path="/najemnici/:id" element={<Detail />} />
      <Route path="/platby" element={<Platby />} />
      <Route path="/dluznici" element={<Dluznici />} />
      <Route path="/vlozit-platbu" element={<VlozitPlatbu />} />
      <Route path="/statistiky" element={<Statistiky />} />
      <Route path="/import" element={<Import />} />
      <Route path="/nastaveni" element={<Nastaveni />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Posun />
      <DataProvider>
        <ToastProvider>
          <Obrazovky />
          <HlaskaObnovy />
          <Uvod />
        </ToastProvider>
      </DataProvider>
    </HashRouter>
  );
}
