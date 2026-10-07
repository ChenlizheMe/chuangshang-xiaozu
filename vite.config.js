import { defineConfig } from 'vite'
import { offlineReleasePlugin } from './scripts/offline-release.mjs'

// Relative assets keep the build usable on GitHub Pages project URLs and local previews.
export default defineConfig({
  base: './',
  plugins: [offlineReleasePlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) return 'preload'
          if (id.includes('node_modules/three') || id.includes('node_modules/three-stdlib')) return 'three'
          if (id.includes('node_modules/@react-three') || id.includes('node_modules/@react-spring')) return 'r3f'
          // Keep react-reconciler with the lazy 3D runtime. Grouping every
          // react* package here pulls Three into the initial UI dependency graph.
          if (/node_modules\/(?:react|react-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
})
