export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// UPDL Banjarbaru is WITA (UTC+8). Pin the timezone explicitly so timestamps
// render in local time regardless of the server/container timezone (the Docker
// image runs UTC), instead of silently showing UTC labelled as local.
const WITA_TIME_ZONE = "Asia/Makassar";

export function formatDateTime(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: WITA_TIME_ZONE,
  }).format(date);
}

export function formatDate(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: WITA_TIME_ZONE,
  }).format(date);
}

export function isExpired(date: Date | null | undefined) {
  return Boolean(date && date.getTime() < Date.now());
}
