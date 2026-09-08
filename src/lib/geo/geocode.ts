import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlaceHit = {
  name: string;
  detail: string;
  lat: number;
  lng: number;
};

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "TST-Go/1.0 (web location simulator)",
};

function shortName(display: string, name?: string) {
  if (name && name.trim()) return name.trim();
  return display.split(",")[0]?.trim() || display;
}

function detailOf(display: string) {
  const parts = display.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.slice(1, 4).join(", ");
}

export const searchPlaces = createServerFn({ method: "POST" })
  .validator(z.object({ q: z.string().min(1).max(160) }))
  .handler(async ({ data }): Promise<{ results: PlaceHit[]; error?: string }> => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", data.q);
    url.searchParams.set("limit", "7");
    url.searchParams.set("addressdetails", "0");
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { results: [], error: "Search is busy. Try again in a moment." };
      const json = (await res.json()) as Array<{
        display_name: string;
        name?: string;
        lat: string;
        lon: string;
      }>;
      const results: PlaceHit[] = json
        .map((row) => ({
          name: shortName(row.display_name, row.name),
          detail: detailOf(row.display_name),
          lat: Number(row.lat),
          lng: Number(row.lon),
        }))
        .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
      return { results };
    } catch {
      return { results: [], error: "Could not reach the map search service." };
    }
  });

export const reverseGeocode = createServerFn({ method: "POST" })
  .validator(z.object({ lat: z.number(), lng: z.number() }))
  .handler(async ({ data }): Promise<{ label: string }> => {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(data.lat));
    url.searchParams.set("lon", String(data.lng));
    url.searchParams.set("zoom", "16");
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { label: "Dropped pin" };
      const json = (await res.json()) as { display_name?: string; name?: string };
      if (!json.display_name) return { label: "Dropped pin" };
      return { label: shortName(json.display_name, json.name) };
    } catch {
      return { label: "Dropped pin" };
    }
  });
