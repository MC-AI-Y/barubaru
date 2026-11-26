/**
 * Zona waktu Indonesia (WIB/WITA/WIT) dan format tanggal/jam.
 * Zona ditentukan dari provinsi hasil geocode, lalu dari koordinat,
 * lalu dari zona perangkat (keputusan #20).
 */

export type ZoneLabel = "WIB" | "WITA" | "WIT";

export const ZONE_TZ: Record<ZoneLabel, string> = {
  WIB: "Asia/Jakarta",
  WITA: "Asia/Makassar",
  WIT: "Asia/Jayapura",
};

const ZONE_OFFSET_MIN: Record<ZoneLabel, number> = { WIB: 420, WITA: 480, WIT: 540 };

const WIT_KEYS = ["papua", "maluku", "irian"];
const WITA_KEYS = [
  "bali",
  "nusa tenggara",
  "sulawesi",
  "gorontalo",
  "kalimantan selatan",
  "kalimantan timur",
  "kalimantan utara",
  "south kalimantan",
  "east kalimantan",
  "north kalimantan",
];

/** Zona dari nama provinsi (Indonesia atau Inggris). null bila tidak dikenali. */
export function zoneFromProvince(province: string | null | undefined): ZoneLabel | null {
  if (!province) return null;
  const p = province.toLowerCase();
  if (WIT_KEYS.some((k) => p.includes(k))) return "WIT";
  if (WITA_KEYS.some((k) => p.includes(k))) return "WITA";
  const wibKeys = ["jawa", "java", "jakarta", "banten", "yogyakarta", "sumatera", "sumatra", "aceh", "riau", "jambi",
    "bengkulu", "lampung", "bangka", "belitung", "kalimantan barat", "kalimantan tengah", "west kalimantan", "central kalimantan"];
  if (wibKeys.some((k) => p.includes(k))) return "WIB";
  return null;
}

export function isInIndonesia(lat: number, lon: number): boolean {
  return lat >= -11.5 && lat <= 6.5 && lon >= 94.5 && lon <= 141.5;
}

/** Perkiraan zona dari koordinat (cadangan bila provinsi tidak diketahui). */
export function zoneFromCoordinates(lat: number, lon: number): ZoneLabel | null {
  if (!isInIndonesia(lat, lon)) return null;
  if (lon >= 126.5) return "WIT";
  if (lon >= 115.5) return "WITA";
  // Bali dan Nusa Tenggara Barat bagian barat berada di bujur 114,4–115,5 (lintang selatan jauh).
  if (lon >= 114.4 && lat <= -7.9) return "WITA";
  return "WIB";
}

/** Zona dari selisih UTC perangkat (menit), misalnya 420 → WIB. */
export function zoneFromOffset(offsetMinutes: number | null | undefined): ZoneLabel | null {
  for (const [zone, off] of Object.entries(ZONE_OFFSET_MIN) as [ZoneLabel, number][]) {
    if (off === offsetMinutes) return zone;
  }
  return null;
}

export function resolveZone(input: {
  province?: string | null;
  lat: number;
  lon: number;
  deviceOffsetMinutes?: number | null;
}): ZoneLabel {
  return (
    zoneFromProvince(input.province) ??
    zoneFromCoordinates(input.lat, input.lon) ??
    zoneFromOffset(input.deviceOffsetMinutes) ??
    "WIB"
  );
}

export interface DateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

export function dateParts(epochMs: number, zone: ZoneLabel): DateParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE_TZ[zone],
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]));
  return {
    year: parts.year ?? "0000",
    month: parts.month ?? "00",
    day: parts.day ?? "00",
    hour: parts.hour ?? "00",
    minute: parts.minute ?? "00",
    second: parts.second ?? "00",
  };
}

/** "04/11/2026" */
export function formatDate(epochMs: number, zone: ZoneLabel): string {
  const p = dateParts(epochMs, zone);
  return `${p.day}/${p.month}/${p.year}`;
}

/** "14:32:10 WIB" */
export function formatTime(epochMs: number, zone: ZoneLabel): string {
  const p = dateParts(epochMs, zone);
  return `${p.hour}:${p.minute}:${p.second} ${zone}`;
}

/** "04/11/2026 14:32:10 WIB" */
export function formatDateTime(epochMs: number, zone: ZoneLabel): string {
  return `${formatDate(epochMs, zone)} ${formatTime(epochMs, zone)}`;
}
