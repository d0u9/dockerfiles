import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// In development, serve /data/ from the made-up data in fixtures/data, which
// `npm run fixtures` generates. In production the tool's `index` command
// writes the real data beside the pages.
function fixtures(): Plugin {
  const root = path.resolve(import.meta.dirname, "fixtures/data");
  return {
    name: "ai-digest-fixtures",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const file = path.join(root, decodeURIComponent((req.url ?? "").split("?")[0]!));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return next();
        res.setHeader("Content-Type", "application/json");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths, so the site works under any path prefix.
  base: "./",
  plugins: [react(), fixtures()],
  build: { outDir: "dist", emptyOutDir: true },
});
