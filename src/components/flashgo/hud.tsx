import { Copy, ExternalLink, Navigation, Satellite, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { googleMapsUrl, positionJson, shareQuery } from "@/lib/geo/export";
import { formatDistance, formatHeading, formatPair, formatSpeed, haversine } from "@/lib/geo/math";
import { useFlashGo } from "@/lib/geo/store";

export function Hud() {
  const pick = useFlashGo((s) => s.pick);
  const sim = useFlashGo((s) => s.sim);
  const running = useFlashGo((s) => s.running);
  const paused = useFlashGo((s) => s.paused);
  const routeTotal = useFlashGo((s) => s.routeTotal);
  const routeTraveled = useFlashGo((s) => s.routeTraveled);
  const favorites = useFlashGo((s) => s.favorites);
  const starCurrent = useFlashGo((s) => s.starCurrent);
  const pos = sim ?? pick;
  const speed = sim && running && !paused ? sim.speedKmh : 0;
  const heading = sim?.heading ?? 0;
  const starred = favorites.some((f) => haversine(f, pos) < 25);

  function copy() {
    void navigator.clipboard.writeText(formatPair(pos));
    toast.success("Coordinates copied");
  }

  function copyJson() {
    void navigator.clipboard.writeText(
      positionJson({
        ...pos,
        heading,
        speedKmh: speed,
        accuracy: sim?.accuracy ?? 8,
      }),
    );
    toast.success("GPS JSON copied");
  }

  function copyLink() {
    void navigator.clipboard.writeText(shareQuery(pos, pick.label));
    toast.success("Share link copied");
  }

  const remain = routeTotal > 0 ? Math.max(0, routeTotal - routeTraveled) : 0;

  return (
    <div className="rounded-2xl bg-surface/92 p-3 shadow-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-subtle uppercase">
          <Satellite className="size-3.5" />
          {running ? (paused ? "Paused" : "Live signal") : "Idle pin"}
        </div>
        <div className="flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              const nowOn = starCurrent();
              toast.success(nowOn ? "Saved to favorites" : "Removed from favorites");
            }}
            aria-label={starred ? "Remove favorite" : "Save favorite"}
            title={starred ? "Remove favorite" : "Save favorite"}
          >
            <Star className={`size-3.5 ${starred ? "fill-current text-live" : ""}`} />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy coordinates">
            <Copy className="size-3.5" />
          </Button>
          <a
            href={googleMapsUrl(pos)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-8 items-center justify-center rounded-md text-fg hover:bg-surface-2"
            aria-label="Open in Google Maps"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
      <p className="mt-1 font-mono text-sm tracking-tight text-fg tabular-nums">{formatPair(pos)}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{pick.label}</p>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Navigation className="size-3" style={{ transform: `rotate(${heading}deg)` }} />
          {formatHeading(heading)}
        </span>
        <span className="font-mono tabular-nums">{formatSpeed(speed)}</span>
      </div>
      {routeTotal > 0 && running ? (
        <p className="mt-1 font-mono text-[11px] text-subtle tabular-nums">
          {formatDistance(routeTraveled)} / {formatDistance(routeTotal)}
          {remain > 0 ? ` · ${formatDistance(remain)} left` : ""}
        </p>
      ) : null}
      <div className="mt-2 hidden gap-2 sm:flex">
        <button type="button" className="text-[11px] text-muted hover:text-fg" onClick={copyJson}>
          Copy GPS JSON
        </button>
        <button type="button" className="text-[11px] text-muted hover:text-fg" onClick={copyLink}>
          Copy link
        </button>
      </div>
    </div>
  );
}
