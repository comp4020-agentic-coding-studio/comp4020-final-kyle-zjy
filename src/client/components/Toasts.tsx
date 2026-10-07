import { AnimatePresence, motion } from "motion/react";
import { useStore } from "../store.ts";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className={`glass max-w-sm rounded-xl px-4 py-3 text-sm ${t.tone === "error" ? "border-ember/60 text-moon" : ""}`}
          >
            {t.tone === "error" && <span className="mr-2 font-bold text-ember">!</span>}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
