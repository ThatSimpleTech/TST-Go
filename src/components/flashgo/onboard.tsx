import { useEffect, useState } from "react";
import { Keyboard, MapPinned, Route, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";
import { useFlashGo } from "@/lib/geo/store";
import { BrandMark } from "./brand-mark";
import { InstallCta } from "./install-app";

const STEPS = [
  {
    icon: MapPinned,
    title: "Pick a place",
    body: "Search the world, drag the map, or drop a pin. The crosshair is your current target.",
  },
  {
    icon: Zap,
    title: "Hit Go",
    body: "Jump teleports instantly. Your simulated GPS locks to that coordinate so you can copy it.",
  },
  {
    icon: Route,
    title: "Move for real",
    body: "Walk, cycle, or drive along a plotted route — or nudge with the joystick — at real-world speed.",
  },
  {
    icon: Keyboard,
    title: "Computer or phone",
    body: `Install ${APP_NAME} to the home screen or desktop. Then WASD to walk, or use the joystick on a phone.`,
  },
];

export function Onboard() {
  const [hydrated, setHydrated] = useState(false);
  const onboarded = useFlashGo((s) => s.onboarded);
  const dismissOnboard = useFlashGo((s) => s.dismissOnboard);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated || onboarded) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-bg/55 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-[28px] bg-surface p-5 shadow-border sm:p-6">
        <div className="flex items-center gap-2">
          <BrandMark className="h-6 w-auto text-fg" />
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">{APP_NAME}</p>
        </div>
        <h1 className="font-display mt-1 text-2xl font-medium tracking-tight text-balance">
          Go anywhere from a computer or phone
        </h1>
        <p className="mt-2 text-sm text-pretty text-muted">
          A location simulator you can install like an app. Search, teleport, and travel routes — then
          copy live coordinates for testing.
        </p>
        <ol className="mt-5 space-y-3">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className="block text-sm text-muted">{step.body}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs text-subtle">
          A browser cannot inject GPS into other native apps. {APP_NAME} simulates location inside this
          page and gives you live coordinates, maps links, and GPX to copy out.
        </p>
        <Button type="button" className="mt-5 h-12 w-full rounded-2xl" onClick={dismissOnboard}>
          Start exploring
        </Button>
        <InstallCta className="mt-2 h-12 w-full rounded-2xl" />
      </div>
    </div>
  );
}
