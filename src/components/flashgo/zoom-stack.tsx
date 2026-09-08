import { LocateFixed, Minus, Plus, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlashGo } from "@/lib/geo/store";
import { cn } from "@/lib/utils";

export function ZoomStack() {
  const issueMapCmd = useFlashGo((s) => s.issueMapCmd);
  const follow = useFlashGo((s) => s.follow);
  const setFollow = useFlashGo((s) => s.setFollow);
  const mapStyle = useFlashGo((s) => s.mapStyle);
  const setMapStyle = useFlashGo((s) => s.setMapStyle);
  const running = useFlashGo((s) => s.running);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="rounded-2xl bg-surface/92"
        onClick={() => issueMapCmd("zoomIn")}
        aria-label="Zoom in"
      >
        <Plus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="rounded-2xl bg-surface/92"
        onClick={() => issueMapCmd("zoomOut")}
        aria-label="Zoom out"
      >
        <Minus className="size-4" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn("rounded-2xl bg-surface/92", follow && running && "text-live")}
        onClick={() => {
          setFollow(true);
          issueMapCmd("recenter");
        }}
        aria-label="Recenter on pin"
      >
        <LocateFixed className="size-4" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn("rounded-2xl bg-surface/92", mapStyle === "satellite" && "text-live")}
        onClick={() => setMapStyle(mapStyle === "streets" ? "satellite" : "streets")}
        aria-label={mapStyle === "streets" ? "Switch to satellite" : "Switch to streets"}
        title={mapStyle === "streets" ? "Satellite" : "Streets"}
      >
        <Satellite className="size-4" />
      </Button>
    </div>
  );
}
