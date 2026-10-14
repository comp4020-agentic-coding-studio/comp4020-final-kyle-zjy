import type { Tie02 } from "../../../shared/game/state.ts";
import type { Scenario02Text } from "../../../shared/i18n/scenario02.ts";
import type { TFunction } from "../../i18n/index.ts";

/** A tie in words, for the secrets card and the results. */
export function tieText(tie: Tie02, t: TFunction, text: Scenario02Text): string {
  switch (tie.kind) {
    case "RESCUE": return t("s2.tie.RESCUE", { name: text.npcs[tie.target!]?.name ?? "?" });
    case "ABOARD": return t("s2.tie.ABOARD");
    case "RESTORE": return t("s2.tie.RESTORE", { job: t(`s2.facility.${tie.target!}` as never) });
  }
}
