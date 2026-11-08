// Story #1102: one serviceability rule in three places (supabase/functions/serviceability, app/src/lib/area.ts, the database function kitchen_serves).
// They all run the same cases, spec/serviceability_cases.json, so they cannot drift apart again.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { servesPlace, type AreaKitchen } from "../../src/lib/area";

type Case = { name: string; kitchen: { pin_codes: string[]; lat: number | null; lng: number | null; radius_m: number; active: boolean }; pin: string | null; place: { lat: number; lng: number } | null; served: boolean };
const cases: Case[] = JSON.parse(readFileSync("../spec/serviceability_cases.json", "utf8")).cases;

describe("servesPlace runs the shared cases", () => {
  for (const c of cases) {
    it(c.name, () => {
      const k: AreaKitchen = { id: "k", name: "K", open: true, opens_at: null, closes_at: null, ...c.kitchen };
      expect(servesPlace(k, c.pin ?? "", c.place ?? undefined)).toBe(c.served);
    });
  }
});
