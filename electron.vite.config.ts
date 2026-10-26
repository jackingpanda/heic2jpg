import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('src/main/index.ts'), worker: resolve('src/main/conversion/worker.ts') }, output: { entryFileNames: '[name].js' } } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('src/preload/index.ts'), progress: resolve('src/preload/progress.ts') }, output: { entryFileNames: '[name].js' } } }
  },
  renderer: { plugins: [react()] }
})
