import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/assemblage-papier/' : '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
