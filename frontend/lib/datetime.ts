export function toLocalDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatHM(ms: number, t?: (k: string) => string): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const labelH = t ? t("time.h") : "h";
  const labelM = t ? t("time.m") : "m";
  return `${h}${labelH} ${m}${labelM}`;
}

export function localeTag(lang: string): string {
  switch (lang) {
    case "es": return "es-ES";
    case "en": return "en-US";
    default: return "ca-ES";
  }
}
