import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // For GitHub Pages: set to '/<repo-name>/' after creating the repo
  // e.g. base: '/cinematic-text-ui/'
  // For custom domain or root deploy, use '/'
  base: '/cinematic-text-ui/',
  plugins: [react(), tailwindcss()],
})
