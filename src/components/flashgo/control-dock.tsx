import { Bike, Car, Footprints, Pause, Play, Square, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ensurePlottedRoute } from "@/lib/geo/ensure-route";
import { PROFILE_SPEED } from "@/lib/geo/places";
import { useFlashGo, type TravelMode } from "@/lib/geo/store";
import { cn } from "@/lib/utils";

const MODES: { id: TravelMode; label: string; icon: typeof Zap }[] = [
  { id: "jump", label: "Jump", icon: Zap },
  { id: "walk", label: "Walk", icon: Footprints },
  { id: "cycle", label: "Cycle", icon: Bike },
  { id: "drive", label: "Drive", icon: Car },
];

export function ControlDock() {
  const mode = useFlashGo((s) => s.mode);
  const setMode = useFlashGo((s) => s.setMode);
  const running = useFlashGo((s) => s.running);
  const paused = useFlashGo((s) => s.paused);
  const start = useFlashGo((s) => s.start);
  const pause = useFlashGo((s) => s.pause);
  const stop = useFlashGo((s) => s.stop);
  const teleportTo = useFlashGo((s) => s.teleportTo);
  const pick = useFlashGo((s) => s.pick);
  const waypoints = useFlashGo((s) => s.waypoints);
  const speedKmh = useFlashGo((s) => s.speedKmh);
  const setSpeed = useFlashGo((s) => s.setSpeed);

  async function go() {
    if (mode === "jump") {
      teleportTo(pick, pick.label);
      toast.success(`Teleported to ${pick.label}`);
      return;
    }
    if (waypoints.length >= 2) {
      await ensurePlottedRoute(false);
    }
    start();
    if (waypoints.length >= 2) {
      toast.success(paused ? "Resumed" : "Route started");
    } else {
      toast.message("Signal live. Nudge with the joystick or WASD, or add waypoints.");
    }
  }

  const maxSpeed = mode === "walk" ? 12 : mode === "cycle" ? 40 : 160;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1 rounded-full bg-surface/92 p-1 shadow-border">
        {MODES.map((m) => {
          const Icon = m.icon;
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                on ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
              )}
              aria-pressed={on}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          );
        })}
      </div>

      {mode !== "jump" && !running ? (
        <div className="flex w-[min(100%,220px)] items-center gap-2 rounded-full bg-surface/92 px-3 py-2 shadow-border">
          <span className="w-12 shrink-0 font-mono text-[11px] text-muted tabular-nums">
            {speedKmh.toFixed(0)} km
          </span>
          <Slider
            min={1}
            max={maxSpeed}
            step={1}
            value={[speedKmh]}
            onValueChange={(v) => setSpeed(v[0] ?? PROFILE_SPEED[mode])}
            aria-label="Travel speed"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {running ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-12 rounded-full"
            onClick={pause}
            aria-label={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
          </Button>
        ) : null}

        <button
          type="button"
          onClick={running ? stop : () => void go()}
          className={cn(
            "flex size-[76px] items-center justify-center rounded-full text-sm font-semibold tracking-wide uppercase",
            "shadow-border transition-[transform,background-color] duration-[var(--motion-quick)]",
            "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            running ? "bg-stop text-stop-foreground" : "bg-live text-live-foreground",
          )}
          aria-label={running ? "Stop simulation" : "Start"}
        >
          {running ? (
            <span className="flex flex-col items-center leading-none">
              <Square className="mb-1 size-4 fill-current" />
              Stop
            </span>
          ) : (
            "Go"
          )}
        </button>

        {running ? <div className="size-12" aria-hidden /> : null}
      </div>
    </div>
  );
}
