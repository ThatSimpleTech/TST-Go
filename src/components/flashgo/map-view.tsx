import { useEffect, useMemo, useRef } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useFlashGo } from "@/lib/geo/store";
import { reverseGeocode } from "@/lib/geo/geocode";

const STREETS = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri",
  subdomains: "",
};

const SATELLITE = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri",
  subdomains: "",
};

function makeSimIcon(heading: number, live: boolean) {
  return L.divIcon({
    className: "fg-sim-icon",
    html: `<span class="fg-sim-rot" style="transform:rotate(${heading}deg)"><span class="fg-sim-chevron ${live ? "is-live" : ""}"></span></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function makeWayIcon(label: string) {
  return L.divIcon({
    className: "fg-way-icon",
    html: `<span class="fg-way-dot">${label}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function MapController() {
  const map = useMap();
  const flyTo = useFlashGo((s) => s.flyTo);
  const setFlyTo = useFlashGo((s) => s.setFlyTo);
  const follow = useFlashGo((s) => s.follow);
  const running = useFlashGo((s) => s.running);
  const sim = useFlashGo((s) => s.sim);
  const pick = useFlashGo((s) => s.pick);
  const mapCmd = useFlashGo((s) => s.mapCmd);
  const clearMapCmd = useFlashGo((s) => s.clearMapCmd);
  const lastPan = useRef(0);

  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const t = window.setTimeout(fix, 180);
    window.addEventListener("resize", fix);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", fix);
    };
  }, [map]);

  useEffect(() => {
    if (!flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? Math.max(map.getZoom(), 14), {
      duration: 0.85,
    });
    setFlyTo(null);
  }, [flyTo, map, setFlyTo]);

  useEffect(() => {
    if (!mapCmd) return;
    if (mapCmd === "zoomIn") map.zoomIn();
    if (mapCmd === "zoomOut") map.zoomOut();
    if (mapCmd === "recenter") {
      const t = sim ?? pick;
      map.panTo([t.lat, t.lng], { animate: true, duration: 0.35 });
    }
    clearMapCmd();
  }, [mapCmd, map, clearMapCmd, sim, pick]);

  useEffect(() => {
    if (!running || !follow || !sim) return;
    const now = performance.now();
    if (now - lastPan.current < 280) return;
    lastPan.current = now;
    map.panTo([sim.lat, sim.lng], { animate: true, duration: 0.28 });
  }, [sim?.lat, sim?.lng, running, follow, map, sim]);

  return null;
}

function MapEvents() {
  const running = useFlashGo((s) => s.running);
  const mode = useFlashGo((s) => s.mode);
  const setPick = useFlashGo((s) => s.setPick);
  const setLabel = useFlashGo((s) => s.setLabel);
  const addWaypoint = useFlashGo((s) => s.addWaypoint);
  const setFollow = useFlashGo((s) => s.setFollow);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);
  const dragged = useRef(false);

  function labelCenter(lat: number, lng: number) {
    if (timer.current) window.clearTimeout(timer.current);
    const id = ++seq.current;
    timer.current = window.setTimeout(() => {
      void reverseGeocode({ data: { lat, lng } }).then((r) => {
        if (id === seq.current) setLabel(r.label);
      });
    }, 420);
  }

  const map = useMapEvents({
    dragstart() {
      dragged.current = true;
      if (running) setFollow(false);
    },
    dragend() {
      window.setTimeout(() => {
        dragged.current = false;
      }, 80);
      if (running) return;
      const c = map.getCenter();
      setPick({ lat: c.lat, lng: c.lng });
      labelCenter(c.lat, c.lng);
    },
    click(e) {
      if (running) return;
      if (mode === "jump") return;
      if (dragged.current) return;
      const state = useFlashGo.getState();
      if (state.waypoints.length === 0) {
        addWaypoint({ lat: state.pick.lat, lng: state.pick.lng }, state.pick.label || "Start");
      }
      addWaypoint({ lat: e.latlng.lat, lng: e.latlng.lng }, "Waypoint");
    },
  });

  return null;
}

export function MapView() {
  const pick = useFlashGo((s) => s.pick);
  const sim = useFlashGo((s) => s.sim);
  const running = useFlashGo((s) => s.running);
  const paused = useFlashGo((s) => s.paused);
  const waypoints = useFlashGo((s) => s.waypoints);
  const routePts = useFlashGo((s) => s.routePts);
  const mapStyle = useFlashGo((s) => s.mapStyle);

  const routeLatLngs = useMemo(
    () => routePts.map((p) => [p.lat, p.lng] as [number, number]),
    [routePts],
  );

  const simIcon = useMemo(
    () => makeSimIcon(sim?.heading ?? 0, running && !paused),
    [sim?.heading, running, paused],
  );

  const tiles = mapStyle === "satellite" ? SATELLITE : STREETS;

  return (
    <MapContainer
      center={[pick.lat, pick.lng]}
      zoom={13}
      zoomControl={false}
      attributionControl
      className="fg-map absolute inset-0 z-0 h-full w-full"
    >
      <TileLayer
        key={mapStyle}
        attribution={tiles.attribution}
        url={tiles.url}
        subdomains={tiles.subdomains || "abc"}
        maxZoom={19}
      />
      <MapController />
      <MapEvents />
      {routeLatLngs.length > 1 ? (
        <Polyline
          positions={routeLatLngs}
          pathOptions={{ color: "#9eb0c0", weight: 4, opacity: 0.85, lineJoin: "round" }}
        />
      ) : null}
      {waypoints.map((w, i) => (
        <Marker key={w.id} position={[w.lat, w.lng]} icon={makeWayIcon(String(i + 1))} />
      ))}
      {sim ? (
        <>
          <Circle
            center={[sim.lat, sim.lng]}
            radius={Math.max(18, sim.accuracy * 4)}
            pathOptions={{
              color: running ? "#5ea37a" : "#9eb0c0",
              fillColor: running ? "#5ea37a" : "#9eb0c0",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
          <Marker position={[sim.lat, sim.lng]} icon={simIcon} />
        </>
      ) : null}
    </MapContainer>
  );
}
