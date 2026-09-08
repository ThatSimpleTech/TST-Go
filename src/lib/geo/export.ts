import { APP_NAME } from "@/lib/brand";
import type { LatLng } from "./math";

export function googleMapsUrl(p: LatLng) {
  return `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

export function appleMapsUrl(p: LatLng) {
  return `https://maps.apple.com/?ll=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

export function geoUri(p: LatLng) {
  return `geo:${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

export function osmUrl(p: LatLng) {
  return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
}

export function positionJson(p: LatLng & { heading?: number; speedKmh?: number; accuracy?: number }) {
  return JSON.stringify(
    {
      coords: {
        latitude: p.lat,
        longitude: p.lng,
        accuracy: p.accuracy ?? 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: p.heading ?? null,
        speed: p.speedKmh != null ? (p.speedKmh * 1000) / 3600 : null,
      },
      timestamp: Date.now(),
    },
    null,
    2,
  );
}

export function toGpx(name: string, points: LatLng[]) {
  const wpts = points
    .map(
      (p, i) =>
        `    <wpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><name>${escapeXml(name)} ${i + 1}</name></wpt>`,
    )
    .join("\n");
  const trk =
    points.length >= 2
      ? `    <trk><name>${escapeXml(name)}</name><trkseg>\n${points
          .map((p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}" />`)
          .join("\n")}\n    </trkseg></trk>`
      : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="${escapeXml(APP_NAME)}" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escapeXml(name)}</name></metadata>
${wpts}
${trk}
</gpx>
`;
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function shareQuery(p: LatLng, name?: string) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("lat", p.lat.toFixed(6));
  url.searchParams.set("lng", p.lng.toFixed(6));
  if (name) url.searchParams.set("name", name);
  return url.toString();
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}
