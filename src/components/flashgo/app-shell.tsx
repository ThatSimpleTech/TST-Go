import { useEffect, useState, type ComponentType } from "react";
import { Bookmark, LocateFixed, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";
import { parseCoords } from "@/lib/geo/math";
import { useFlashGo } from "@/lib/geo/store";
import { BrandMark } from "./brand-mark";
import { ControlDock } from "./control-dock";
import { Hud } from "./hud";
import { Joystick } from "./joystick";
import { KeyboardBridge } from "./keyboard";
import { InstallAppButton } from "./install-app";
import { Onboard } from "./onboard";
import { PlacesPanel } from "./places-panel";
import { SearchBar } from "./search-bar";
import { ZoomStack } from "./zoom-stack";

export function AppShell() {
  const [MapView, setMapView] = useState<ComponentType | null>(null);
  const [panel, setPanel] = useState(false);
  const setPick = useFlashGo((s) => s.setPick);
  const setFlyTo = useFlashGo((s) => s.setFlyTo);
  const setLabel = useFlashGo((s) => s.setLabel);
  const tick = useFlashGo((s) => s.tick);
  const running = useFlashGo((s) => s.running);
  const remember = useFlashGo((s) => s.remember);

  useEffect(() => {
    let alive = true;
    void import("./map-view").then((m) => {
      if (alive) setMapView(() => m.MapView);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      tick(now - last);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tick]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const parsed = parseCoords(`${sp.get("lat") ?? ""}, ${sp.get("lng") ?? ""}`);
    if (!parsed) return;
    const name = sp.get("name")?.trim() || "Shared pin";
    const zoom = Number(sp.get("zoom"));
    setPick(parsed, name);
    setLabel(name);
    setFlyTo({ ...parsed, zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 15 });
    remember(parsed, name);
  }, [remember, setFlyTo, setLabel, setPick]);

  function locateMe() {
    if (!navigator.geolocation) {
      toast.message("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPick(p, "My real location");
        setLabel("My real location");
        setFlyTo({ ...p, zoom: 15 });
        toast.success("Centered on your real location");
      },
      () => toast.message("Location permission was denied."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-bg text-fg">
      <KeyboardBridge />
      {MapView ? <MapView /> : <div className="absolute inset-0 bg-bg" aria-hidden />}

      {!running ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-[calc(50%+10px)]">
          <div className="fg-crosshair" />
        </div>
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="pointer-events-auto flex items-center rounded-2xl bg-surface/92 px-3 py-2 shadow-border">
              <span className="font-display text-sm font-medium tracking-tight">{APP_NAME}</span>
            </div>
            <div className="pointer-events-auto hidden min-w-0 flex-1 sm:block">
              <SearchBar />
            </div>
            <div className="pointer-events-auto ml-auto flex gap-2">
              <InstallAppButton />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="rounded-2xl bg-surface/92"
                onClick={locateMe}
                aria-label="Use my real location"
              >
                <LocateFixed className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="rounded-2xl bg-surface/92"
                onClick={() => setPanel(true)}
                aria-label="Open places and route"
              >
                <Bookmark className="size-4" />
              </Button>
              <div
                className="flex h-10 items-center rounded-2xl bg-surface/92 px-2 shadow-border sm:hidden"
                role="img"
                aria-label={`${APP_NAME} logo`}
              >
                <BrandMark className="h-7 w-auto text-fg" />
              </div>
            </div>
          </div>
          <div className="pointer-events-auto sm:hidden">
            <SearchBar />
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute top-[max(12px,env(safe-area-inset-top))] right-3 z-30 hidden sm:block sm:right-4">
        <div
          className="flex h-11 items-center rounded-2xl bg-surface/92 px-2.5 shadow-border"
          role="img"
          aria-label={`${APP_NAME} logo`}
        >
          <BrandMark className="h-8 w-auto text-fg" />
        </div>
      </div>

      <aside className="pointer-events-none absolute top-[max(108px,calc(env(safe-area-inset-top)+96px))] right-3 z-30 w-[min(100%-24px,268px)] sm:top-[max(92px,calc(env(safe-area-inset-top)+80px))] sm:right-4">
        <div className="pointer-events-auto">
          <Hud />
        </div>
      </aside>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-3 pb-[max(16px,env(safe-area-inset-bottom))] sm:p-5">
        <div className="mx-auto grid max-w-3xl grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="pointer-events-auto justify-self-start">
            <Joystick />
          </div>
          <div className="pointer-events-auto">
            <ControlDock />
          </div>
          <div className="pointer-events-auto justify-self-end">
            <ZoomStack />
          </div>
        </div>
      </div>

      {panel ? (
        <div
          className="absolute inset-0 z-40 flex justify-end bg-bg/50"
          onClick={() => setPanel(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-surface shadow-border sm:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pr-3">
              <span className="font-display text-sm font-medium">Places & route</span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPanel(false)} aria-label="Close">
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
              <PlacesPanel onClose={() => setPanel(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <Onboard />
    </div>
  );
}
