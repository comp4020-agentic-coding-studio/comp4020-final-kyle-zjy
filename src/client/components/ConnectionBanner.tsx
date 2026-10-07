// One notice for every screen in a room while the socket is down. The server
// keeps the seat; this only says what's happening and that it's being handled.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useStore } from "../store.ts";

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function ConnectionBanner() {
  const status = useStore((s) => s.status);
  const online = useOnline();
  const show = status === "reconnecting" || !online;
  return (
    <AnimatePresence>
      {show && (
        <motion.p
          key="banner"
          className="fixed inset-x-0 top-0 z-[70] bg-ember/90 px-4 pt-[max(4px,env(safe-area-inset-top))] pb-1 text-center text-xs font-semibold text-white"
          role="status"
          initial={{ y: -24 }}
          animate={{ y: 0 }}
          exit={{ y: -24 }}
        >
          {online ? "Signal lost. Reconnecting… your seat is kept." : "Offline. You'll rejoin when it's back."}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
