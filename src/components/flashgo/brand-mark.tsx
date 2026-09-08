import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <img
        src="/lock.png"
        alt=""
        className="h-full w-auto [image-rendering:pixelated]"
        draggable={false}
      />
      <svg viewBox="0 0 32 32" className="h-full w-auto" aria-hidden focusable="false">
        <path
          className="fill-accent"
          d="M16 2.6c-4.7 0-8.5 3.8-8.5 8.4 0 6.8 8.5 18.4 8.5 18.4s8.5-11.6 8.5-18.4c0-4.6-3.8-8.4-8.5-8.4z"
        />
        <circle cx="16" cy="10.9" r="4.6" className="fill-bg" />
        <circle cx="16" cy="10.9" r="2.8" className="fill-live" />
      </svg>
    </span>
  );
}
