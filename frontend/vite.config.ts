import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) {
              return 'vendor-antd'
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler') || id.includes('react-router')) {
              return 'vendor-react'
            }
            if (id.includes('@ant-design/icons')) {
              return 'vendor-icons'
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts'
            }
            if (id.includes('dayjs') || id.includes('date-fns') || id.includes('moment')) {
              return 'vendor-dates'
            }
            return 'vendor-misc'
          }
        },
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
