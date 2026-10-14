// One physical card for every scenario's things: items, clues, memories,
// relics, lots and private intel. The variant picks the material; the content
// is whatever the caller already renders. Private cards carry an "only you"
// stamp so a screenshot can never pass one off as public.
import type { ReactNode } from "react";
import { useT } from "../../i18n/index.ts";
import { Icon } from "../Icon.tsx";

export type CardVariant = "item" | "clue" | "memory" | "relic" | "lot" | "intel";

const MATERIAL: Record<CardVariant, { frame: string; icon: string; tint: string }> = {
  item: { frame: "border-gold/40 bg-[linear-gradient(165deg,#161d40,#0b1029)]", icon: "USE_ITEM", tint: "text-gold" },
  clue: { frame: "border-signal/40 bg-[linear-gradient(165deg,#0f2230,#08131d)]", icon: "INVESTIGATE", tint: "text-signal" },
  memory: { frame: "border-violet/50 bg-[linear-gradient(165deg,#1d1640,#0d0a24)]", icon: "FRAGMENT", tint: "text-violet-soft" },
  relic: { frame: "border-gold-bright/50 bg-[linear-gradient(165deg,#2a2112,#130e07)]", icon: "KEY", tint: "text-gold-bright" },
  lot: { frame: "border-gold/50 bg-[linear-gradient(165deg,#241812,#100a07)]", icon: "ANCHOR", tint: "text-gold-bright" },
  intel: { frame: "border-violet/50 bg-[linear-gradient(165deg,#1a1033,#0a0618)]", icon: "SECRET", tint: "text-violet-soft" },
};

export function Card({ variant, title, kicker, meta, icon, private: own = false, dim = false, children }: {
  variant: CardVariant;
  title: ReactNode;
  kicker?: ReactNode;
  meta?: ReactNode;
  icon?: string;
  private?: boolean;
  dim?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const look = MATERIAL[variant];
  return (
    <article className={`relative min-w-0 overflow-hidden rounded-xl border p-3 shadow-[var(--shadow-card)] ${look.frame} ${dim ? "opacity-60" : ""}`}>
      <span className="pointer-events-none absolute inset-1 rounded-lg border border-white/5" aria-hidden="true" />
      <div className="flex min-w-0 items-start gap-2">
        <Icon name={icon ?? look.icon} size={18} className={`mt-0.5 shrink-0 ${look.tint}`} />
        <div className="min-w-0 flex-1">
          {kicker && <p className={`label truncate text-[10px] ${look.tint}`}>{kicker}</p>}
          <p className="font-display text-base leading-snug text-moon">{title}</p>
        </div>
        {own && <span className="shrink-0 -rotate-6 rounded border border-ember/60 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-ember uppercase">{t("card.onlyYou")}</span>}
      </div>
      {children && <div className="mt-1.5 text-sm text-mist">{children}</div>}
      {meta && <p className="mt-1.5 font-mono text-[10px] text-ash">{meta}</p>}
    </article>
  );
}
