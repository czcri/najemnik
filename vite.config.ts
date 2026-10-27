import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Aplikace je ve složce web/, sdílená logika v core/ (testuje se zvlášť v node).
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react(), tailwindcss()],
  // Grafy (recharts) jsou velké; aplikace se po prvním načtení spouští z mezipaměti telefonu.
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 1000 },
  server: { port: 5173 },
});
