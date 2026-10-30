// Helpers for street-address search. Pure functions so they can be unit tested.

export type AddressHit = { name: string; detail: string; lat: number; lng: number };

// "Apt 4B", "Unit 3", "Ste. 200", "#12": every geocoder misses an address that includes them.
const UNIT_RE =
  /(?:,\s*|\s+)(?:apt|apartment|unit|suite|ste|bldg|building|fl|floor|rm|room|lot)(?:\.\s*|\s+|\s*#\s*)(?:[a-z]?\d[a-z0-9-]*|[a-z])(?=,|\s|$)|\s*#\s*[a-z0-9-]+(?=,|\s|$)/gi;

/** "123 Main St Apt 4B, Town" -> "123 Main St, Town". */
export function cleanAddress(q: string): string {
  return q
    .replace(UNIT_RE, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim()
    .replace(/^,+|,+$/g, "")
    .trim();
}

/** Starts with a house number followed by a street name, e.g. "123 Main St". */
export function looksLikeStreetAddress(q: string): boolean {
  return /^\d+[a-zA-Z]?(?:-\d+)?\s+[A-Za-z0-9]/.test(q.trim());
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) =>
      ["ne", "nw", "se", "sw"].includes(w)
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

type CensusJson = {
  result?: {
    addressMatches?: Array<{ matchedAddress?: string; coordinates?: { x?: number; y?: number } }>;
  };
};

/** Turns a US Census geocoder response into hits ("4600 SILVER HILL RD, WASHINGTON, DC, 20233"). */
export function parseCensus(json: CensusJson): AddressHit[] {
  const out: AddressHit[] = [];
  for (const m of json.result?.addressMatches ?? []) {
    const lat = Number(m.coordinates?.y);
    const lng = Number(m.coordinates?.x);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const parts = (m.matchedAddress ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const [street = "Address", city = "", ...rest] = parts;
    out.push({
      name: titleCase(street),
      detail: [titleCase(city), ...rest].filter(Boolean).join(", "),
      lat,
      lng,
    });
  }
  return out;
}

export function censusUrl(q: string): URL {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", q);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  return url;
}
