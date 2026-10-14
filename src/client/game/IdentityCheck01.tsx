// Scenario 01's ticket check, as the Inspector means it: not "do you have a
// ticket" but "does the world still recognise you". When a ticket-check roll
// starts, a passenger file slides over the dice for about a second: the name,
// one record the whole table can already see, and a stamp that stays at
// CHECKING until the server's roll resolves (VERIFIED or WAVERING).
//
// Every line comes from facts already public in this client's PlayerView:
// the passenger's name, their carriage, lost/away, key items (shown on the
// train for everyone) and anchors they last repaired. No private message,
// truth, obsession or ordinary inventory is ever read here.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { isKeyItem } from "../../shared/game/scenario01/content.ts";
import type { AnchorId, PlayerView, PublicPlayerState } from "../../shared/game/state.ts";
import { audio } from "../audio/manager.ts";
import { useItemText, useScenarioText, useT } from "../i18n/index.ts";

const SHOW_MS = 1400;

/** One public record about this passenger, most telling first. Exported for the privacy test. */
export function identityRecord01(g: PlayerView, p: PublicPlayerState): { kind: "ANCHOR"; anchor: AnchorId } | { kind: "KEY"; item: string } | { kind: "PLACE"; carriage: number } {
  const anchor = (Object.values(g.anchors).find((a) => a.repaired && a.lastRepairedBy === p.playerId))?.id;
  if (anchor) return { kind: "ANCHOR", anchor };
  const key = p.items.find((item) => isKeyItem(item));
  if (key) return { kind: "KEY", item: key };
  return { kind: "PLACE", carriage: p.carriageIndex };
}

export function IdentityCheck01({ g }: { g: PlayerView }) {
  const t = useT();
  const text = useScenarioText();
  const items = useItemText();
  const reduce = useReducedMotion();
  const roll = g.roll;
  const checking = roll?.purpose === "TICKET_CHECK" ? roll : null;
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!checking || shown === checking.id) return;
    setShown(checking.id);
    audio.play("ticket_punch");
  }, [checking, shown]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (shown) setOpen(shown); }, [shown]);
  // close a beat after the server's verdict lands (it may wait on a Fate decision); a tap closes it sooner
  const done = !!checking?.done;
  useEffect(() => {
    if (!open || !done) return;
    const timer = setTimeout(() => setOpen(null), reduce ? 700 : SHOW_MS);
    return () => clearTimeout(timer);
  }, [open, done, reduce]);
  const p = checking ? g.players[checking.playerId] : null;
  if (!p || !checking) return <AnimatePresence />;
  const record = identityRecord01(g, p);
  const line =
    record.kind === "ANCHOR" ? t("identity.anchor", { anchor: text.anchors[record.anchor] })
      : record.kind === "KEY" ? t("identity.key", { key: items(record.item as Parameters<typeof items>[0]).name })
        : t("identity.place", { carriage: text.carriages[g.carriages[record.carriage]?.identity ?? "START"].name });
  const status = p.lost ? "identity.status.lost" : p.away ? "identity.status.away" : "identity.status.listed";
  // the stamp is the server's verdict on this roll, not a guess: neutral until it is done
  const verdict = !checking.done ? "pending" : checking.tier === "SUCCESS" || checking.tier === "PERFECT" ? "ok" : "fail";
  return (
    <AnimatePresence>
      {open === checking.id && (
        <motion.button
          key={checking.id}
          type="button"
          onClick={() => setOpen(null)}
          aria-label={t("identity.aria", { name: p.nickname })}
          className="identity-file fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12vh)] z-[45] mx-auto block max-w-sm rounded-lg border border-[#d9e3d0]/40 bg-[#e9eee2] px-4 py-3 text-left text-[#151a14] shadow-[0_0_40px_rgb(217_227_208/0.25)]"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, rotate: -1.5 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.25 }}
        >
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 rounded-l-lg bg-[repeating-linear-gradient(180deg,#151a14_0_4px,transparent_4px_8px)] opacity-30" aria-hidden="true" />
          <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#5b6b55] uppercase">{t("identity.kicker")}</p>
          <div className="relative mt-1 overflow-hidden">
            <p className="identity-name break-words font-display text-2xl leading-tight font-semibold uppercase">{p.nickname}</p>
            {!reduce && <motion.span className="pointer-events-none absolute inset-x-0 h-0.5 bg-[#5ce1e6]/70" initial={{ top: "0%" }} animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 0.7 }} aria-hidden="true" />}
          </div>
          <motion.p className="mt-1.5 text-sm break-words" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.45 }}>
            <span className="font-mono text-[10px] tracking-wider text-[#5b6b55] uppercase">{t("identity.recordLabel")} </span>{line}
          </motion.p>
          <motion.p className="mt-0.5 text-sm break-words" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.6 }}>
            <span className="font-mono text-[10px] tracking-wider text-[#5b6b55] uppercase">{t("identity.statusLabel")} </span>{t(status)}
          </motion.p>
          <motion.p
            key={verdict}
            className={`mt-2 inline-block -rotate-3 rounded border-2 px-2 py-0.5 font-mono text-xs font-bold tracking-[0.2em] ${verdict === "fail" ? "border-[#b23a2a] text-[#b23a2a]" : verdict === "ok" ? "border-[#2f6b45] text-[#2f6b45]" : "border-[#5b6b55] text-[#5b6b55]"}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduce ? 0 : 0.85, duration: 0.2 }}
          >
            {t(verdict === "fail" ? "identity.wavering" : verdict === "ok" ? "identity.verified" : "identity.checking")}
          </motion.p>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
