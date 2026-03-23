import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: 'dist/renderer',
    rollupOptions: { input: 'index.html' },
  },
  optimizeDeps: {
    esbuildOptions: { define: { global: 'globalThis' } },
  },
})
