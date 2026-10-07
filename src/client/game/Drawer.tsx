// A side drawer (right on desktop, bottom sheet on phones) for the log,
// secrets and passenger cards: layer four, never in the centre of play.
import { motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon.tsx";

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass safe-bottom relative flex max-h-[80dvh] bg-night w-full flex-col rounded-t-2xl sm:max-h-none sm:w-[400px] sm:rounded-none sm:rounded-l-2xl"
        initial={{ y: 40, x: 0, opacity: 0 }}
        animate={{ y: 0, x: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
      >
        <header className="flex items-center justify-between border-b border-gold/15 px-4 py-3">
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <button className="flex h-12 w-12 items-center justify-center rounded-full text-mist hover:text-moon" onClick={onClose} aria-label="Close">
            <Icon name="CLOSE" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </motion.aside>
    </motion.div>
  );
}
