import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Point = z.object({ lat: z.number(), lng: z.number() });

export type RouteProfile = "walking" | "cycling" | "driving";

function osrmProfile(p: RouteProfile) {
  if (p === "walking") return "foot";
  if (p === "cycling") return "bike";
  return "driving";
}

type OsrmRoute = {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
  trips?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
};

export type RouteResult = {
  ok: boolean;
  path: Array<{ lat: number; lng: number }>;
  distanceM: number;
  durationS: number;
  error?: string;
  fallback?: boolean;
};

function decode(json: OsrmRoute): RouteResult | null {
  const piece = json.routes?.[0] ?? json.trips?.[0];
  if (!piece?.geometry?.coordinates?.length) return null;
  return {
    ok: true,
    path: piece.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceM: piece.distance,
    durationS: piece.duration,
  };
}

export const buildRoute = createServerFn({ method: "POST" })
  .validator(
    z.object({
      points: z.array(Point).min(2).max(12),
      profile: z.enum(["walking", "cycling", "driving"]),
      optimize: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }): Promise<RouteResult> => {
    const coords = data.points.map((p) => `${p.lng},${p.lat}`).join(";");
    const profile = osrmProfile(data.profile);
    const kind = data.optimize && data.points.length >= 3 ? "trip" : "route";
    const extra =
      kind === "trip"
        ? "source=first&destination=last&roundtrip=false&overview=full&geometries=geojson"
        : "overview=full&geometries=geojson";
    const url = `https://router.project-osrm.org/${kind}/v1/${profile}/${coords}?${extra}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        return {
          ok: false,
          path: [],
          distanceM: 0,
          durationS: 0,
          error: "Routing service returned an error.",
        };
      }
      const json = (await res.json()) as OsrmRoute;
      const decoded = decode(json);
      if (decoded) return decoded;
      return {
        ok: false,
        path: [],
        distanceM: 0,
        durationS: 0,
        error: "No road path between those points.",
      };
    } catch {
      return {
        ok: false,
        path: [],
        distanceM: 0,
        durationS: 0,
        error: "Could not reach the routing service.",
      };
    }
  });
