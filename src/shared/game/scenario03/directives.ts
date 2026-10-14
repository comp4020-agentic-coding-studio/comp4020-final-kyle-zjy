// Scenario 03's private Administration directives (judged in engine/scenario03/directives.ts).
export const DIRECTIVES03 = ["STABILITY", "HUMANE", "PURGE", "ARCHIVIST", "TRUTH"] as const;
export type Directive03 = (typeof DIRECTIVES03)[number];
