import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import autoprefixer from 'autoprefixer';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const buildId =
  process.env.VITE_APP_BUILD_ID ||
  process.env.npm_package_version ||
  new Date().toISOString().replace(/[-:.TZ]/g, '');

// Sourcemap upload needs a write-scoped auth token, which only exists in CI or
// on a release machine — never in a normal `npm run dev`/`npm run build`. When
// any of the three are absent the plugin is left out entirely, so a local build
// behaves exactly as it did before Sentry was introduced.
const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default defineConfig({
  base: '/',
  cacheDir: 'node_modules/.vite-tailwind4',
  define: {
    __HDMARKET_BUILD_ID__: JSON.stringify(buildId)
  },
  plugins: [
    tailwindcss(),
    ...(sentryUploadEnabled
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            // Must match the `release` reported by src/utils/errorTracking.js,
            // otherwise Sentry can't match an event to these sourcemaps.
            release: { name: buildId },
            sourcemaps: {
              // Delete the .map files after upload so minified sourcemaps are
              // never served publicly from dist/.
              filesToDeleteAfterUpload: ['./dist/**/*.map']
            }
          })
        ]
      : [])
  ],
  esbuild: {
    drop: ['console', 'debugger']
  },
  css: {
    postcss: {
      plugins: [autoprefixer()]
    }
  },
  build: {
    // Only emitted for release builds, where the plugin above uploads and then
    // deletes them. Left off locally to keep dist/ small and build times down.
    sourcemap: sentryUploadEnabled,
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
