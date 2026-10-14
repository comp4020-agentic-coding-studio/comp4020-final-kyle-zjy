// Scenario 04's floating cues. What a viewer may learn from a cue is what the
// public log already says: another player's use of a lot is "X used <lot>",
// never whether it was genuine (the counterfeit verdict is a private Card).
import type { PlayerView } from "../../../shared/game/state.ts";
import type { LotId04 } from "../../../shared/game/scenario04/types.ts";
import { auctionLotText } from "../../../shared/i18n/scenario04.ts";
import type { Locale } from "../../../shared/i18n/types.ts";
import type { TFunction } from "../../i18n/index.ts";
import type { Cue } from "../../store.ts";

export function describeCue04(c: Cue, g: PlayerView, t: TFunction, locale: Locale): { icon: string; text: string; tone: string } | null {
  const p = c.payload;
  const who = (id: unknown) => (typeof id === "string" ? g.players[id]?.nickname ?? t("common.Someone") : t("common.Someone"));
  switch (c.kind) {
    case "S4_ITEM_USED":
      return { icon: "USE_LOT", text: t("s4.cue.itemUsed", { name: who(p.playerId), item: auctionLotText(locale, p.lotId as LotId04).name }), tone: "text-gold border-gold/40" };
    case "S4_CHALLENGE_END":
      return typeof p.winnerId === "string"
        ? { icon: "CHALLENGE", text: t("s4.cue.challengeEnd", { name: who(p.winnerId), pot: Number(p.pot) }), tone: "text-gold-bright border-gold/60" }
        : { icon: "CHALLENGE", text: t("s4.cue.challengePush"), tone: "text-mist border-ash/50" };
    default:
      return null;
  }
}
