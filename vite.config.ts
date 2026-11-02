import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 사이트 경로 (https://jackmmin.github.io/about-me/)
  base: '/about-me/',
  plugins: [react(), tailwindcss()],
})
