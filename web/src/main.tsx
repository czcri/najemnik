import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Nová verze převzala řízení → jednou znovu načíst, ať hned běží nový kód (ne až při dalším otevření).
  const meloRizeni = !!navigator.serviceWorker.controller;
  let nacteno = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (meloRizeni && !nacteno) { nacteno = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js').then(r => r.update());
}
