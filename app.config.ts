import { defineConfig } from "@tanstack/start/config";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const app = await defineConfig({
  tsr: {
    appDirectory: "src",
  },
  vite: {
    plugins: [tsConfigPaths(), tailwindcss()],
  },
  server: {
    preset: "node-server",
  },
});

app.addRouter({
  name: "api",
  type: "http",
  target: "server",
  base: "/api",
  handler: "./src/server/api-router.ts",
  plugins: () => [tsConfigPaths()],
});

export default app;
