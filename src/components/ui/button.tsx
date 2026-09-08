import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[transform,background-color,color,box-shadow,opacity] duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-border hover:bg-primary/90",
        live: "bg-live text-live-foreground shadow-border hover:bg-live/90",
        stop: "bg-stop text-stop-foreground shadow-border hover:bg-stop/90",
        secondary: "bg-surface-2 text-fg shadow-border hover:bg-surface-2/80",
        outline: "bg-transparent text-fg shadow-border hover:bg-surface-2",
        ghost: "text-fg hover:bg-surface-2",
        muted: "text-muted hover:text-fg hover:bg-surface-2",
      },
      size: {
        default: "h-10 rounded-lg px-3.5 text-sm",
        sm: "h-8 rounded-md px-2.5 text-xs",
        lg: "h-12 rounded-xl px-5 text-base",
        icon: "size-10 rounded-lg",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { buttonVariants };
