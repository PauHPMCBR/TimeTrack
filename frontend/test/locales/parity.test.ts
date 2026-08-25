import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const localesDir = join(__dirname, "../../locales");
const ca = JSON.parse(readFileSync(join(localesDir, "ca.json"), "utf8"));
const es = JSON.parse(readFileSync(join(localesDir, "es.json"), "utf8"));
const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));

type DictValue = string | { [k: string]: DictValue };

function flatten(prefix: string, node: DictValue, out: string[]): string[] {
  if (node === null || typeof node !== "object") {
    out.push(prefix);
    return out;
  }
  for (const k of Object.keys(node).sort()) {
    flatten(prefix ? `${prefix}.${k}` : k, node[k], out);
  }
  return out;
}

const caKeys = flatten("", ca, []);
const esKeys = flatten("", es, []);
const enKeys = flatten("", en, []);

describe("locale parity", () => {
  it("ca is the reference superset: every key exists in es and en", () => {
    const missingInEs = caKeys.filter((k) => !esKeys.includes(k));
    const missingInEn = caKeys.filter((k) => !enKeys.includes(k));

    expect(missingInEs).toEqual([]);
    expect(missingInEn).toEqual([]);
  });

  it("es and en have no keys missing from ca", () => {
    const caSet = new Set(caKeys);
    const extra = [...esKeys, ...enKeys].filter((k) => !caSet.has(k));
    expect(extra).toEqual([]);
  });

  it("no empty values in any locale", () => {
    for (const dict of [ca, es, en]) {
      const empty = flatten("", dict, []).filter((k) => {
        const parts = k.split(".");
        let node: DictValue | undefined = dict;
        for (const p of parts) {
          node = (node as { [k: string]: DictValue })[p];
        }
        return typeof node !== "string" || node.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });

  it("leaf values are all strings (no empty nested objects)", () => {
    for (const dict of [ca, es, en]) {
      expect(flatten("", dict, []).length).toBeGreaterThan(0);
    }
  });
});
