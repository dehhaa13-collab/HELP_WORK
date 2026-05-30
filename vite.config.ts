import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/supabase': {
        target: 'https://egduscijdjjnxlxphfoe.supabase.co',
        changeOrigin: true,
        ws: true, // Critical: proxy WebSocket connections for Supabase Realtime
        rewrite: (path) => path.replace(/^\/api\/supabase/, ''),
      },
    },
  },
})
