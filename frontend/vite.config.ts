import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const adkProxyTarget = process.env.VITE_ADK_PROXY_TARGET ?? "http://127.0.0.1:8001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/adk": {
        target: adkProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/adk/, ""),
      },
    },
  },
});
