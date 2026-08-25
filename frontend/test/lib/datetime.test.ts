import { describe, it, expect } from "vitest";
import { toLocalDateKey, formatHM, localeTag } from "@/lib/datetime";

describe("toLocalDateKey", () => {
  it("formats a local date as YYYY-MM-DD using local components (not UTC)", () => {
    // 2026-03-29 23:30 local in a UTC+X timezone would be the next day in UTC
    const d = new Date(2026, 2, 29, 23, 30, 0);
    const expected = `2026-03-29`;
    expect(toLocalDateKey(d)).toBe(expected);
  });

  it("pads month and day", () => {
    expect(toLocalDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("accepts ISO strings", () => {
    const iso = new Date(2026, 4, 10, 12, 0, 0).toISOString();
    expect(toLocalDateKey(iso)).toBe(toLocalDateKey(new Date(iso)));
  });
});

describe("formatHM", () => {
  it("formats milliseconds into hours and minutes", () => {
    const twoAndHalfHours = 2.5 * 3_600_000;
    expect(formatHM(twoAndHalfHours)).toBe("2h 30m");
  });

  it("uses translation labels when provided", () => {
    const t = (k: string) => (k === "time.h" ? " h" : " min");
    expect(formatHM(3_600_000 + 60_000, t)).toBe("1 h 1 min");
  });
});

describe("localeTag", () => {
  it("maps app languages to BCP47 tags", () => {
    expect(localeTag("ca")).toBe("ca-ES");
    expect(localeTag("es")).toBe("es-ES");
    expect(localeTag("en")).toBe("en-US");
  });
});
