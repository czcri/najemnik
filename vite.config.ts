import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Do service workeru vloží jedinečné číslo sestavení – telefon tak pozná novou verzi
// a stáhne ji celou (seznam souborů v soubory.json).
function cisloSestaveni(): Plugin {
  return {
    name: 'cislo-sestaveni',
    apply: 'build',
    closeBundle() {
      const sw = 'dist/sw.js';
      writeFileSync(sw, readFileSync(sw, 'utf8').replace('__SESTAVENI__', Date.now().toString(36)));
    },
  };
}

// Aplikace je ve složce web/, sdílená logika v core/ (testuje se zvlášť v node).
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react(), tailwindcss(), cisloSestaveni()],
  // Grafy (recharts) jsou velké; aplikace se po prvním načtení spouští z mezipaměti telefonu.
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 1000, manifest: 'soubory.json' },
  server: { port: 5173 },
});
