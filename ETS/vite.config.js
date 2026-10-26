import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cpSync } from 'node:fs';

const root = import.meta.dirname;

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        kota: resolve(root, 'kota.html'),
        hutan: resolve(root, 'hutan.html'),
        kota2: resolve(root, 'kota2.html')
      }
    }
  },
  plugins: [{
    name: 'copy-project-assets',
    closeBundle() {
      cpSync(resolve(root, 'assets'), resolve(root, 'dist/assets'), { recursive: true });
    }
  }]
});
