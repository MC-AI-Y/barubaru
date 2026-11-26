import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_STATUS_MAX_AGE_MS,
  deviceLabel,
  fromDraftProps,
  parseDraftStatusInput,
  toDraftProps,
  truncateBytes,
  visibleDraftStatuses,
  type DraftStatus,
} from "./draft-status";

const SID = "a28b78b2-4c30-483a-9d6e-bb3a4da0758a";
const SID2 = "b28b78b2-4c30-483a-9d6e-bb3a4da0758b";

test("label perangkat dari User-Agent", () => {
  assert.equal(
    deviceLabel("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"),
    "Android · Chrome",
  );
  assert.equal(
    deviceLabel("Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36"),
    "Android · Samsung Internet",
  );
  assert.equal(
    deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"),
    "iPhone · Safari",
  );
  assert.equal(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0"), "Windows · Edge");
  assert.equal(deviceLabel(null), "Perangkat");
});

test("truncateBytes tidak memotong karakter multi-byte", () => {
  assert.equal(truncateBytes("abc", 10), "abc");
  assert.equal(truncateBytes("gudang é é", 8), "gudang ");
  assert.ok(new TextEncoder().encode(truncateBytes("é".repeat(100), 101)).length <= 101);
});

test("validasi kiriman ringkasan draf", () => {
  const now = 1_800_000_000_000;
  const ok = parseDraftStatusInput(
    { submissionId: SID.toUpperCase(), deviceId: "dev-12345678", warehouse: "  Gudang   Manado ", materialCount: 3, createdAt: now + 99999 },
    now,
  );
  assert.deepEqual(ok, { submissionId: SID, deviceId: "dev-12345678", warehouse: "Gudang Manado", materialCount: 3, createdAt: now });
  assert.equal(parseDraftStatusInput({ submissionId: "x", deviceId: "dev-12345678", materialCount: 1, createdAt: 1 }, now), null);
  assert.equal(parseDraftStatusInput({ submissionId: SID, deviceId: "a b", materialCount: 1, createdAt: 1 }, now), null);
  assert.equal(parseDraftStatusInput({ submissionId: SID, deviceId: "dev-12345678", materialCount: -1, createdAt: 1 }, now), null);
  assert.equal(parseDraftStatusInput(null, now), null);
});

test("appProperties muat batas Drive dan bisa dibaca balik", () => {
  const input = { submissionId: SID, deviceId: "dev-12345678", warehouse: "G".repeat(100), materialCount: 12, createdAt: 1000 };
  const props = toDraftProps(input, { subKey: "k".repeat(80), device: "Android · Samsung Internet", now: 2000 });
  for (const [k, v] of Object.entries(props)) {
    assert.ok(new TextEncoder().encode(k + v).length <= 124, `properti ${k} terlalu panjang`);
  }
  assert.deepEqual(fromDraftProps(props), {
    submissionId: SID,
    deviceId: "dev-12345678",
    device: "Android · Samsung Internet",
    warehouse: "G".repeat(100),
    materialCount: 12,
    createdAt: 1000,
    updatedAt: 2000,
  });
  assert.equal(fromDraftProps({}), null);
});

test("hanya draf perangkat lain, bukan draf lokal, dan belum kedaluwarsa", () => {
  const now = 10 * DRAFT_STATUS_MAX_AGE_MS;
  const base: DraftStatus = { submissionId: SID, deviceId: "lain-1234", device: "Android", warehouse: "A", materialCount: 1, createdAt: 1, updatedAt: now - 1000 };
  const list: DraftStatus[] = [
    base,
    { ...base, submissionId: SID2, deviceId: "ini-12345", updatedAt: now },
    { ...base, submissionId: "c28b78b2-4c30-483a-9d6e-bb3a4da0758c", updatedAt: now - DRAFT_STATUS_MAX_AGE_MS - 1 },
    { ...base, submissionId: "d28b78b2-4c30-483a-9d6e-bb3a4da0758d", updatedAt: now - 10 },
  ];
  const out = visibleDraftStatuses(list, { deviceId: "ini-12345", localSubmissionId: null, now });
  assert.deepEqual(out.map((d) => d.submissionId), ["d28b78b2-4c30-483a-9d6e-bb3a4da0758d", SID]);
  const out2 = visibleDraftStatuses(list, { deviceId: "ini-12345", localSubmissionId: SID, now });
  assert.deepEqual(out2.map((d) => d.submissionId), ["d28b78b2-4c30-483a-9d6e-bb3a4da0758d"]);
});
