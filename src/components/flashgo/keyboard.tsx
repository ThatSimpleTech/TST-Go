import { useEffect } from "react";
import { ensurePlottedRoute } from "@/lib/geo/ensure-route";
import { useFlashGo } from "@/lib/geo/store";

function typingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function KeyboardBridge() {
  const setKeys = useFlashGo((s) => s.setKeys);
  const issueMapCmd = useFlashGo((s) => s.issueMapCmd);
  const running = useFlashGo((s) => s.running);
  const paused = useFlashGo((s) => s.paused);
  const start = useFlashGo((s) => s.start);
  const pause = useFlashGo((s) => s.pause);
  const stop = useFlashGo((s) => s.stop);
  const mode = useFlashGo((s) => s.mode);
  const teleportTo = useFlashGo((s) => s.teleportTo);
  const pick = useFlashGo((s) => s.pick);
  const setFollow = useFlashGo((s) => s.setFollow);
  const onboarded = useFlashGo((s) => s.onboarded);

  useEffect(() => {
    const held = new Set<string>();

    const syncStick = () => {
      if (!running || paused) {
        setKeys(0, 0);
        return;
      }
      let x = 0;
      let y = 0;
      if (held.has("KeyA") || held.has("ArrowLeft")) x -= 1;
      if (held.has("KeyD") || held.has("ArrowRight")) x += 1;
      if (held.has("KeyW") || held.has("ArrowUp")) y += 1;
      if (held.has("KeyS") || held.has("ArrowDown")) y -= 1;
      const mag = Math.hypot(x, y);
      if (mag > 0) {
        setKeys(x / mag, y / mag);
      } else {
        setKeys(0, 0);
      }
    };

    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (typingTarget(e.target)) return;
      if (!onboarded) return;
      const code = e.code;

      if (code === "Space") {
        e.preventDefault();
        if (running) {
          pause();
        } else if (mode === "jump") {
          teleportTo(pick, pick.label);
        } else {
          void (async () => {
            if (useFlashGo.getState().waypoints.length >= 2) {
              await ensurePlottedRoute(false);
            }
            start();
          })();
        }
        return;
      }
      if (code === "Escape" && running) {
        stop();
        return;
      }
      if (code === "Equal" || code === "NumpadAdd") {
        issueMapCmd("zoomIn");
        return;
      }
      if (code === "Minus" || code === "NumpadSubtract") {
        issueMapCmd("zoomOut");
        return;
      }
      if (code === "KeyF") {
        setFollow(true);
        issueMapCmd("recenter");
        return;
      }

      if (
        code === "KeyW" ||
        code === "KeyA" ||
        code === "KeyS" ||
        code === "KeyD" ||
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight"
      ) {
        e.preventDefault();
        held.add(code);
        syncStick();
      }
    };

    const onUp = (e: KeyboardEvent) => {
      held.delete(e.code);
      syncStick();
    };

    const clear = () => {
      held.clear();
      setKeys(0, 0);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      setKeys(0, 0);
    };
  }, [
    issueMapCmd,
    mode,
    onboarded,
    pause,
    paused,
    pick,
    running,
    setFollow,
    setKeys,
    start,
    stop,
    teleportTo,
  ]);

  return null;
}
