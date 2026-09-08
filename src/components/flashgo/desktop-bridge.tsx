import { useEffect } from "react";
import { useFlashGo } from "@/lib/geo/store";

/** Pushes the live pin to the TST Go browser extension so other tabs can spoof GPS. */
export function DesktopBridge() {
  useEffect(() => {
    let last = 0;
    const send = () => {
      const now = Date.now();
      if (now - last < 250) return;
      last = now;
      const s = useFlashGo.getState();
      const p = s.sim ?? s.pick;
      window.postMessage(
        {
          source: "tst-go",
          type: "TST_GO_FIX",
          lat: p.lat,
          lng: p.lng,
          heading: s.sim?.heading ?? 0,
          speed: s.sim ? s.sim.speedKmh / 3.6 : 0,
          label: s.pick.label,
        },
        "*",
      );
    };
    send();
    const unsub = useFlashGo.subscribe(send);
    const timer = window.setInterval(send, 1000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
