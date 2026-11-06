/**
 * @Author wei
 * @Date 2026-11-04
 * @Description Vite 构建配置，配置 React 插件、Wails 运行时与 @ 路径别名
 **/

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wails from "@wailsio/runtime/plugins/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [react(), wails("./bindings")],
});
