export const DEFAULT_TZ = "Africa/Lagos";

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** 24-hour clock in the hotel's time zone, e.g. "10:21". */
export function fmtTime(value: string | number | Date, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(toDate(value));
}

/** e.g. "Fri 6 Nov". Pass a YYYY-MM-DD date string for calendar dates. */
export function fmtDate(value: string | number | Date, tz = DEFAULT_TZ): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // A calendar date, not an instant: format it as written.
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
      .format(new Date(`${value}T12:00:00Z`))
      .replace(",", "");
  }
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tz,
  })
    .format(toDate(value))
    .replace(",", "");
}

export function fmtDateTime(value: string | number | Date, tz = DEFAULT_TZ): string {
  return `${fmtDate(value, tz)}, ${fmtTime(value, tz)}`;
}

/** Today's calendar date in the hotel's time zone, as YYYY-MM-DD. */
export function todayISO(tz = DEFAULT_TZ, now = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(new Date(now));
  return parts; // en-CA formats as YYYY-MM-DD
}

/** The current time in ms. Server components render once per request, so reading it is safe there. */
export function currentTime(): number {
  return Date.now();
}

/** ISO timestamp `minutes` before now. */
export function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** True if the instant happened within the last `ms` milliseconds. */
export function isRecent(value: string | null | undefined, ms: number): boolean {
  return Boolean(value) && Date.now() - Date.parse(value as string) < ms;
}

export function minutesBetween(from: string | number | Date, to: string | number | Date = Date.now()): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 60000);
}

/** "13 min", "1 h 5 min". */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "just now", "6 min ago", "2 h ago", "3 days ago". */
export function fmtAgo(value: string | number | Date, now = Date.now()): string {
  const m = minutesBetween(value, now);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function fmtMoney(amount: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Money stored in minor units (kobo for NGN), e.g. 1250000 -> "₦12,500". */
export function fmtMinor(minor: number, currency = "NGN"): string {
  return fmtMoney(minor / 100, currency);
}

const HONORIFICS = new Set(["mr", "mr.", "mrs", "mrs.", "ms", "ms.", "miss", "dr", "dr.", "chief"]);

export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/).filter((p) => !HONORIFICS.has(p.toLowerCase()));
  return parts[0] ?? fullName;
}

export function initials(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/).filter((p) => !HONORIFICS.has(p.toLowerCase()));
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function greeting(tz = DEFAULT_TZ, now = Date.now()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(new Date(now)),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Floor 2"; 0 means guest rooms with no floor recorded, below 0 means amenities (lounge, gym). */
export function floorLabel(floor: number | null | undefined): string {
  if (floor === null || floor === undefined) return "";
  if (floor === 0) return "Guest rooms";
  if (floor < 0) return "Amenities";
  return `Floor ${floor}`;
}
