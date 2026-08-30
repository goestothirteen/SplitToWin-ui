import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Mirrors production: Caddy serves the UI and proxies /api on one origin.
    // Developing against the same shape means no CORS here either, and no
    // "works locally, breaks deployed" surprises.
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API || "http://127.0.0.1:5000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // MUI and React change far less often than app code; splitting them
        // out means a redeploy doesn't invalidate the whole cached bundle.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          mui: ["@mui/material", "@mui/icons-material"],
        },
      },
    },
  },
});
