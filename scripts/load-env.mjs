/**
 * Pembaca .env.local sederhana untuk skrip lokal (tanpa dependensi).
 * Nilai yang sudah ada di process.env tidak ditimpa.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadEnvFile(file = ".env.local") {
  const full = path.resolve(file);
  if (!existsSync(full)) return false;
  for (const rawLine of readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

/** Mengganti atau menambah satu variabel di file env, tanpa menyentuh baris lain. */
export function upsertEnvValue(file, key, value) {
  const full = path.resolve(file);
  const lines = existsSync(full) ? readFileSync(full, "utf8").split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] !== "") next.push("");
    next.push(`${key}=${value}`);
  }
  return next.join("\n");
}
