// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
// Astro 7 ships a stable top-level Fonts API: fonts are downloaded, self-hosted,
// and given optimized fallbacks automatically (zero layout shift, no external requests).
export default defineConfig({
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Geist',
      cssVariable: '--font-geist',
      weights: [300, 400, 500, 600, 700, 800],
      styles: ['normal'],
      subsets: ['latin'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin'],
    },
  ],
  vite: {
    server: {
      // Allow previewing the dev server through a tunnel (ngrok, etc.).
      // Leading dot matches all subdomains, since ngrok URLs rotate.
      allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app'],
    },
  },
});
