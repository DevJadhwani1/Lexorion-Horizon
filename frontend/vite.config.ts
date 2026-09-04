import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 9000, strictPort: true, proxy: { "/api": { target: "http://localhost:9001", changeOrigin: false } } },
  preview: { port: 9000, strictPort: true }
});
