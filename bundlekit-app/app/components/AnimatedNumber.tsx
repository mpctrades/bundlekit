import { useEffect, useState } from "react";
import { animate } from "motion/react";

export interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
}

/** Counts up from 0 to `value` on mount/change. Pure display — the number
 *  itself always comes from the loader, never fabricated client-side. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)) }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value]);

  return <span>{format(display)}</span>;
}
