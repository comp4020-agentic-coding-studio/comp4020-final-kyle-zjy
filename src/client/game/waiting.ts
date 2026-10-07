// Who the table is waiting for in a scene: nothing has a time limit, so the
// screen says whose Continue is still missing instead of counting down.
import type { PlayerView } from "../../shared/game/state.ts";
import type { TFunction } from "../i18n/index.ts";

export function notYet(g: PlayerView, t: TFunction): string {
  const acks = g.sequence?.acks ?? [];
  const names = g.turnOrder.filter((id) => !acks.includes(id) && !g.players[id]?.away).map((id) => g.players[id].nickname);
  return names.length ? names.join(t("common.listSep")) : t("common.theOthers");
}
