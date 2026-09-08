import { useCallback, useRef } from "react";
import { useFlashGo } from "@/lib/geo/store";
import { cn } from "@/lib/utils";

export function Joystick() {
  const setJoystick = useFlashGo((s) => s.setJoystick);
  const running = useFlashGo((s) => s.running);
  const pad = useRef<HTMLDivElement>(null);
  const active = useRef(false);

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const el = pad.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const max = r.width / 2 - 8;
      const mag = Math.hypot(dx, dy);
      const scale = mag > max ? max / mag : 1;
      const x = (dx * scale) / max;
      const y = (-dy * scale) / max;
      const knob = el.querySelector("[data-knob]") as HTMLElement | null;
      if (knob) {
        knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
      }
      setJoystick(x, y);
    },
    [setJoystick],
  );

  const end = useCallback(() => {
    active.current = false;
    const el = pad.current;
    const knob = el?.querySelector("[data-knob]") as HTMLElement | null;
    if (knob) knob.style.transform = "translate(0px, 0px)";
    setJoystick(0, 0);
  }, [setJoystick]);

  if (!running) {
    return (
      <p className="hidden max-w-28 text-[11px] leading-snug text-subtle sm:block">
        WASD to walk after Go. Space starts or pauses.
      </p>
    );
  }

  return (
    <div
      ref={pad}
      className={cn(
        "relative size-24 shrink-0 touch-none rounded-full bg-surface/80 shadow-border sm:size-[120px]",
        "select-none",
      )}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = true;
        apply(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!active.current) return;
        apply(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      role="application"
      aria-label="Move simulated location"
    >
      <div className="pointer-events-none absolute inset-3 rounded-full border border-border" />
      <div
        data-knob
        className="pointer-events-none absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-border sm:size-11"
      />
    </div>
  );
}
