import { defineConfig } from 'vite';

// Vite settings. Most defaults are right for us; this only adjusts one warning.
export default defineConfig({
  build: {
    // Three.js makes our bundle ~530 KB before compression (~130 KB as actually downloaded, gzipped).
    // That's well inside our 10 MB budget, so we raise the warning threshold instead of
    // splitting the code into pieces we don't need.
    chunkSizeWarningLimit: 1000,
  },
});
