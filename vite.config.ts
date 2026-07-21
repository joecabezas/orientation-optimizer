import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served at blog.k014.net/orientation-optimizer/, so the base path must
// match that subpath for built asset URLs to resolve. Only applied on
// build so local dev still serves at http://localhost:5173/.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? '/orientation-optimizer/' : '/',
  server: {
    // Bind on all interfaces so the dev server is reachable from Windows
    // when running inside WSL2 (default localhost-only bind isn't visible
    // outside the WSL VM in all network configurations).
    host: true,
  },
}))
