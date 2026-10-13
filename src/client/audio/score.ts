import type { PlayerView } from "../../shared/game/state.ts";
import type { AudioTheme } from "./catalog.ts";

/** Only projected public stages and the viewer's visible era select music. */
export function gameplayScore(g: PlayerView): AudioTheme {
  if (g.phase === "LOBBY") return "silence";
  if (g.phase === "ENDING" || g.phase === "RESULTS") {
    if (g.outcome === "FAILED" || g.outcome === "S03_NO_TOMORROW" || g.outcome === "S04_UNSOLD") return "failure";
    if (g.outcome === "S04_DEBT") return "s04_reveal";
    return g.scenarioId === "S01_LAST_TRAIN" ? "s01_ending" : g.scenarioId === "S02_SUNKEN_CITY" ? "s02_ending" : g.scenarioId === "S03_INCIDENT_ZERO" ? "s03_ending" : "s04_ending";
  }
  switch (g.scenarioId) {
    case "S01_LAST_TRAIN":
      if (g.sequence?.kind === "FOLD" || g.sequence?.kind === "CAB_OPEN" || g.phase === "ACT_3") return "s01_escape";
      if (g.sequence?.kind === "BLACKOUT" || g.phase === "ACT_2") return "s01_anomaly";
      return "s01_ambient";
    case "S02_SUNKEN_CITY":
      if (g.phase === "ACT_3" || g.city?.boat.readyRound != null) return "s02_evacuation";
      return g.phase === "ACT_2" ? "s02_rising" : "s02_city_ambient";
    case "S03_INCIDENT_ZERO": {
      const past = g.temporal?.locations[g.viewerId]?.year === "Y1996";
      if (g.phase === "ACT_4") return "s03_resolution";
      if (g.phase === "ACT_3" || g.sequence?.kind === "S3_THIRD_ROUTE") return "s03_rewrite";
      if (g.phase === "ACT_2" || g.sequence?.kind === "S3_IDENTITY") return past ? "s03_past_paradox" : "s03_paradox";
      return past ? "scenario03_1996_ambient" : "scenario03_2026_ambient";
    }
    case "S04_UNDERGROUND_AUCTION": {
      const final = g.auction?.final;
      if (final?.stage === "SETTLEMENT") return "s04_settlement";
      if (final?.stage === "AUCTION" || final?.stage === "SHOWDOWN_PICK") return "s04_sealed";
      if (final) return "s04_reveal";
      if (g.auction?.challenge || g.round >= 7) return "s04_highstakes";
      return g.round >= 4 ? "s04_bargains" : "s04_auction_ambient";
    }
  }
}
