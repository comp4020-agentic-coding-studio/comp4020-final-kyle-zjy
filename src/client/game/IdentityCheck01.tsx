// Scenario 01's ticket check, as the Inspector means it: not "do you have a
// ticket" but "does the world still recognise you". A passenger file heads the
// ticket-check roll itself (inside the dice card, so it never covers the die or
// the Fate choice): the name, one record the whole table can already see, and
// a stamp that stays at CHECKING until the server's roll resolves.
//
// Every line comes from facts already public in this client's PlayerView:
// the passenger's name, their carriage, lost/away, key items (shown on the
// train for everyone) and anchors they last repaired. No private message,
// truth, obsession or ordinary inventory is ever read here.
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { isKeyItem } from "../../shared/game/scenario01/content.ts";
import type { AnchorId, PlayerView, PublicPlayerState, Roll } from "../../shared/game/state.ts";
import { audio } from "../audio/manager.ts";
import { useItemText, useScenarioText, useT } from "../i18n/index.ts";

/** One public record about this passenger, most telling first. Exported for the privacy test. */
export function identityRecord01(g: PlayerView, p: PublicPlayerState): { kind: "ANCHOR"; anchor: AnchorId } | { kind: "KEY"; item: string } | { kind: "PLACE"; carriage: number } {
  const anchor = (Object.values(g.anchors).find((a) => a.repaired && a.lastRepairedBy === p.playerId))?.id;
  if (anchor) return { kind: "ANCHOR", anchor };
  const key = p.items.find((item) => isKeyItem(item));
  if (key) return { kind: "KEY", item: key };
  return { kind: "PLACE", carriage: p.carriageIndex };
}

/** The passenger file at the head of a ticket-check roll. */
export function IdentityStrip01({ g, roll }: { g: PlayerView; roll: Roll }) {
  const t = useT();
  const text = useScenarioText();
  const items = useItemText();
  const reduce = useReducedMotion();
  const punched = useRef<string | null>(null);
  useEffect(() => {
    if (punched.current === roll.id) return;
    punched.current = roll.id;
    audio.play("ticket_punch");
  }, [roll.id]);
  const p = g.players[roll.playerId];
  if (!p) return null;
  const record = identityRecord01(g, p);
  const line =
    record.kind === "ANCHOR" ? t("identity.anchor", { anchor: text.anchors[record.anchor] })
      : record.kind === "KEY" ? t("identity.key", { key: items(record.item as Parameters<typeof items>[0]).name })
        : t("identity.place", { carriage: text.carriages[g.carriages[record.carriage]?.identity ?? "START"].name });
  const status = p.lost ? "identity.status.lost" : p.away ? "identity.status.away" : "identity.status.listed";
  // the stamp is the server's verdict on this roll, not a guess: neutral until it is done
  const verdict = !roll.done ? "pending" : roll.tier === "SUCCESS" || roll.tier === "PERFECT" ? "ok" : "fail";
  return (
    <div className="identity-file relative mb-3 overflow-hidden rounded-md border border-[#d9e3d0]/40 bg-[#e9eee2] px-3 py-2 text-left text-[#151a14]" aria-label={t("identity.aria", { name: p.nickname })}>
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[repeating-linear-gradient(180deg,#151a14_0_4px,transparent_4px_8px)] opacity-30" aria-hidden="true" />
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#5b6b55] uppercase">{t("identity.kicker")}</p>
          <div className="relative overflow-hidden">
            <p className="identity-name break-words font-display text-xl leading-tight font-semibold uppercase">{p.nickname}</p>
            {!reduce && <motion.span className="pointer-events-none absolute inset-x-0 h-0.5 bg-[#5ce1e6]/70" initial={{ top: "0%" }} animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 0.7 }} aria-hidden="true" />}
          </div>
        </div>
        <motion.p
          key={verdict}
          className={`mt-1 shrink-0 -rotate-3 rounded border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.15em] ${verdict === "fail" ? "border-[#b23a2a] text-[#b23a2a]" : verdict === "ok" ? "border-[#2f6b45] text-[#2f6b45]" : "border-[#5b6b55] text-[#5b6b55]"}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {t(verdict === "fail" ? "identity.wavering" : verdict === "ok" ? "identity.verified" : "identity.checking")}
        </motion.p>
      </div>
      <p className="mt-1 text-xs break-words"><span className="font-mono text-[10px] tracking-wider text-[#5b6b55] uppercase">{t("identity.recordLabel")} </span>{line}</p>
      <p className="text-xs break-words"><span className="font-mono text-[10px] tracking-wider text-[#5b6b55] uppercase">{t("identity.statusLabel")} </span>{t(status)}</p>
    </div>
  );
}
