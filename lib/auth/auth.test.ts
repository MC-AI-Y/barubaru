import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseUsers } from "../google/parse";
import { attemptLogin, parseLoginBody, passwordMatches } from "./login";
import { SlidingWindowLimiter } from "./rate-limit";
import { getClientIp, isSameOrigin, readCookie } from "./request";
import { createSessionToken, passwordFingerprint, SESSION_TTL_SECONDS, verifySessionToken } from "./session";

const SECRET = "uji-rahasia-yang-panjangnya-lebih-dari-32-karakter";

const directory = parseUsers([
  ["Subcont Name", "Password"],
  ["PT Kasih Rajawali", "Daya4385"],
  ["CV Increase Development", "Incr0001"],
  ["CV Increase Development", "Incr0001"],
]);

function deps(now = { t: 1_000_000 }) {
  return {
    getDirectory: async () => directory,
    ipLimiter: new SlidingWindowLimiter({ limit: 20, windowMs: 15 * 60_000 }, { now: () => now.t }),
    nameLimiter: new SlidingWindowLimiter({ limit: 5, windowMs: 15 * 60_000 }, { now: () => now.t }),
  };
}

describe("attemptLogin", () => {
  test("berhasil dengan nama beda huruf besar/kecil dan spasi berlebih", async () => {
    const r = await attemptLogin({ subcontName: "  pt   KASIH rajawali ", password: "Daya4385", clientIp: "1.1.1.1" }, deps());
    assert.deepEqual(r.ok && r.subcontName, "PT Kasih Rajawali");
  });

  test("password membedakan huruf besar/kecil", async () => {
    const r = await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "daya4385", clientIp: "1.1.1.1" }, deps());
    assert.deepEqual(r, { ok: false, reason: "invalid" });
  });

  test("password dengan spasi tambahan ditolak (dicocokkan persis)", async () => {
    const r = await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "Daya4385 ", clientIp: "1.1.1.1" }, deps());
    assert.equal(r.ok, false);
  });

  test("nama tidak terdaftar ditolak dengan alasan yang sama", async () => {
    const r = await attemptLogin({ subcontName: "PT Tidak Ada", password: "Daya4385", clientIp: "1.1.1.1" }, deps());
    assert.deepEqual(r, { ok: false, reason: "invalid" });
  });

  test("akun yang dulunya baris ganda tetap bisa login", async () => {
    const r = await attemptLogin({ subcontName: "cv increase development", password: "Incr0001", clientIp: "1.1.1.1" }, deps());
    assert.equal(r.ok, true);
  });

  test("rate limit: 5 gagal per nama lalu terkunci, termasuk dengan password benar", async () => {
    const d = deps();
    for (let i = 0; i < 5; i++) {
      const r = await attemptLogin({ subcontName: "PT Kasih Rajawali", password: `salah${i}`, clientIp: "2.2.2.2" }, d);
      assert.equal(r.ok, false);
    }
    const locked = await attemptLogin({ subcontName: "pt kasih rajawali", password: "Daya4385", clientIp: "3.3.3.3" }, d);
    assert.equal(locked.ok, false);
    assert.equal(!locked.ok && locked.reason, "rate_limited");
  });

  test("rate limit terbuka lagi setelah jendela waktu berlalu", async () => {
    const now = { t: 1_000_000 };
    const d = deps(now);
    for (let i = 0; i < 5; i++) {
      await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "x", clientIp: "2.2.2.2" }, d);
    }
    now.t += 15 * 60_000 + 1;
    const r = await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "Daya4385", clientIp: "2.2.2.2" }, d);
    assert.equal(r.ok, true);
  });

  test("login berhasil mereset hitungan gagal untuk nama tersebut", async () => {
    const d = deps();
    for (let i = 0; i < 4; i++) {
      await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "x", clientIp: "4.4.4.4" }, d);
    }
    assert.equal((await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "Daya4385", clientIp: "4.4.4.4" }, d)).ok, true);
    for (let i = 0; i < 4; i++) {
      await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "x", clientIp: "4.4.4.4" }, d);
    }
    assert.equal((await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "Daya4385", clientIp: "4.4.4.4" }, d)).ok, true);
  });

  test("rate limit per IP: maksimal 20 percobaan per 15 menit", async () => {
    const d = deps();
    for (let i = 0; i < 20; i++) {
      await attemptLogin({ subcontName: `PT Acak ${i}`, password: "x", clientIp: "5.5.5.5" }, d);
    }
    const r = await attemptLogin({ subcontName: "PT Kasih Rajawali", password: "Daya4385", clientIp: "5.5.5.5" }, d);
    assert.equal(!r.ok && r.reason, "rate_limited");
  });
});

describe("parseLoginBody", () => {
  test("menolak body tidak lengkap atau terlalu panjang", () => {
    assert.equal(parseLoginBody(null), null);
    assert.equal(parseLoginBody({ subcontName: "PT A" }), null);
    assert.equal(parseLoginBody({ subcontName: "   ", password: "x" }), null);
    assert.equal(parseLoginBody({ subcontName: "PT A", password: "" }), null);
    assert.equal(parseLoginBody({ subcontName: "a".repeat(201), password: "x" }), null);
    assert.deepEqual(parseLoginBody({ subcontName: "PT A", password: "x" }), { subcontName: "PT A", password: "x" });
  });

  test("passwordMatches persis", () => {
    assert.equal(passwordMatches("Abc", "Abc"), true);
    assert.equal(passwordMatches("abc", "Abc"), false);
  });
});

describe("token sesi", () => {
  const pwf = passwordFingerprint("Daya4385", SECRET);

  test("token sah terbaca kembali", () => {
    const { token } = createSessionToken("PT Kasih Rajawali", pwf, SECRET, 1000);
    const claims = verifySessionToken(token, SECRET, 1001);
    assert.equal(claims?.sub, "PT Kasih Rajawali");
    assert.equal(claims?.exp, 1000 + SESSION_TTL_SECONDS);
  });

  test("masa berlaku 12 jam", () => {
    const { token } = createSessionToken("PT A", pwf, SECRET, 1000);
    assert.notEqual(verifySessionToken(token, SECRET, 1000 + 12 * 3600 - 1), null);
    assert.equal(verifySessionToken(token, SECRET, 1000 + 12 * 3600), null);
  });

  test("token diubah atau kunci berbeda ditolak", () => {
    const { token } = createSessionToken("PT A", pwf, SECRET, 1000);
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "PT B", pwf, iat: 1000, exp: 9e9 })).toString("base64url")}.${s}`;
    assert.equal(verifySessionToken(forged, SECRET, 1001), null);
    assert.equal(verifySessionToken(token, `${SECRET}-lain`, 1001), null);
    assert.equal(verifySessionToken("bukan.token", SECRET, 1001), null);
    assert.equal(verifySessionToken(undefined, SECRET, 1001), null);
  });

  test("sidik password berubah bila password diganti dan tidak memuat password", () => {
    assert.notEqual(passwordFingerprint("Daya4385", SECRET), passwordFingerprint("Daya4386", SECRET));
    assert.equal(pwf.includes("Daya"), false);
  });
});

describe("utilitas permintaan", () => {
  test("getClientIp mengambil IP pertama dari x-forwarded-for", () => {
    assert.equal(getClientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })), "9.9.9.9");
    assert.equal(getClientIp(new Headers()), "unknown");
  });

  test("isSameOrigin", () => {
    assert.equal(isSameOrigin(new Headers({ origin: "https://wh.vercel.app", host: "wh.vercel.app" })), true);
    assert.equal(isSameOrigin(new Headers({ origin: "https://jahat.com", host: "wh.vercel.app" })), false);
    assert.equal(isSameOrigin(new Headers({ host: "wh.vercel.app" })), true);
  });

  test("readCookie", () => {
    const h = new Headers({ cookie: "a=1; whc_session=abc.def.ghi; b=2" });
    assert.equal(readCookie(h, "whc_session"), "abc.def.ghi");
    assert.equal(readCookie(h, "tidak"), null);
  });
});
