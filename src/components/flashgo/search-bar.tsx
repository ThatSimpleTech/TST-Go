import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search, Shuffle, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPlaces, type PlaceHit } from "@/lib/geo/geocode";
import { parseCoords } from "@/lib/geo/math";
import { PRESETS, randomPreset } from "@/lib/geo/places";
import { useFlashGo } from "@/lib/geo/store";

export function SearchBar() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const teleportTo = useFlashGo((s) => s.teleportTo);
  const setPick = useFlashGo((s) => s.setPick);
  const setFlyTo = useFlashGo((s) => s.setFlyTo);
  const remember = useFlashGo((s) => s.remember);
  const pick = useFlashGo((s) => s.pick);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setError(null);
      return;
    }
    const coords = parseCoords(query);
    if (coords) {
      setHits([
        {
          name: "Pasted coordinates",
          detail: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
          lat: coords.lat,
          lng: coords.lng,
        },
      ]);
      return;
    }
    const t = window.setTimeout(() => {
      setLoading(true);
      void searchPlaces({ data: { q: query } }).then((res) => {
        setLoading(false);
        setHits(res.results);
        setError(res.error ?? (res.results.length ? null : "No places match that search."));
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [q]);

  function pinTo(hit: { name: string; lat: number; lng: number }, jump: boolean) {
    setQ("");
    setOpen(false);
    setHits([]);
    if (jump) {
      teleportTo(hit, hit.name);
      toast.success(`Teleported to ${hit.name}`);
    } else {
      setPick(hit, hit.name);
      setFlyTo({ lat: hit.lat, lng: hit.lng, zoom: 15 });
      remember(hit, hit.name);
      toast.message(`Pinned ${hit.name} — hit Go to lock the signal`);
    }
  }

  function surprise() {
    const p = randomPreset(pick.label);
    teleportTo(p, p.name);
    toast.success(`Surprise: ${p.name}`);
  }

  const showPresets = open && q.trim().length < 2;

  return (
    <div ref={box} className="relative w-full">
      <div className="flex items-center gap-2 rounded-2xl bg-surface/92 p-1.5 shadow-border">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) {
                e.preventDefault();
                pinTo(hits[0], e.shiftKey);
              }
            }}
            placeholder="Search a city, address, or lat, lng"
            className="h-11 rounded-xl border-0 bg-transparent pl-9 shadow-none"
            aria-label="Search location"
          />
          {q ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-subtle hover:text-fg"
              onClick={() => setQ("")}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="rounded-xl"
          onClick={surprise}
          aria-label="Teleport to a random landmark"
          title="Surprise destination"
        >
          <Shuffle className="size-4" />
        </Button>
      </div>

      {open ? (
        <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-40 max-h-[min(70vh,420px)] overflow-y-auto rounded-2xl bg-surface p-1.5 shadow-border">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
              <LoaderCircle className="size-4 animate-spin" />
              Searching the map
            </div>
          ) : null}
          {!loading && hits.length > 0
            ? hits.map((hit) => (
                <div
                  key={`${hit.lat}-${hit.lng}-${hit.name}`}
                  className="flex items-center gap-1 rounded-xl hover:bg-surface-2"
                >
                  <button
                    type="button"
                    onClick={() => pinTo(hit, false)}
                    className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{hit.name}</span>
                      {hit.detail ? (
                        <span className="block truncate text-xs text-muted">{hit.detail}</span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mr-1 rounded-lg p-2 text-muted hover:text-fg"
                    onClick={() => pinTo(hit, true)}
                    aria-label={`Teleport to ${hit.name}`}
                    title="Jump now"
                  >
                    <Zap className="size-4" />
                  </button>
                </div>
              ))
            : null}
          {!loading && error && hits.length === 0 && q.trim().length >= 2 ? (
            <p className="px-3 py-3 text-sm text-muted">{error}</p>
          ) : null}
          {showPresets ? (
            <div className="p-1.5">
              <p className="px-2 pb-2 text-xs font-medium tracking-wide text-subtle uppercase">
                Landmarks
              </p>
              <div className="grid grid-cols-2 gap-1">
                {PRESETS.slice(0, 8).map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => pinTo(p, false)}
                    className="rounded-xl px-2.5 py-2 text-left hover:bg-surface-2"
                  >
                    <span className="block truncate text-sm text-fg">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.region}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
