/**
 * Menjalankan uji e2e. Setiap skrip mendapat server baru (data tiruan kembali bersih).
 *   node tests/e2e/run.mjs              → semua skrip
 *   node tests/e2e/run.mjs verify decide → skrip tertentu
 *   node tests/e2e/run.mjs --serve      → hanya menyalakan server di http://127.0.0.1:4400 (coba manual di browser)
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_ENV } from "./env.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const server = join(here, ".build/server.mjs");
if (!existsSync(server)) {
  console.error("Bundel belum ada. Jalankan dulu: node tests/e2e/build.mjs");
  process.exit(1);
}
const root = join(here, "..", "..");
const env = { ...process.env, ...E2E_ENV, E2E_DIR: here, E2E_PORT: "4400" };

function startServer() {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [server], { env, cwd: root, stdio: ["ignore", "pipe", "inherit"] });
    p.stdout.on("data", (d) => {
      if (String(d).includes("listening")) resolve(p);
    });
    p.on("exit", (code) => reject(new Error(`server berhenti (kode ${code})`)));
  });
}

const args = process.argv.slice(2);
if (args.includes("--serve")) {
  await startServer();
  console.log("Server uji menyala di http://127.0.0.1:4400 (Ctrl+C untuk berhenti).");
  console.log("Akun uji: cv uji kreasi nusantara / Uji12345, cv uji satu / Daya4385, admin / Admin12345");
  await new Promise(() => {});
}

const all = readdirSync(join(here, "specs")).filter((f) => f.endsWith(".cjs") && !f.startsWith("_")).map((f) => f.replace(/\.cjs$/, "")).sort();
const chosen = args.length ? args : all;
const failed = [];
for (const name of chosen) {
  const srv = await startServer();
  console.log(`\n=== ${name} ===`);
  const code = await new Promise((resolve) => {
    const t = spawn(process.execPath, [join(here, "specs", `${name}.cjs`)], { env, stdio: "inherit" });
    t.on("exit", resolve);
  });
  srv.kill();
  await new Promise((r) => setTimeout(r, 300));
  if (code !== 0) failed.push(name);
}
console.log(failed.length ? `\nGAGAL: ${failed.join(", ")}` : `\nSemua ${chosen.length} skrip selesai tanpa galat.`);
process.exit(failed.length ? 1 : 0);
