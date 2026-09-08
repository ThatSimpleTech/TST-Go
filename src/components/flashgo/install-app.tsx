import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallSnap = { prompt: PromptEvent | null; installed: boolean };

const listeners = new Set<() => void>();
const snap: InstallSnap = { prompt: null, installed: false };
let booted = false;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function iosInstallUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("install", "1");
  url.searchParams.set("platform", "ios");
  return url.toString();
}

function emit() {
  for (const fn of listeners) fn();
}

function bootInstall() {
  if (booted) return;
  booted = true;
  snap.installed = isStandalone();
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    snap.prompt = e as PromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    snap.installed = true;
    snap.prompt = null;
    emit();
  });
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js");
  }
}

function useInstallSnap() {
  const [, bump] = useState(0);
  useEffect(() => {
    bootInstall();
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return snap;
}

async function tryNativeInstall() {
  const event = snap.prompt;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  snap.prompt = null;
  if (outcome === "accepted") snap.installed = true;
  emit();
  return true;
}

function openInstallFallback(setOpen: (v: boolean) => void) {
  if (isIos()) {
    window.location.assign(iosInstallUrl());
    return;
  }
  setOpen(true);
}

export function InstallAppButton({ className }: { className?: string }) {
  const { installed } = useInstallSnap();
  const [open, setOpen] = useState(false);
  if (installed) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={className ?? "rounded-2xl bg-surface/92"}
        onClick={() => {
          void tryNativeInstall().then((ok) => {
            if (!ok) openInstallFallback(setOpen);
          });
        }}
        aria-label={`Install ${APP_NAME}`}
        title={`Install ${APP_NAME}`}
      >
        <Download className="size-4" />
      </Button>
      {open ? <InstallSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function InstallCta({ className }: { className?: string }) {
  const { installed } = useInstallSnap();
  const [open, setOpen] = useState(false);
  if (installed) return null;
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className={className}
        onClick={() => {
          void tryNativeInstall().then((ok) => {
            if (!ok) openInstallFallback(setOpen);
          });
        }}
      >
        <Download className="size-4" />
        Install {APP_NAME}
      </Button>
      {open ? <InstallSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function InstallSheet({ onClose }: { onClose: () => void }) {
  const { prompt } = useInstallSnap();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/55 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[28px] bg-surface p-5 shadow-border sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-subtle uppercase">{APP_NAME}</p>
            <h2 className="font-display mt-1 text-xl font-medium tracking-tight">Install on this device</h2>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Add {APP_NAME} to your home screen or desktop so it opens full-screen like an app.
        </p>
        <ul className="mt-4 space-y-3">
          <li className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
              <Smartphone className="size-4" />
            </span>
            <span className="text-sm text-muted">
              <span className="block font-medium text-fg">Phone</span>
              Chrome or Edge: use Install below. iPhone: Share, then Add to Home Screen.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
              <Share className="size-4" />
            </span>
            <span className="text-sm text-muted">
              <span className="block font-medium text-fg">Computer</span>
              In Chrome or Edge, open the browser menu and choose Install app.
            </span>
          </li>
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          {prompt ? (
            <Button
              type="button"
              className="h-12 w-full rounded-2xl"
              onClick={() => void tryNativeInstall()}
            >
              Install {APP_NAME}
            </Button>
          ) : (
            <Button
              type="button"
              className="h-12 w-full rounded-2xl"
              onClick={() => {
                if (isIos()) window.location.assign(iosInstallUrl());
                else onClose();
              }}
            >
              {isIos() ? "Show iPhone steps" : "Got it"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
