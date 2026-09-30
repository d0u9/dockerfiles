import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import type { SiteIndex } from "../shared/types.ts";
import type { YahooChart } from "../shared/yahoo.ts";

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
      // The made-up quotes answer quote/<symbol> as Yahoo's chart endpoint
      // would, a little moved from the saved ones. Every other one trades
      // now, so the page's mark shows. Real symbols go on to Yahoo below.
      server.middlewares.use("/quote", (req, res, next) => {
        const symbol = decodeURIComponent((req.url ?? "").slice(1).split("?")[0]!);
        const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8")) as SiteIndex;
        const quotes = index.latest.markets?.quotes ?? [];
        const i = quotes.findIndex((q) => q.symbol === symbol);
        if (i < 0) return next();
        const q = quotes[i]!;
        const now = Math.floor(Date.now() / 1000);
        const open = i % 2 === 0;
        const chart: YahooChart = { chart: { result: [{
          meta: {
            currency: q.currency ?? undefined, exchangeTimezoneName: "UTC",
            regularMarketPrice: q.value * (1 + (i % 3 - 1) * 0.004), regularMarketTime: open ? now - 60 : now - 6 * 3600,
            currentTradingPeriod: { regular: open ? { start: now - 3600, end: now + 3600 } : { start: now - 10 * 3600, end: now - 4 * 3600 } },
          },
          timestamp: q.history.map((h) => Date.parse(`${h.date}T12:00:00Z`) / 1000),
          indicators: { quote: [{ close: q.history.map((h) => h.value) }] },
        }] } };
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(chart));
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths, so the site works under any path prefix.
  base: "./",
  plugins: [react(), fixtures()],
  // In development, quote/<symbol> goes to Yahoo's chart endpoint, as the web
  // server's route does in production (README).
  server: {
    proxy: {
      "/quote/": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/quote\//, "/v8/finance/chart/"),
      },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
