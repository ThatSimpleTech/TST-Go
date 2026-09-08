import { Bike, Car, Download, Footprints, Navigation, Star, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { downloadText, googleMapsUrl, shareQuery, toGpx } from "@/lib/geo/export";
import { ensurePlottedRoute } from "@/lib/geo/ensure-route";
import { formatDistance, formatPair, haversine } from "@/lib/geo/math";
import { PROFILE_SPEED } from "@/lib/geo/places";
import { APP_NAME, APP_SLUG } from "@/lib/brand";
import { useFlashGo, type TravelMode } from "@/lib/geo/store";
import { cn } from "@/lib/utils";

const MODES: { id: TravelMode; label: string; icon: typeof Zap }[] = [
  { id: "jump", label: "Jump", icon: Zap },
  { id: "walk", label: "Walk", icon: Footprints },
  { id: "cycle", label: "Cycle", icon: Bike },
  { id: "drive", label: "Drive", icon: Car },
];

export function PlacesPanel({ onClose }: { onClose?: () => void }) {
  const favorites = useFlashGo((s) => s.favorites);
  const history = useFlashGo((s) => s.history);
  const waypoints = useFlashGo((s) => s.waypoints);
  const routePts = useFlashGo((s) => s.routePts);
  const routeTotal = useFlashGo((s) => s.routeTotal);
  const mode = useFlashGo((s) => s.mode);
  const speedKmh = useFlashGo((s) => s.speedKmh);
  const follow = useFlashGo((s) => s.follow);
  const loop = useFlashGo((s) => s.loop);
  const teleportTo = useFlashGo((s) => s.teleportTo);
  const unstar = useFlashGo((s) => s.unstar);
  const starCurrent = useFlashGo((s) => s.starCurrent);
  const removeWaypoint = useFlashGo((s) => s.removeWaypoint);
  const clearRoute = useFlashGo((s) => s.clearRoute);
  const addWaypoint = useFlashGo((s) => s.addWaypoint);
  const pick = useFlashGo((s) => s.pick);
  const sim = useFlashGo((s) => s.sim);
  const setMode = useFlashGo((s) => s.setMode);
  const setSpeed = useFlashGo((s) => s.setSpeed);
  const setFollow = useFlashGo((s) => s.setFollow);
  const setLoop = useFlashGo((s) => s.setLoop);

  const pos = sim ?? pick;

  function exportGpx() {
    const pts = routePts.length ? routePts : waypoints.length ? waypoints : [pos];
    downloadText(
      `${APP_SLUG}-${Date.now()}.gpx`,
      toGpx(pick.label || APP_NAME, pts),
      "application/gpx+xml",
    );
    toast.success("GPX downloaded");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="font-display text-base font-medium tracking-tight">Signal & route</h2>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const nowOn = starCurrent();
            toast.success(nowOn ? "Saved to favorites" : "Removed from favorites");
          }}
        >
          <Star className="size-3.5" />
          Save pin
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1">
        {MODES.map((m) => {
          const Icon = m.icon;
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium",
                on ? "bg-surface text-fg shadow-border" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" />
              {m.label}
            </button>
          );
        })}
      </div>

      {mode !== "jump" ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>Travel speed</span>
            <span className="font-mono tabular-nums">{speedKmh.toFixed(0)} km/h</span>
          </div>
          <Slider
            min={1}
            max={mode === "walk" ? 12 : mode === "cycle" ? 40 : 160}
            step={1}
            value={[speedKmh]}
            onValueChange={(v) => setSpeed(v[0] ?? PROFILE_SPEED[mode])}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">
          Jump teleports instantly. Switch to Walk, Cycle, or Drive to plot a path and move at real
          speed.
        </p>
      )}

      <label className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">Follow on map</span>
        <Switch checked={follow} onChange={setFollow} />
      </label>
      <label className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">Loop route</span>
        <Switch checked={loop} onChange={setLoop} />
      </label>

      <Separator className="my-4" />

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium tracking-wide text-subtle uppercase">Waypoints</h3>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => addWaypoint(pick, pick.label)}>
            Use pin
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearRoute}>
            Clear
          </Button>
        </div>
      </div>
      {waypoints.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          In Walk, Cycle, or Drive, tap the map to drop stops. Two or more builds a route.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {waypoints.map((w, i) => (
            <li key={w.id} className="flex items-center gap-2 rounded-lg px-1 py-1">
              <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 text-[10px] font-medium">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{w.name}</span>
              <button
                type="button"
                className="rounded-md p-1 text-subtle hover:text-fg"
                onClick={() => removeWaypoint(w.id)}
                aria-label={`Remove ${w.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {routeTotal > 0 ? (
        <p className="mt-2 text-xs text-muted">Plotted path · {formatDistance(routeTotal)}</p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => void ensurePlottedRoute(false)}>
          <Navigation className="size-4" />
          Plot
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={() => void ensurePlottedRoute(true)}>
          Optimize
        </Button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={exportGpx}>
          <Download className="size-3.5" />
          GPX
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => {
            void navigator.clipboard.writeText(shareQuery(pos, pick.label));
            toast.success("Share link copied");
          }}
        >
          Copy link
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => window.open(googleMapsUrl(pos), "_blank", "noopener")}
        >
          Maps
        </Button>
      </div>

      <Separator className="my-4" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <h3 className="text-xs font-medium tracking-wide text-subtle uppercase">Favorites</h3>
        {favorites.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Star a pin to keep it here.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {favorites.map((f) => (
              <li key={f.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                  onClick={() => {
                    teleportTo(f, f.name);
                    onClose?.();
                  }}
                >
                  <span className="block truncate text-sm">{f.name}</span>
                  <span className="block font-mono text-[11px] text-muted tabular-nums">
                    {formatPair(f, 4)}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-md p-2 text-subtle hover:text-fg"
                  onClick={() => unstar(f.id)}
                  aria-label={`Remove ${f.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-5 text-xs font-medium tracking-wide text-subtle uppercase">History</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Teleports you make will land here.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                  onClick={() => {
                    teleportTo(h, h.name);
                    onClose?.();
                  }}
                >
                  <span className="block truncate text-sm">{h.name}</span>
                  <span className="block font-mono text-[11px] text-muted tabular-nums">
                    {formatPair(h, 4)}
                    {favorites.some((f) => haversine(f, h) < 40) ? " · saved" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-10 rounded-full transition-colors",
        checked ? "bg-live" : "bg-surface-2 shadow-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-fg transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
