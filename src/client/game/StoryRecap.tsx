// The run told back as a short chronicle: one line per story beat the engine
// recorded (engine/chronicle.ts), worded from fixed templates in each locale.
// Shown on every scenario's results screen; the server only sends it once the
// run has ended.
import { motion } from "motion/react";
import type { AnchorId, ChronicleEntry, EscapeLockId, PlayerView } from "../../shared/game/state.ts";
import type { LotId04 } from "../../shared/game/scenario04/types.ts";
import { auctionLotText } from "../../shared/i18n/scenario04.ts";
import { useLocale, useScenario02Text, useScenarioText, useT, type MessageKey } from "../i18n/index.ts";

/** Beats that repeat a lot; only the first of each is told. */
const ONCE = new Set(["INSPECTOR_APPEARS", "INSPECTOR_BANISHED", "FLOOD_STAGE"]);
const LIMIT = 14;

export function StoryRecap({ g }: { g: PlayerView }) {
  const t = useT();
  const locale = useLocale();
  const s01 = useScenarioText();
  const s02 = useScenario02Text();
  const entries = pick(g.chronicle ?? []);
  if (!entries.length) return null;
  const names = (e: ChronicleEntry) => e.actors.map((id) => g.players[id]?.nickname ?? t("common.Someone")).join(t("common.andSep"));
  const line = (e: ChronicleEntry): string | null => {
    const who = names(e);
    const d = e.data;
    switch (e.kind) {
      case "BLACKOUT": case "FOLD": case "CAB_OPEN": case "INSPECTOR_APPEARS": case "INSPECTOR_BANISHED":
      case "BOAT_READY": case "LAUNCH": case "S3_IDENTITY": case "S3_THIRD_ROUTE":
        return t(`recap.${e.kind}` as MessageKey);
      case "ANCHOR_DONE": return t(who ? "recap.ANCHOR_DONE.by" : "recap.ANCHOR_DONE", { name: who, anchor: s01.anchors[String(d.anchor) as AnchorId] });
      case "LOCK": return t("recap.LOCK", { name: who, lock: s01.locks[String(d.lock) as EscapeLockId] });
      case "BRAKE_VOTE": return t(d.winner === "BRAKE" ? "recap.VOTE_RESULT.BRAKE" : "recap.VOTE_RESULT.CONTINUE");
      case "CORE_MEMORY": return t("recap.CORE_MEMORY");
      case "FACILITY": return t("recap.FACILITY", { facility: t(`s2.facility.${String(d.facility)}` as MessageKey) });
      case "PART": return t("recap.PART", { name: who });
      case "RESCUE": return t("recap.RESCUE", { name: who, npc: d.npc ? s02.npcs[String(d.npc) as keyof typeof s02.npcs]?.name ?? "" : "" });
      case "CAPACITY": return t("recap.CAPACITY", { n: Number(d.capacity) });
      case "FLOOD_STAGE": return Number(d.act) >= 2 ? t(`recap.FLOOD_STAGE.${Number(d.act) >= 3 ? 3 : 2}`) : null;
      case "BOARD": return who ? t("recap.BOARD", { name: who }) : null;
      case "TRADE": return e.actors.length === 2 ? t("recap.TRADE", { a: g.players[e.actors[0]]?.nickname ?? "?", b: g.players[e.actors[1]]?.nickname ?? "?" }) : null;
      case "S3_CAUSAL_REWRITE": return t(who ? "recap.S3_CAUSAL_REWRITE.by" : "recap.S3_CAUSAL_REWRITE", { name: who, node: t(`s3.node.${String(d.node)}` as MessageKey) });
      case "S3_LOOP_CLOSED": return t("recap.S3_LOOP_CLOSED", { name: who });
      case "S3_HISTORY_RESOLVED": return t("recap.S3_HISTORY_RESOLVED", { route: t(`s3.route.${String(d.route)}` as MessageKey) });
      case "S4_SOLD": return t("recap.S4_SOLD", { name: who, lot: auctionLotText(locale, String(d.lot) as LotId04).name, n: Number(d.price) });
      case "S4_BORROW": return t("recap.S4_BORROW", { name: who });
      case "S4_CHALLENGE_END": return who ? t("recap.S4_CHALLENGE_END", { name: who, n: Number(d.pot) }) : null;
      case "S4_FINAL_REVEAL": return t(d.tie ? "recap.S4_FINAL_REVEAL.tie" : "recap.S4_FINAL_REVEAL", { name: who });
      case "S4_FINAL_SHOWDOWN_REVEAL": return t("recap.S4_FINAL_SHOWDOWN_REVEAL", { name: who });
      case "LOST": return t("recap.LOST", { name: who });
      default: return null;
    }
  };
  const told = entries.map((e) => ({ e, text: line(e) })).filter((x): x is { e: ChronicleEntry; text: string } => !!x.text).slice(-LIMIT);
  if (!told.length) return null;
  return (
    <section className="tarot min-w-0 p-5 text-left" aria-label={t("recap.title")}>
      <p className="label text-gold">{t("recap.title")}</p>
      <ol className="relative mt-3 grid grid-cols-1 gap-2 border-l border-gold/25 pl-4">
        {told.map(({ e, text }, i) => (
          <motion.li key={i} className="relative min-w-0 text-sm text-moon" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.08 }}>
            <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-gold" aria-hidden="true" />
            <span className="mr-2 font-mono text-[11px] text-gold">{t("recap.round", { n: e.round })}</span>
            {text}
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function pick(all: ChronicleEntry[]): ChronicleEntry[] {
  const seen = new Set<string>();
  return all.filter((e) => {
    if (e.kind === "ENDING") return false;
    if (!ONCE.has(e.kind)) return true;
    if (seen.has(e.kind)) return false;
    seen.add(e.kind);
    return true;
  });
}
