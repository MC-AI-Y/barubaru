import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { createTtlCache } from "./cache";
import { GoogleApiError } from "./errors";
import { googleFetch } from "./http";
import { resetAccessTokenCache, TOKEN_ENDPOINT } from "./oauth";
import { quoteTabName, readSheetValues } from "./sheets";

process.env.GOOGLE_CLIENT_ID = "uji-client";
process.env.GOOGLE_CLIENT_SECRET = "uji-secret";
process.env.GOOGLE_REFRESH_TOKEN = "uji-refresh";

type Handler = (url: string, init?: RequestInit) => Response;

function mockFetch(handler: Handler) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const noSleep = async () => {};

describe("googleFetch", () => {
  beforeEach(() => resetAccessTokenCache());

  test("mengambil access token dari refresh token lalu memanggil API", async () => {
    let auth = "";
    const { impl, calls } = mockFetch((url, init) => {
      if (url === TOKEN_ENDPOINT) return json({ access_token: "AT1", expires_in: 3600 });
      auth = new Headers(init?.headers).get("authorization") ?? "";
      return json({ ok: true });
    });
    await googleFetch("https://api.test/x", {}, { fetchImpl: impl, sleep: noSleep });
    assert.equal(auth, "Bearer AT1");
    assert.equal(calls.filter((c) => c === TOKEN_ENDPOINT).length, 1);
  });

  test("401 memicu refresh token sekali lalu mencoba ulang", async () => {
    let tokenCalls = 0;
    let apiCalls = 0;
    const { impl } = mockFetch((url) => {
      if (url === TOKEN_ENDPOINT) return json({ access_token: `AT${++tokenCalls}`, expires_in: 3600 });
      apiCalls++;
      return apiCalls === 1 ? json({ error: { message: "expired" } }, 401) : json({ ok: true });
    });
    const res = await googleFetch("https://api.test/x", {}, { fetchImpl: impl, sleep: noSleep });
    assert.equal(res.ok, true);
    assert.equal(tokenCalls, 2);
  });

  test("429/5xx diulang otomatis", async () => {
    let apiCalls = 0;
    const { impl } = mockFetch((url) => {
      if (url === TOKEN_ENDPOINT) return json({ access_token: "AT", expires_in: 3600 });
      apiCalls++;
      return apiCalls < 3 ? json({}, apiCalls === 1 ? 429 : 503) : json({ ok: true });
    });
    const res = await googleFetch("https://api.test/x", {}, { fetchImpl: impl, sleep: noSleep });
    assert.equal(res.ok, true);
    assert.equal(apiCalls, 3);
  });

  test("refresh token tidak valid menghasilkan GoogleApiError invalid_grant", async () => {
    const { impl } = mockFetch(() => json({ error: "invalid_grant" }, 400));
    await assert.rejects(
      googleFetch("https://api.test/x", {}, { fetchImpl: impl, sleep: noSleep }),
      (err: unknown) => err instanceof GoogleApiError && err.code === "invalid_grant",
    );
  });

  test("403 tidak diulang dan membawa status", async () => {
    const { impl } = mockFetch((url) =>
      url === TOKEN_ENDPOINT
        ? json({ access_token: "AT", expires_in: 3600 })
        : json({ error: { message: "denied", status: "PERMISSION_DENIED" } }, 403),
    );
    await assert.rejects(
      googleFetch("https://api.test/x", {}, { fetchImpl: impl, sleep: noSleep }),
      (err: unknown) => err instanceof GoogleApiError && err.status === 403 && err.code === "PERMISSION_DENIED",
    );
  });
});

describe("readSheetValues", () => {
  beforeEach(() => resetAccessTokenCache());

  test("nama tab dikutip dengan benar dan nilai dijadikan string", async () => {
    let requested = "";
    const { impl } = mockFetch((url) => {
      if (url === TOKEN_ENDPOINT) return json({ access_token: "AT", expires_in: 3600 });
      requested = decodeURIComponent(url);
      return json({ values: [["Subcont Name", "City"], ["PT A", 123]] });
    });
    const values = await readSheetValues({ spreadsheetId: "ID1", tab: "Subcont & City Control" }, "A:Z", { fetchImpl: impl });
    assert.match(requested, /\/ID1\/values\/'Subcont & City Control'!A:Z/);
    assert.deepEqual(values[1], ["PT A", "123"]);
  });

  test("quoteTabName menggandakan kutip tunggal", () => {
    assert.equal(quoteTabName("Tab 'Lama'"), "'Tab ''Lama'''");
  });
});

describe("createTtlCache", () => {
  test("memakai cache selama TTL lalu memuat ulang", async () => {
    const clock = { t: 0 };
    let loads = 0;
    const cache = createTtlCache(async () => ++loads, { ttlMs: 1000, now: () => clock.t });
    assert.equal(await cache.get(), 1);
    clock.t = 999;
    assert.equal(await cache.get(), 1);
    clock.t = 1000;
    assert.equal(await cache.get(), 2);
  });

  test("permintaan bersamaan hanya memuat sekali", async () => {
    let loads = 0;
    const cache = createTtlCache(async () => {
      loads++;
      await new Promise((r) => setTimeout(r, 10));
      return "data";
    }, { ttlMs: 1000 });
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    assert.equal(loads, 1);
  });

  test("bila muat ulang gagal, data lama dipakai", async () => {
    const clock = { t: 0 };
    let fail = false;
    let stale = 0;
    const cache = createTtlCache(
      async () => {
        if (fail) throw new Error("Google sedang bermasalah");
        return "v1";
      },
      { ttlMs: 1000, now: () => clock.t, onStaleServed: () => stale++ },
    );
    await cache.get();
    fail = true;
    clock.t = 5000;
    assert.equal(await cache.get(), "v1");
    assert.equal(stale, 1);
  });

  test("tanpa data lama, galat diteruskan", async () => {
    const cache = createTtlCache(async () => {
      throw new Error("gagal");
    }, { ttlMs: 1000 });
    await assert.rejects(cache.get(), /gagal/);
  });
});

import { parseUpdatedRows } from "./sheets";
import { test as t2 } from "node:test";
import assertStrict from "node:assert/strict";

t2("parseUpdatedRows membaca baris yang baru ditulis", () => {
  assertStrict.deepEqual(parseUpdatedRows("'Form Responses 1'!A12:T14"), { start: 12, end: 14 });
  assertStrict.deepEqual(parseUpdatedRows("Sheet1!A5:T5"), { start: 5, end: 5 });
  assertStrict.deepEqual(parseUpdatedRows("Sheet1!A7"), { start: 7, end: 7 });
  assertStrict.equal(parseUpdatedRows(null), null);
  assertStrict.equal(parseUpdatedRows("rusak"), null);
});
