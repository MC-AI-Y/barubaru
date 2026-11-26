/**
 * Membundel aplikasi untuk uji e2e tanpa Next.js dan tanpa Google asli:
 *   .build/server.mjs  = semua API route + Google tiruan (fake-server.ts)
 *   .build/client/     = tampilan WHControl (React) + logo
 */
import { build } from "esbuild";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const nodePaths = [join(root, "node_modules"), join(here, "node_modules"), ...(process.env.E2E_NODE_PATHS ?? "").split(":").filter(Boolean)];

await build({
  entryPoints: [join(here, "fake-server.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(here, ".build/server.mjs"),
  alias: { "@": join(root, "src"), "next/server": join(here, "next-server-shim.ts") },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  nodePaths,
  logLevel: "warning",
});

const out = join(here, ".build/client");
mkdirSync(out, { recursive: true });
await build({
  entryPoints: { entry: join(here, "client-entry.tsx") },
  bundle: true,
  outdir: out,
  format: "esm",
  jsx: "automatic",
  loader: { ".module.css": "local-css", ".css": "css" },
  alias: { "@": join(root, "src") },
  nodePaths,
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "warning",
});
writeFileSync(
  join(out, "index.html"),
  '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/entry.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>',
);
cpSync(join(root, "public/logo"), join(out, "logo"), { recursive: true });
console.log("Bundel e2e siap di tests/e2e/.build");
