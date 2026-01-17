import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  cacheDir: 'node_modules/.vite-tailwind4',
  plugins: [tailwindcss()],
  css: {
    postcss: {
      plugins: [autoprefixer()]
    }
  }
});
