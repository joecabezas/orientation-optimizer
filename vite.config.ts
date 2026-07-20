import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Served at blog.k014.net/orientation-optimizer/, so the base path must
// match that subpath for built asset URLs to resolve.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/orientation-optimizer/',
})
