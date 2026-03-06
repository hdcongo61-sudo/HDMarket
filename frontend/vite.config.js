import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import autoprefixer from 'autoprefixer';

const buildId =
  process.env.VITE_APP_BUILD_ID ||
  process.env.npm_package_version ||
  new Date().toISOString().replace(/[-:.TZ]/g, '');

export default defineConfig({
  base: '/',
  cacheDir: 'node_modules/.vite-tailwind4',
  define: {
    __HDMARKET_BUILD_ID__: JSON.stringify(buildId)
  },
  plugins: [tailwindcss()],
  css: {
    postcss: {
      plugins: [autoprefixer()]
    }
  }
});
