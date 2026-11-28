import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const pwaManifest = {
  id: '/',
  name: 'Veloxis Speed Test',
  short_name: 'Veloxis',
  description:
    'Precision internet speed test, real-time network telemetry, and ISP plan benchmark.',
  theme_color: '#FFFFFF',
  background_color: '#F8FAFC',
  display: 'standalone' as const,
  start_url: '/',
  scope: '/',
  icons: [
    {
      src: '/pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/pwa-maskable-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
};

export default defineConfig(() => {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'ads.txt',
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: pwaManifest,
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,txt,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//, /^\/ads\.txt$/],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          // vite-plugin-pwa's dev SW hook uses import.meta.hot.send, which throws
          // SendBeforeConnectError when Vite HMR is disabled via DISABLE_HMR=true.
          enabled: !isHmrDisabled,
          type: 'module',
        },
      }),
      ...(isHmrDisabled
        ? [
            {
              name: 'serve-pwa-manifest-no-hmr',
              apply: 'serve' as const,
              transformIndexHtml(html: string) {
                if (html.includes('manifest.webmanifest')) return html;
                return html.replace(
                  '</head>',
                  '    <link rel="manifest" href="/manifest.webmanifest" />\n  </head>',
                );
              },
              configureServer(server: {
                middlewares: {
                  use: (
                    fn: (
                      req: {url?: string},
                      res: {
                        statusCode: number;
                        setHeader: (k: string, v: string) => void;
                        end: (body: string) => void;
                      },
                      next: () => void,
                    ) => void,
                  ) => void;
                };
              }) {
                server.middlewares.use((req, res, next) => {
                  if (req.url === '/manifest.webmanifest') {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/manifest+json');
                    res.end(JSON.stringify(pwaManifest, null, 2));
                    return;
                  }
                  next();
                });
              },
            },
          ]
        : []),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'recharts';
            }
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
              return 'motion';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
