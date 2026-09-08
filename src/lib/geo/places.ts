import type { LatLng } from "./math";

export type Preset = LatLng & { name: string; region: string };

export const PRESETS: Preset[] = [
  { name: "Times Square", region: "New York", lat: 40.758, lng: -73.9855 },
  { name: "Golden Gate", region: "San Francisco", lat: 37.8199, lng: -122.4783 },
  { name: "Santa Monica Pier", region: "Los Angeles", lat: 34.0089, lng: -118.4984 },
  { name: "Navy Pier", region: "Chicago", lat: 41.8917, lng: -87.6086 },
  { name: "Tower Bridge", region: "London", lat: 51.5055, lng: -0.0754 },
  { name: "Eiffel Tower", region: "Paris", lat: 48.8584, lng: 2.2945 },
  { name: "Colosseum", region: "Rome", lat: 41.8902, lng: 12.4922 },
  { name: "Sagrada Família", region: "Barcelona", lat: 41.4036, lng: 2.1744 },
  { name: "Brandenburg Gate", region: "Berlin", lat: 52.5163, lng: 13.3777 },
  { name: "Dam Square", region: "Amsterdam", lat: 52.3731, lng: 4.8926 },
  { name: "Shibuya Crossing", region: "Tokyo", lat: 35.6595, lng: 139.7004 },
  { name: "Marina Bay", region: "Singapore", lat: 1.2816, lng: 103.8636 },
  { name: "Burj Khalifa", region: "Dubai", lat: 25.1972, lng: 55.2744 },
  { name: "Sydney Opera", region: "Sydney", lat: -33.8568, lng: 151.2153 },
  { name: "Bondi Beach", region: "Sydney", lat: -33.8915, lng: 151.2767 },
  { name: "Christ the Redeemer", region: "Rio", lat: -22.9519, lng: -43.2105 },
  { name: "Table Mountain", region: "Cape Town", lat: -33.9628, lng: 18.4098 },
  { name: "Red Square", region: "Moscow", lat: 55.7539, lng: 37.6208 },
  { name: "Taj Mahal", region: "Agra", lat: 27.1751, lng: 78.0421 },
  { name: "Victoria Harbour", region: "Hong Kong", lat: 22.287, lng: 114.171 },
];

export const DEFAULT_PLACE: Preset = PRESETS[0]!;

export function randomPreset(except?: string): Preset {
  const pool = except ? PRESETS.filter((p) => p.name !== except) : PRESETS;
  return pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_PLACE;
}

export const PROFILE_SPEED: Record<"jump" | "walk" | "cycle" | "drive", number> = {
  jump: 0,
  walk: 5,
  cycle: 16,
  drive: 48,
};
