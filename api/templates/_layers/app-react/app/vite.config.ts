/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = process.env.VITE_API_URL;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    watch: { usePolling: true },
    proxy: api ? { "/api": { target: api, changeOrigin: true } } : undefined,
  },
  test: {
    environment: "happy-dom",
    coverage: { reporter: ["text", "json-summary", "html"] },
  },
});
