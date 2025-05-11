import { defineConfig } from "vite"

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: './index-source.html',
      },
    },
  },
  server: {
    open: '/index-source.html',
  },
})
