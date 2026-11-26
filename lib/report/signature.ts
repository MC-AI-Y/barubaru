/**
 * Tanda tangan server (HMAC dengan JWT_SECRET) untuk:
 *  - konteks foto (waktu server + lokasi), agar tidak bisa diubah di perangkat;
 *  - tiket sementara untuk lapisan geocode cadangan;
 *  - bukti unggah file Drive.
 * Hanya untuk kode server.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CaptureContext, ZoneLabel } from "./types";

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url").slice(0, 43);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const num = (n: number) => n.toFixed(6);

function captureData(c: Omit<CaptureContext, "sig">, subcont: string): string {
  return ["cap1", subcont, c.t, c.zone, num(c.lat), num(c.lon), Math.round(c.acc), c.location, c.short, c.source].join("|");
}

export function signCapture(c: Omit<CaptureContext, "sig">, subcont: string, secret: string): CaptureContext {
  return { ...c, sig: hmac(secret, captureData(c, subcont)) };
}

export function verifyCapture(c: unknown, subcont: string, secret: string): c is CaptureContext {
  if (!isCaptureShape(c)) return false;
  const { sig, ...rest } = c;
  return safeEqual(sig, hmac(secret, captureData(rest, subcont)));
}

function isCaptureShape(v: unknown): v is CaptureContext {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.t === "number" &&
    (c.zone === "WIB" || c.zone === "WITA" || c.zone === "WIT") &&
    typeof c.lat === "number" &&
    typeof c.lon === "number" &&
    typeof c.acc === "number" &&
    typeof c.location === "string" &&
    typeof c.short === "string" &&
    (c.source === "nominatim" || c.source === "bigdatacloud" || c.source === "coordinates") &&
    typeof c.sig === "string"
  );
}

// ── Tiket geocode cadangan ───────────────────────────────────

export interface TicketData {
  t: number;
  lat: number;
  lon: number;
  acc: number;
  zone: ZoneLabel;
}

export function signTicket(d: TicketData, subcont: string, secret: string): string {
  const payload = Buffer.from(JSON.stringify(d)).toString("base64url");
  return `${payload}.${hmac(secret, `tik1|${subcont}|${payload}`)}`;
}

export function verifyTicket(ticket: unknown, subcont: string, secret: string, now: number, maxAgeMs = 2 * 60_000): TicketData | null {
  if (typeof ticket !== "string" || ticket.length > 1000) return null;
  const [payload, sig] = ticket.split(".");
  if (!payload || !sig || !safeEqual(sig, hmac(secret, `tik1|${subcont}|${payload}`))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TicketData;
    if (now - d.t > maxAgeMs || d.t > now + 5000) return null;
    return d;
  } catch {
    return null;
  }
}

// ── Bukti unggah ─────────────────────────────────────────────

export function signUpload(fields: { submissionId: string; kind: string; photoId: string; fileId: string }, subcont: string, secret: string): string {
  return hmac(secret, ["up1", subcont, fields.submissionId, fields.kind, fields.photoId, fields.fileId].join("|"));
}

export function verifyUpload(
  fields: { submissionId: string; kind: string; photoId: string; fileId: string; receipt: string },
  subcont: string,
  secret: string,
): boolean {
  return safeEqual(fields.receipt, signUpload(fields, subcont, secret));
}
