import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The company dashboard runs on your own computer and talks to the hub on Render
// (VITE_HUB_URL in .env.local). `npm run dev` opens it on http://localhost:5174.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5174, open: true },
  preview: { port: 5174, open: true },
})
