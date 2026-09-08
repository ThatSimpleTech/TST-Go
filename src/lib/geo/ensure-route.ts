import { toast } from "sonner";
import { formatDistance, straightLine, type LatLng } from "./math";
import { buildRoute } from "./routing";
import { useFlashGo, type TravelMode } from "./store";

function through(points: LatLng[]): LatLng[] {
  if (points.length === 0) return [];
  const out: LatLng[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    out.push(...straightLine(points[i - 1]!, points[i]!).slice(1));
  }
  return out;
}

function profileFor(mode: TravelMode) {
  if (mode === "cycle") return "cycling" as const;
  if (mode === "walk") return "walking" as const;
  return "driving" as const;
}

export async function ensurePlottedRoute(optimize = false): Promise<boolean> {
  const s = useFlashGo.getState();
  if (s.waypoints.length < 2) {
    toast.message("Add at least two waypoints. Tap the map in Walk, Cycle, or Drive.");
    return false;
  }
  if (!optimize && s.routePts.length >= 2) return true;
  const res = await buildRoute({
    data: {
      points: s.waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
      profile: profileFor(s.mode === "jump" ? "drive" : s.mode),
      optimize,
    },
  });
  if (res.ok) {
    s.setRoute(res.path);
    toast.success(`Route ready · ${formatDistance(res.distanceM)}`);
    return true;
  }
  s.setRoute(through(s.waypoints));
  toast.message("No roads found — using a straight path.");
  return true;
}
