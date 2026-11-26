import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lokasi folder ini (setelah dibundel, file berada di tests/e2e/.build/).
const HERE = process.env.E2E_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as session from "@/app/api/auth/session/route";
import * as regions from "@/app/api/reference/regions/route";
import * as materials from "@/app/api/reference/materials/route";
import * as captureCtx from "@/app/api/capture/context/route";
import * as upload from "@/app/api/upload/route";
import * as submit from "@/app/api/submit/route";
import * as pdfRoute from "@/app/api/report/pdf/route";
import * as draftStatus from "@/app/api/draft/status/route";
import * as ordersList from "@/app/api/orders/route";
import * as ordersDetail from "@/app/api/orders/detail/route";
import * as ordersCounts from "@/app/api/orders/counts/route";
import * as verifyRoute from "@/app/api/verify/route";
import * as decideRoute from "@/app/api/admin/decide/route";
import * as dashboardRoute from "@/app/api/dashboard/route";
import * as smdtSync from "@/app/api/admin/smdt-sync/route";
import * as verifyPhoto from "@/app/api/verify/photo/route";

const fixture = JSON.parse(readFileSync(path.join(HERE, "fixtures/region.json"), "utf8"));
const orders = JSON.parse(readFileSync(path.join(HERE, "fixtures/orders.json"), "utf8"));
const fixtureNames: string[] = [];
let __dummy = 0; void __dummy;
for (const row of fixture.rows.slice(1)) if (row[0] && !fixtureNames.includes(row[0])) fixtureNames.push(row[0]);
const longName = fixtureNames.find((n) => /UJI TELEKOM/i.test(n)) ?? fixtureNames[2];
const USERS = [["Subcont Name", "Password"], [fixtureNames[0], "Daya4385"], [fixtureNames[1], "Uji12345"], [fixtureNames[1], "Uji12345"], ["PT UJI BAHARI KONSTRUKSI", "Bahari22"], [longName, "Kop12345"], ["admin", "Admin12345"]];
console.log("LONG=" + longName);
const MATERIALS = [["Material", "Remark"], ['POLE-7M 2,5"', "USPl"], ["", "Vendor B"], ["CABLE-48", "Old (Hitam)"], ["", "New (Garis Ungu)"], ["FDT-48"], ["HDPE-32/28", ""], ["CLOSURE-24", "Inline"], ["", "Dome"]];
const RESULT_HEADER = ["Submission ID","Subcont Name","Photo Authorized Open","Date","Time","Location","Region","Warehouse Name","PIC Subcont","YOFC SPV","YOFC PM/RPM","Material","Remark","Quantity","Satuan","Photo","Notes","Photo Authorized Closed","Form PDF","Submitted At (Server)"];
const resultRows: unknown[][] = [RESULT_HEADER];
// Visit uji satu kota (untuk Inventory Actual di Dashboard).
const seedVisit = (sid: string, sub: string, region: string, at: string, items: [string, number][]) =>
  items.forEach(([m, q]) => resultRows.push([sid, sub, "", "", "", "Kota Uji", region, "Gudang", "PIC", "SPV", "PM", m, "-", q, m.startsWith("CABLE") || m.startsWith("HDPE") ? "M" : "Pcs", "", "", "", "", at]));
seedVisit("seed-1", "CV UJI KREASI NUSANTARA", "GORONTALO", "10/11/2026 09:00", [["CABLE-48", 999]]);
seedVisit("seed-2", "CV UJI KREASI NUSANTARA", "GORONTALO", "20/11/2026 09:00", [["CABLE-48", 3000], ["CABLE-24", 1800], ["FDT-48", 4]]);
seedVisit("seed-3", "CV UJI KREASI NUSANTARA", "MANADO", "21/11/2026 14:00", [["CABLE-24", 2500], ["HDPE-32/28", 1000]]);
seedVisit("seed-4", "CV UJI SATU", "BOGOR DAN DEPOK", "21/11/2026 14:00", [["CABLE-24", 5]]);
const smdtRows: unknown[][] = [
  ["", "", "", "Material Receive/In", "", "", "Material Use/Out"],
  ["No", "Subcont City", "Material Name", "DO", "Borrow", "TOTAL In", "BOQ", "Handover", "Total Use/Out", "Inventory By Data", "Inventory Actual", "GAP", "Remarks"],
  ["1", "CV UJI KREASI NUSANTARA GORONTALO", "CABLE-48", "0", "0", "0", "0", "0", "0", "0", "", "", "Cek ulang gudang belakang"],
  ["2", "BARIS LAMA", "X", "1", "", "", "", "", "", "", "", "", ""],
];
interface FakeFile { id: string; name: string; mimeType: string; parents: string[]; appProperties: Record<string,string>; data: Buffer }
const files = new Map<string, FakeFile>();
let fileSeq = 0;
let nominatimMode = "ok";
let nominatimCalls = 0;
let failDriveUploads = 0;
const formatCalls: unknown[] = [];
const verifyTabs: Record<string, string[][]> = {};
const writeLog: unknown[] = [];
let verifyCreates = 0;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });
console.log("AKUN_UJI=" + JSON.stringify(fixtureNames.slice(0, 2)));

const realFetch = globalThis.fetch;
let sheetCalls = 0;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url ?? String(input);
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return new Response(JSON.stringify({ access_token: "AT-mock", expires_in: 3600 }), { headers: { "Content-Type": "application/json" } });
  }
  if (url.startsWith("https://nominatim.openstreetmap.org/")) {
    nominatimCalls++;
    if (nominatimMode === "fail") return new Response("busy", { status: 503 });
    return json({ display_name: "Jalan Raya Bogor, Pakansari, Cibinong, Kabupaten Bogor, Jawa Barat, 16915, Indonesia", address: { road: "Jalan Raya Bogor", village: "Pakansari", city_district: "Cibinong", county: "Kabupaten Bogor", state: "Jawa Barat" } });
  }
  if (url.startsWith("https://sheets.googleapis.com/") && url.includes("/RESULT")) {
    const u = decodeURIComponent(url);
    if (u.includes(":append")) {
      const body = JSON.parse(String(init?.body));
      const start = resultRows.length + 1;
      resultRows.push(...body.values);
      return json({ updates: { updatedRows: body.values.length, updatedRange: `'Hasil'!A${start}:T${resultRows.length}` } });
    }
    if (u.includes("fields=sheets.properties")) return json({ sheets: [{ properties: { sheetId: 777, title: process.env.SHEET_RESULT_TAB ?? "Hasil" } }] });
    if (u.includes("/values/") && (init?.method ?? "GET").toUpperCase() === "GET" && !u.includes("batchGet")) return json({ values: resultRows.map((r) => r.map((c) => String(c ?? ""))) });
    if (u.includes(":batchUpdate")) { formatCalls.push(JSON.parse(String(init?.body))); return json({}); }
    if (u.includes("values:batchGet")) {
      const ranges = [...u.matchAll(/ranges=[^&]*!([A-Z0-9:]+)/g)].map((m) => m[1]);
      const col = (i: number) => resultRows.map((r) => [String(r[i] ?? "")]);
      return json({ valueRanges: ranges.map((r) => r === "A1:T1" ? { values: [RESULT_HEADER] } : r === "A:A" ? { values: col(0) } : { values: col(18) }) });
    }
  }
  if (url.startsWith("https://sheets.googleapis.com/v4/spreadsheets?") && (init?.method ?? "GET").toUpperCase() === "POST") {
    const body = JSON.parse(String(init.body));
    const id = "VERIFYSHEET" + (++verifyCreates);
    for (const sh of body.sheets) verifyTabs[sh.properties.title] = [sh.data[0].rowData[0].values.map((v: any) => v.userEnteredValue.stringValue)];
    files.set(id, { id, name: body.properties.title, mimeType: "application/vnd.google-apps.spreadsheet", parents: ["root"], appProperties: {}, data: Buffer.alloc(0) });
    return json({ spreadsheetId: id });
  }
  if (url.startsWith("https://sheets.googleapis.com/") && /\/(DOSHEET|TOSHEET|BOQSHEET)\//.test(url)) {
    const u = decodeURIComponent(url);
    const which = /\/(DOSHEET|TOSHEET|BOQSHEET)\//.exec(u)![1]!;
    const sheet = which === "DOSHEET" ? orders.do : which === "TOSHEET" ? orders.to : orders.boq;
    const colIdx = (l: string) => [...l].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    if (u.includes("values:batchUpdate")) {
      const body = JSON.parse(String(init.body));
      writeLog.push({ sheet: which, data: body.data, input: body.valueInputOption });
      for (const d of body.data) { const m = /!([A-Z]+)(\d+)$/.exec(d.range)!; const row = sheet[Number(m[2]) - 1]; const ci = colIdx(m[1]!); while (row.length <= ci) row.push(""); row[ci] = d.values[0][0] === true ? "TRUE" : String(d.values[0][0]); }
      return json({});
    }
    const col = /!([A-Z]+)1:([A-Z]+)$/.exec(u);
    if (col && col[1] === col[2]) { const ci = colIdx(col[1]!); return json({ values: sheet.map((r: string[]) => [r[ci] ?? ""]) }); }
    return json({ values: sheet });
  }
  if (url.startsWith("https://sheets.googleapis.com/") && url.includes("/SMDTSHEET/")) {
    const u = decodeURIComponent(url);
    const method = (init?.method ?? "GET").toUpperCase();
    if (u.includes(":clear")) { const start = Number(/!A(\d+):M/.exec(u)![1]); smdtRows.length = Math.min(smdtRows.length, start - 1); return json({}); }
    if (method === "PUT") { const start = Number(/!A(\d+):M/.exec(u)![1]); const body = JSON.parse(String(init.body)); body.values.forEach((r: unknown[], i: number) => (smdtRows[start - 1 + i] = r)); return json({ updatedRows: body.values.length }); }
    return json({ values: smdtRows.map((r) => r.map((c) => String(c ?? ""))) });
  }
  if (url.startsWith("https://sheets.googleapis.com/") && url.includes("/VERIFYSHEET")) {
    const u = decodeURIComponent(url);
    if (u.includes(":append")) {
      const tab = /values\/'([^']+)'!/.exec(u)![1];
      const body = JSON.parse(String(init?.body));
      verifyTabs[tab]!.push(...body.values.map((r: any[]) => r.map((c) => String(c))));
      return json({ updates: { updatedRange: `'${tab}'!A${verifyTabs[tab]!.length}:U${verifyTabs[tab]!.length}` } });
    }
    if (u.includes("values:batchUpdate")) {
      const body = JSON.parse(String(init.body));
      for (const d of body.data) {
        const m = /'([^']+)'!([A-Z]+)(\d+)(?::([A-Z]+)\d+)?$/.exec(d.range)!;
        const row = verifyTabs[m[1]!]![Number(m[3]) - 1]!;
        let ci = m[2]!.charCodeAt(0) - 65;
        for (const v of d.values[0]) { while (row.length <= ci) row.push(""); row[ci++] = String(v); }
      }
      return json({});
    }
    if (u.includes("values:batchGet")) {
      const tabs = [...u.matchAll(/ranges='([^']+)'!/g)].map((m) => m[1]!);
      return json({ valueRanges: tabs.map((t) => ({ values: verifyTabs[t] ?? [] })) });
    }
  }
  if (url.startsWith("https://www.googleapis.com/upload/drive/v3/files")) {
    if (failDriveUploads > 0) { failDriveUploads--; return new Response("{}", { status: 503 }); }
    const body = Buffer.from(init?.body as Uint8Array);
    const text = body.toString("latin1");
    const metaStart = text.indexOf("\r\n\r\n") + 4;
    const metaEnd = text.indexOf("\r\n--", metaStart);
    const meta = JSON.parse(text.slice(metaStart, metaEnd));
    const dataStart = text.indexOf("\r\n\r\n", metaEnd + 4) + 4;
    const dataEnd = text.lastIndexOf("\r\n--");
    const id = `f${++fileSeq}xxxxxxxxxx`;
    files.set(id, { id, name: meta.name, mimeType: text.includes("application/pdf") ? "application/pdf" : "image/jpeg", parents: meta.parents, appProperties: meta.appProperties, data: body.subarray(dataStart, dataEnd) });
    return json({ id, name: meta.name, mimeType: "x", webViewLink: `https://drive.google.com/file/d/${id}/view`, appProperties: meta.appProperties, parents: meta.parents });
  }
  if (url.startsWith("https://www.googleapis.com/drive/v3/files")) {
    const u = new URL(url);
    const method = (init?.method ?? "GET").toUpperCase();
    const view = (f: FakeFile) => ({ id: f.id, name: f.name, mimeType: f.mimeType, webViewLink: `https://drive.google.com/file/d/${f.id}/view`, appProperties: f.appProperties, parents: f.parents });
    if (method === "POST") {
      const meta = JSON.parse(String(init.body));
      const id = "m" + (++fileSeq).toString().padStart(8, "x");
      const f: FakeFile = { id, name: meta.name, mimeType: meta.mimeType, parents: meta.parents ?? ["root"], appProperties: meta.appProperties ?? {}, data: Buffer.alloc(0) };
      files.set(id, f);
      return json(view(f));
    }
    const q = u.searchParams.get("q");
    if (q && method === "GET") {
      const parent = /^'([^']+)' in parents/.exec(q)?.[1];
      const mime = /mimeType = '([^']+)'/.exec(q)?.[1];
      const ap = /appProperties has \{ key='([^']+)' and value='([^']+)' \}/.exec(q);
      const list = [...files.values()].filter((x) => (!parent || x.parents.includes(parent)) && (!mime || x.mimeType === mime) && (!ap || x.appProperties[ap[1]] === ap[2]));
      return json({ files: list.slice(0, Number(u.searchParams.get("pageSize") ?? 100)).map(view) });
    }
    const id = decodeURIComponent(u.pathname.split("/").pop()!);
    const f = files.get(id);
    if (!f) return json({ error: { message: "nf", status: "NOT_FOUND" } }, 404);
    if (method === "PATCH") { Object.assign(f.appProperties, JSON.parse(String(init.body)).appProperties); return json({ id }); }
    if (method === "DELETE") { files.delete(id); return new Response(null, { status: 204 }); }
    if (u.searchParams.get("alt") === "media") return new Response(f.data);
    return json(view(f));
  }
  if (url.startsWith("https://sheets.googleapis.com/")) {
    sheetCalls++;
    const u = decodeURIComponent(url);
    const values = u.includes("/USERS/") ? USERS : u.includes("/REGION/") ? fixture.rows : u.includes("/MATERIAL/") ? MATERIALS : u.includes("/DOSHEET/") ? orders.do : u.includes("/TOSHEET/") ? orders.to : u.includes("/BOQSHEET/") ? orders.boq : null;
    if (!values) return new Response(JSON.stringify({ error: { message: "not found", status: "NOT_FOUND" } }), { status: 404 });
    return new Response(JSON.stringify({ values }), { headers: { "Content-Type": "application/json" } });
  }
  return realFetch(input, init);
}) as typeof fetch;

const routes: Record<string, any> = {
  "/api/orders": ordersList, "/api/orders/detail": ordersDetail, "/api/orders/counts": ordersCounts,
  "/api/auth/login": login, "/api/auth/logout": logout, "/api/auth/session": session,
  "/api/reference/regions": regions, "/api/reference/materials": materials,
  "/api/dashboard": dashboardRoute, "/api/admin/smdt-sync": smdtSync,
  "/__smdt": { GET: async () => json({ rows: smdtRows }) },
  "/__orders": { GET: async () => json(orders) },
  "/api/admin/decide": decideRoute,
  "/api/verify": verifyRoute, "/api/verify/photo": verifyPhoto,
  "/__verify": { GET: async (r: Request) => {
    const q = new URL(r.url).searchParams;
    const tab = q.get("tab") ?? "DO";
    if (q.get("op") === "reject") { const rows = verifyTabs[tab]!; const last = rows[rows.length - 1]!; rows.push([crypto.randomUUID(), last[1]!, last[2]!, last[3]!, last[4]!, last[5]!, "Ditolak", last[7]!, last[8]!, last[9]!, last[10]!, last[11]!, last[12]!, last[13]!, last[14]!, "24/11/2026 10:00 WIB", "admin", q.get("reason") ?? "Foto buram", last[18]!, "", last[20]!]); }
    return json({ tabs: verifyTabs, creates: verifyCreates, writes: writeLog });
  } },
  "/__sheetcalls": { GET: async () => new Response(String(sheetCalls)) },
  "/api/capture/context": captureCtx, "/api/upload": upload, "/api/submit": submit, "/api/report/pdf": pdfRoute, "/api/draft/status": draftStatus,
  "/__state": { GET: async () => json({ rows: resultRows, files: [...files.values()].map((f) => ({ id: f.id, name: f.name, parents: f.parents, size: f.data.length, key: f.appProperties.whcKey, props: f.appProperties })), nominatimCalls, formatCalls }) },
  "/__nominatim": { GET: async (r: Request) => { nominatimMode = new URL(r.url).searchParams.get("mode") ?? "ok"; return new Response(nominatimMode); } },
  "/__faildrive": { GET: async (r: Request) => { failDriveUploads = Number(new URL(r.url).searchParams.get("n") ?? 0); return new Response(String(failDriveUploads)); } },
  "/__file": { GET: async (r: Request) => { const f = files.get(new URL(r.url).searchParams.get("id")!); return f ? new Response(f.data, { headers: { "Content-Type": f.mimeType } }) : new Response("nf", { status: 404 }); } },
};
const STATIC = path.join(HERE, ".build/client");
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp" };

http.createServer(async (req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1");
  const mod = routes[url.pathname];
  if (mod) {
    const handler = mod[req.method!];
    if (!handler) { res.writeHead(405).end(); return; }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const response: Response = await handler(request);
    const out: Record<string, string | string[]> = {};
    response.headers.forEach((v, k) => { if (k !== "set-cookie") out[k] = v; });
    const sc = (response.headers as any).getSetCookie?.() ?? [];
    if (sc.length) out["set-cookie"] = sc;
    res.writeHead(response.status, out).end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  let file = path.join(STATIC, url.pathname === "/" ? "index.html" : url.pathname);
  if (!existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
}).listen(Number(process.env.E2E_PORT ?? 4400), "127.0.0.1", () => console.log(`listening ${process.env.E2E_PORT ?? 4400}`));
