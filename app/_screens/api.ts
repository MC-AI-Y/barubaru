import type { DashboardResponse, SmdtSyncResponse } from "@/lib/dashboard/types";
import type { CaptureContext } from "@/lib/report/types";
import type { OrderCountsResponse, OrderDetail, OrderKind, OrderListResponse, OrderView } from "@/lib/orders/types";

/**
 * Pemanggil API dari browser. Mengembalikan hasil bertipe dengan pesan
 * berbahasa Indonesia, sehingga layar tidak perlu menangani galat mentah.
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const NETWORK_MESSAGE = "Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.";

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    return { ok: false, status: 0, message: NETWORK_MESSAGE };
  }

  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (res.ok && body) return { ok: true, data: body };
  return {
    ok: false,
    status: res.status,
    message: body?.error ?? "Terjadi kesalahan. Coba lagi beberapa saat lagi.",
  };
}

export type UserRole = "admin" | "subcont";

export interface SessionInfo {
  subcontName: string;
  /** Peran dari server. Respons lama tanpa role dianggap subcont. */
  role: UserRole;
}

export const authApi = {
  login: (subcontName: string, password: string) =>
    apiRequest<SessionInfo>("/api/auth/login", { method: "POST", body: JSON.stringify({ subcontName, password }) }),
  logout: () => apiRequest<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  session: () => apiRequest<SessionInfo & { expiresAt: number }>("/api/auth/session"),
};

// ── DO / TO / BOQ (Phase 2) ──────────────────────────────────


export interface OrderListParams {
  kind: OrderKind;
  view: OrderView;
  q?: string;
  subcont?: string;
  region?: string;
  page?: number;
  refresh?: boolean;
  /** Tanggal kirim verifikasi (YYYY-MM-DD, WIB). */
  from?: string;
  to?: string;
}

export const ordersApi = {
  list: (p: OrderListParams) => {
    const qs = new URLSearchParams({ kind: p.kind, view: p.view, page: String(p.page ?? 1) });
    if (p.q) qs.set("q", p.q);
    if (p.subcont) qs.set("subcont", p.subcont);
    if (p.region) qs.set("region", p.region);
    if (p.refresh) qs.set("refresh", "1");
    if (p.from) qs.set("from", p.from);
    if (p.to) qs.set("to", p.to);
    return apiRequest<OrderListResponse>(`/api/orders?${qs.toString()}`);
  },
  detail: (kind: OrderKind, key: string) =>
    apiRequest<OrderDetail>(`/api/orders/detail?${new URLSearchParams({ kind, key }).toString()}`),
  counts: () => apiRequest<OrderCountsResponse>("/api/orders/counts"),
};

// ── Verifikasi DO / TO / BOQ (Tahap 3) ───────────────────────


export const verifyApi = {
  /** Mengirim 1 foto bukti + catatan. verificationId dibuat sekali per foto agar kirim ulang tidak ganda. */
  submit: async (args: {
    kind: OrderKind;
    key: string;
    verificationId: string;
    notes: string;
    picName: string;
    picPhone: string;
    capture: CaptureContext;
    photo: Blob;
    capturePic: CaptureContext;
    photoPic: Blob;
    /** BOQ (v5.3): pilihan kolom Verified (APD / ABD / RFSC / FO CUT/VANDALISME). */
    boqChoice?: string;
  }) => {
    const form = new FormData();
    form.append("file", args.photo, "evidence.jpg");
    form.append("filePic", args.photoPic, "pic.jpg");
    form.append(
      "meta",
      JSON.stringify({
        kind: args.kind,
        key: args.key,
        verificationId: args.verificationId,
        notes: args.notes,
        picName: args.picName,
        picPhone: args.picPhone,
        capture: args.capture,
        capturePic: args.capturePic,
        ...(args.boqChoice ? { boqChoice: args.boqChoice } : {}),
      }),
    );
    return apiRequest<{ ok: true; duplicate: boolean; status: "pending" | "verified"; statusLabel?: string; smdt?: { ok: boolean; message: string } }>("/api/verify", { method: "POST", body: form });
  },
  photoUrl: (kind: OrderKind, id: string, which: "evidence" | "pic" = "evidence") =>
    `/api/verify/photo?${new URLSearchParams({ kind, id, ...(which === "pic" ? { which } : {}) }).toString()}`,
};

// ── Dashboard (Tahap 5) ──────────────────────────────────────


export const dashboardApi = {
  get: (refresh = false) => apiRequest<DashboardResponse>(`/api/dashboard${refresh ? "?refresh=1" : ""}`),
  syncSmdt: () => apiRequest<SmdtSyncResponse>("/api/admin/smdt-sync", { method: "POST" }),
};

export interface DecideResult {
  ok: true;
  status: "verified" | "rejected";
  rows?: number;
  smdt?: { ok: boolean; message: string };
}

export const adminApi = {
  decide: (args: { kind: OrderKind; key: string; verificationId?: string; decision: "approve" | "reject"; reason?: string }) =>
    apiRequest<DecideResult>("/api/admin/decide", { method: "POST", body: JSON.stringify(args) }),
};
