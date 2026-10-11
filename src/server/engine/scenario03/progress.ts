import type { GameState, PublicTemporal03 } from "../../../shared/game/state.ts";

/** Public task completion from existing private evidence, without copying its contents or owner. */
export function teamInvestigations03(s: GameState): PublicTemporal03["teamInvestigations"] {
  const found = new Set(Object.values(s.temporal!.evidence).flat());
  return {
    caseFile: found.has(`CASE_FILE_${s.temporal!.present.caseFile}`),
    accessLedger: found.has("ACCESS_LEDGER"),
    prototypeLog: found.has("PROTOTYPE_LOG"),
    surveillanceTape: found.has("SURVEILLANCE_TAPE"),
    founderDeathEntry: found.has("FOUNDER_DISCREPANCY"),
    casualtyRegister: found.has("STAFF_DISCREPANCY"),
    laterMachineDesigns: found.has("PROTOTYPE_DISCREPANCY"),
    foundingCharter: found.has("FOUNDING_CHARTER"),
  };
}
