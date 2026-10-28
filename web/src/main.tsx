import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Nová verze převzala řízení → znovu načíst, ale JEN hned po spuštění (do 8 s). Později by
  // načtení mohlo přerušit rozpracovaný zápis; nová verze se pak projeví při příštím spuštění.
  const meloRizeni = !!navigator.serviceWorker.controller;
  let nacteno = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (meloRizeni && !nacteno && performance.now() < 8000) { nacteno = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js').then(r => r.update());
}
