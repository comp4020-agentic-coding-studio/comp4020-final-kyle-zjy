import { useEffect, useState } from "react";
import { useStore } from "../store.ts";

/** Seconds left until a server timestamp, ticking every 250 ms (only an away player's turn has one). */
export function useCountdown(deadline: number | null | undefined): number | null {
  const skew = useStore((s) => s.skew);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (now + skew)) / 1000));
}
