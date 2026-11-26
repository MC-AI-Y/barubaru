#!/usr/bin/env node
/**
 * Skrip SATU KALI untuk mendapatkan refresh token akun Google khusus WHControl.
 * Jalankan di komputer lokal (bukan di server), lihat docs/SETUP-GOOGLE.md.
 *
 *   npm run google:token            → menampilkan refresh token di terminal
 *   npm run google:token -- --write → sekaligus menyimpannya ke .env.local
 *
 * Syarat: GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET sudah diisi di .env.local
 * (OAuth client tipe "Desktop app").
 *
 * JANGAN tempel refresh token ke chat, email, atau commit Git.
 */
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { loadEnvFile, upsertEnvValue } from "./load-env.mjs";

const SCOPES = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets"];
const ENV_FILE = ".env.local";
const TIMEOUT_MS = 5 * 60 * 1000;

loadEnvFile(ENV_FILE);
const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const shouldWrite = process.argv.includes("--write");

if (!clientId || !clientSecret) {
  console.error("\nGOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET belum diisi di .env.local.");
  console.error("Salin .env.example menjadi .env.local, isi kedua nilai itu, lalu jalankan ulang.\n");
  process.exit(1);
}

const state = randomBytes(16).toString("hex");
const codeVerifier = randomBytes(48).toString("base64url");
const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

function openBrowser(url) {
  // Windows: rundll32 agar tanda "&" pada URL tidak dipotong oleh cmd.
  const cmd = process.platform === "win32" ? "rundll32" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // Abaikan: pengguna bisa membuka link secara manual.
  }
}

function page(title, message) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:system-ui;max-width:520px;margin:15vh auto;padding:0 16px;color:#182132">
<h2>${title}</h2><p>${message}</p></body>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end();
    return;
  }

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (error || !code || url.searchParams.get("state") !== state) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page("Gagal", "Izin dibatalkan atau tidak valid. Tutup halaman ini dan jalankan ulang skrip."));
    console.error(`\nIzin gagal: ${error ?? "state tidak cocok atau kode tidak ada"}.`);
    finish(1);
    return;
  }

  try {
    const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(data.error_description ?? data.error ?? `HTTP ${tokenRes.status}`);

    if (!data.refresh_token) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page("Refresh token tidak diterima", "Lihat petunjuk di terminal."));
      console.error("\nGoogle tidak mengirim refresh token (akun ini pernah memberi izin sebelumnya).");
      console.error("Buka https://myaccount.google.com/permissions, hapus akses aplikasi WHControl, lalu jalankan ulang.\n");
      finish(1);
      return;
    }

    // Tampilkan akun yang memberi izin agar bisa dipastikan ini akun khusus WHControl.
    let email = "(tidak diketahui)";
    try {
      const about = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      email = (await about.json()).user?.emailAddress ?? email;
    } catch {
      // Tidak wajib.
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page("Berhasil", "Refresh token sudah diterima. Kembali ke terminal, lalu tutup halaman ini."));

    console.log(`\n✔ Izin diberikan oleh akun: ${email}`);
    console.log("  Pastikan ini akun Google khusus WHControl (pemilik folder Warehouse Control).\n");

    if (shouldWrite) {
      writeFileSync(ENV_FILE, upsertEnvValue(ENV_FILE, "GOOGLE_REFRESH_TOKEN", data.refresh_token));
      console.log(`✔ GOOGLE_REFRESH_TOKEN disimpan ke ${ENV_FILE}.`);
    } else {
      console.log("GOOGLE_REFRESH_TOKEN (RAHASIA, salin ke .env.local dan Vercel, jangan dibagikan):\n");
      console.log(data.refresh_token);
    }
    console.log("\nLangkah berikutnya: npm run google:check\n");
    finish(0);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page("Gagal", "Penukaran kode gagal. Lihat terminal."));
    console.error(`\nPenukaran kode gagal: ${err instanceof Error ? err.message : err}`);
    console.error("Periksa GOOGLE_CLIENT_ID/SECRET dan pastikan tipe OAuth client adalah \"Desktop app\".\n");
    finish(1);
  }
});

let timer;
function finish(code) {
  clearTimeout(timer);
  server.close();
  setTimeout(() => process.exit(code), 100);
}

server.listen(0, "127.0.0.1", () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  console.log("\nMembuka browser untuk login Google…");
  console.log("Login dengan AKUN GOOGLE KHUSUS WHControl, lalu izinkan akses Drive dan Sheets.");
  console.log("Bila browser tidak terbuka otomatis, buka link ini:\n");
  console.log(authUrl.toString(), "\n");
  openBrowser(authUrl.toString());

  timer = setTimeout(() => {
    console.error("\nWaktu habis (5 menit). Jalankan ulang skrip.");
    finish(1);
  }, TIMEOUT_MS);
});
