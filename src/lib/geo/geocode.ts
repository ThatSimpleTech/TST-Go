import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { censusUrl, cleanAddress, looksLikeStreetAddress, parseCensus } from "./address";

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
  const parts = display
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(1, 4).join(", ");
}

export const searchPlaces = createServerFn({ method: "POST" })
  .validator(z.object({ q: z.string().min(1).max(160) }))
  .handler(async ({ data }): Promise<{ results: PlaceHit[]; error?: string }> => {
    const q = cleanAddress(data.q) || data.q.trim();
    // OpenStreetMap is missing many US house numbers; the US Census geocoder has nearly all of them.
    const [census, osm] = await Promise.all([
      looksLikeStreetAddress(q) ? searchCensus(q) : Promise.resolve<PlaceHit[]>([]),
      searchNominatim(q),
    ]);
    const seen = new Set<string>();
    const results = [...census, ...(osm ?? [])].filter((r) => {
      const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (results.length) return { results: results.slice(0, 7) };
    if (osm === null) return { results: [], error: "Could not reach the map search service." };
    return { results: [] };
  });

async function searchCensus(q: string): Promise<PlaceHit[]> {
  try {
    const res = await fetch(censusUrl(q), { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return parseCensus(await res.json());
  } catch {
    return [];
  }
}

/** Returns null when the service could not be reached. */
async function searchNominatim(q: string): Promise<PlaceHit[] | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "7");
  url.searchParams.set("addressdetails", "0");
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{
      display_name: string;
      name?: string;
      lat: string;
      lon: string;
    }>;
    return json
      .map((row) => ({
        name: shortName(row.display_name, row.name),
        detail: detailOf(row.display_name),
        lat: Number(row.lat),
        lng: Number(row.lon),
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    return null;
  }
}

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
