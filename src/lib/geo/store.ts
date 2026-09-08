import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  decorateRoute,
  destination,
  formatPair,
  haversine,
  pointAlongRoute,
  type LatLng,
  type RoutePoint,
  uid,
} from "./math";
import { DEFAULT_PLACE, PROFILE_SPEED } from "./places";

export type TravelMode = "jump" | "walk" | "cycle" | "drive";
export type MapStyle = "streets" | "satellite";
export type MapCmd = "zoomIn" | "zoomOut" | "recenter" | null;

export type SavedPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  savedAt: number;
};

export type Waypoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type Sim = {
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  accuracy: number;
};

type FlashGoState = {
  pick: LatLng & { label: string };
  sim: Sim | null;
  running: boolean;
  paused: boolean;
  follow: boolean;
  loop: boolean;
  mode: TravelMode;
  speedKmh: number;
  mapStyle: MapStyle;
  mapCmd: MapCmd;
  waypoints: Waypoint[];
  routePts: RoutePoint[];
  routeTotal: number;
  routeTraveled: number;
  favorites: SavedPlace[];
  history: SavedPlace[];
  joystick: { x: number; y: number };
  keys: { x: number; y: number };
  onboarded: boolean;
  flyTo: (LatLng & { zoom?: number }) | null;
  setPick: (p: LatLng, label?: string) => void;
  setLabel: (label: string) => void;
  setMode: (mode: TravelMode) => void;
  setSpeed: (kmh: number) => void;
  setFollow: (v: boolean) => void;
  setLoop: (v: boolean) => void;
  setMapStyle: (style: MapStyle) => void;
  issueMapCmd: (cmd: Exclude<MapCmd, null>) => void;
  clearMapCmd: () => void;
  setJoystick: (x: number, y: number) => void;
  setKeys: (x: number, y: number) => void;
  setFlyTo: (v: (LatLng & { zoom?: number }) | null) => void;
  addWaypoint: (p: LatLng, name?: string) => void;
  removeWaypoint: (id: string) => void;
  clearRoute: () => void;
  setRoute: (path: LatLng[]) => void;
  start: () => void;
  pause: () => void;
  stop: () => void;
  tick: (dtMs: number) => void;
  teleportTo: (p: LatLng, label: string) => void;
  starCurrent: () => boolean;
  unstar: (id: string) => void;
  remember: (p: LatLng, name: string) => void;
  dismissOnboard: () => void;
};

function speedFor(mode: TravelMode, custom: number) {
  if (mode === "jump") return 0;
  return custom > 0 ? custom : PROFILE_SPEED[mode];
}

function trimList<T>(list: T[], max: number) {
  return list.length > max ? list.slice(0, max) : list;
}

function stick(a: { x: number; y: number }, b: { x: number; y: number }) {
  let x = a.x + b.x;
  let y = a.y + b.y;
  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }
  return { x, y, mag: Math.min(1, mag) };
}

export const useFlashGo = create<FlashGoState>()(
  persist(
    (set, get) => ({
      pick: { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng, label: DEFAULT_PLACE.name },
      sim: null,
      running: false,
      paused: false,
      follow: true,
      loop: false,
      mode: "jump",
      speedKmh: 5,
      mapStyle: "streets",
      mapCmd: null,
      waypoints: [],
      routePts: [],
      routeTotal: 0,
      routeTraveled: 0,
      favorites: [],
      history: [],
      joystick: { x: 0, y: 0 },
      keys: { x: 0, y: 0 },
      onboarded: false,
      flyTo: null,

      setPick: (p, label) =>
        set({
          pick: { lat: p.lat, lng: p.lng, label: label ?? get().pick.label },
        }),
      setLabel: (label) => set({ pick: { ...get().pick, label } }),
      setMode: (mode) => {
        set({
          mode,
          speedKmh: mode === "jump" ? get().speedKmh : PROFILE_SPEED[mode],
        });
      },
      setSpeed: (kmh) => set({ speedKmh: kmh }),
      setFollow: (follow) => set({ follow }),
      setLoop: (loop) => set({ loop }),
      setMapStyle: (mapStyle) => set({ mapStyle }),
      issueMapCmd: (mapCmd) => set({ mapCmd }),
      clearMapCmd: () => set({ mapCmd: null }),
      setJoystick: (x, y) => set({ joystick: { x, y } }),
      setKeys: (x, y) => set({ keys: { x, y } }),
      setFlyTo: (flyTo) => set({ flyTo }),

      addWaypoint: (p, name) =>
        set((s) => ({
          waypoints: [
            ...s.waypoints,
            { id: uid(), name: name ?? `Stop ${s.waypoints.length + 1}`, lat: p.lat, lng: p.lng },
          ],
        })),
      removeWaypoint: (id) =>
        set((s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) })),
      clearRoute: () => set({ waypoints: [], routePts: [], routeTotal: 0, routeTraveled: 0 }),
      setRoute: (path) => {
        const { pts, total } = decorateRoute(path);
        set({ routePts: pts, routeTotal: total, routeTraveled: 0 });
      },

      start: () => {
        const s = get();
        const origin = s.sim ?? { lat: s.pick.lat, lng: s.pick.lng };
        set({
          running: true,
          paused: false,
          follow: true,
          sim: {
            lat: origin.lat,
            lng: origin.lng,
            heading: s.sim?.heading ?? 0,
            speedKmh: speedFor(s.mode, s.speedKmh),
            accuracy: 8,
          },
        });
      },
      pause: () => set({ paused: !get().paused }),
      stop: () =>
        set({
          running: false,
          paused: false,
          joystick: { x: 0, y: 0 },
          keys: { x: 0, y: 0 },
          sim: get().sim ? { ...get().sim!, speedKmh: 0 } : null,
        }),

      tick: (dtMs) => {
        const s = get();
        if (!s.running || s.paused || !s.sim) return;
        const dt = Math.min(0.05, dtMs / 1000);
        const stickVal = stick(s.joystick, s.keys);

        if (stickVal.mag > 0.08) {
          const heading = (Math.atan2(stickVal.x, stickVal.y) * 180) / Math.PI;
          const kmh = speedFor(s.mode === "jump" ? "walk" : s.mode, s.speedKmh) * stickVal.mag;
          const mps = (kmh * 1000) / 3600;
          const next = destination(s.sim, heading, mps * dt);
          set({
            sim: { ...s.sim, ...next, heading: (heading + 360) % 360, speedKmh: kmh },
            pick: { ...s.pick, lat: next.lat, lng: next.lng },
          });
          return;
        }

        if (s.mode === "jump" || s.routePts.length < 2) {
          if (s.sim.speedKmh !== 0) set({ sim: { ...s.sim, speedKmh: 0 } });
          return;
        }

        const kmh = speedFor(s.mode, s.speedKmh);
        const mps = (kmh * 1000) / 3600;
        let traveled = s.routeTraveled + mps * dt;
        if (traveled >= s.routeTotal) {
          if (s.loop && s.routeTotal > 0) {
            traveled = traveled % s.routeTotal;
          } else {
            const last = s.routePts[s.routePts.length - 1]!;
            set({
              routeTraveled: s.routeTotal,
              running: false,
              sim: {
                lat: last.lat,
                lng: last.lng,
                heading: s.sim.heading,
                speedKmh: 0,
                accuracy: 8,
              },
              pick: { ...s.pick, lat: last.lat, lng: last.lng },
            });
            return;
          }
        }
        const along = pointAlongRoute(s.routePts, traveled);
        set({
          routeTraveled: traveled,
          sim: {
            lat: along.pos.lat,
            lng: along.pos.lng,
            heading: along.heading,
            speedKmh: kmh,
            accuracy: 8,
          },
          pick: { ...s.pick, lat: along.pos.lat, lng: along.pos.lng },
        });
      },

      teleportTo: (p, label) => {
        const s = get();
        s.remember(p, label);
        set({
          pick: { lat: p.lat, lng: p.lng, label },
          sim: {
            lat: p.lat,
            lng: p.lng,
            heading: 0,
            speedKmh: 0,
            accuracy: 8,
          },
          running: true,
          paused: false,
          follow: true,
          flyTo: { lat: p.lat, lng: p.lng, zoom: 16 },
        });
      },

      starCurrent: () => {
        const s = get();
        const src = s.sim ?? s.pick;
        const name = s.pick.label || formatPair(src, 4);
        const existing = s.favorites.find((f) => haversine(f, src) < 25);
        if (existing) {
          set({ favorites: s.favorites.filter((f) => f.id !== existing.id) });
          return false;
        }
        set({
          favorites: trimList(
            [{ id: uid(), name, lat: src.lat, lng: src.lng, savedAt: Date.now() }, ...s.favorites],
            50,
          ),
        });
        return true;
      },
      unstar: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
      remember: (p, name) =>
        set((s) => ({
          history: trimList(
            [
              { id: uid(), name, lat: p.lat, lng: p.lng, savedAt: Date.now() },
              ...s.history.filter((h) => haversine(h, p) > 40),
            ],
            30,
          ),
        })),
      dismissOnboard: () => set({ onboarded: true }),
    }),
    {
      name: "flashgo-v1",
      partialize: (s) => ({
        favorites: s.favorites,
        history: s.history,
        onboarded: s.onboarded,
        mode: s.mode,
        speedKmh: s.speedKmh,
        loop: s.loop,
        mapStyle: s.mapStyle,
      }),
    },
  ),
);
