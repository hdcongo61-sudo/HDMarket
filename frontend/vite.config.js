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
  esbuild: {
    drop: ['console', 'debugger']
  },
  css: {
    postcss: {
      plugins: [autoprefixer()]
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('exceljs')) return 'vendor-exceljs';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('framer-motion') || id.includes('/motion/')) return 'vendor-motion';
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('socket.io-client')) return 'vendor-socket';
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor-react';
          }
          return undefined;
        }
      }
    }
  }
});
