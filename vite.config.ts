import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { defineConfig } from 'vitest/config'

// CesiumJS needs its Workers/Assets/Widgets/ThirdParty served statically.
// vite-plugin-static-copy is the maintained path (replaces vite-plugin-cesium wrapper).
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      // NOTE: without `rename.stripBase`, the plugin preserves the full
      // relative path (dist/cesium/node_modules/...) and production Cesium
      // 404s on Workers/Assets (black globe + JSON errors — caught by QA).
      // stripBase: 5 removes `node_modules/cesium/Build/Cesium/<Dir>`.
      targets: [
        { src: 'node_modules/cesium/Build/Cesium/Workers/**/*', dest: 'cesium/Workers', rename: { stripBase: 5 } },
        { src: 'node_modules/cesium/Build/Cesium/ThirdParty/**/*', dest: 'cesium/ThirdParty', rename: { stripBase: 5 } },
        { src: 'node_modules/cesium/Build/Cesium/Assets/**/*', dest: 'cesium/Assets', rename: { stripBase: 5 } },
        { src: 'node_modules/cesium/Build/Cesium/Widgets/**/*', dest: 'cesium/Widgets', rename: { stripBase: 5 } },
      ],
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
