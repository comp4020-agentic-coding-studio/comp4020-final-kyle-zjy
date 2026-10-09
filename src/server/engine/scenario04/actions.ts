import type { ActionSet } from "../scenario.ts";
import { BID04, PASS04 } from "./auction.ts";
import { CHALLENGE04 } from "./blackjack.ts";
import { DEAL04 } from "./deal.ts";
import { BORROW04, EXPOSE04, INVESTIGATE04, READ04, SABOTAGE04 } from "./tactics.ts";
import { USE_SKILL } from "../actions.ts";

export const s04Actions = (): ActionSet => ({
  specs: { BID: BID04, PASS: PASS04, INVESTIGATE: INVESTIGATE04, READ: READ04, DEAL: DEAL04, CHALLENGE: CHALLENGE04, SABOTAGE: SABOTAGE04, BORROW: BORROW04, EXPOSE: EXPOSE04, USE_SKILL },
  turnActions: ["BID", "PASS", "INVESTIGATE", "READ", "DEAL", "CHALLENGE", "SABOTAGE", "BORROW", "EXPOSE", "USE_SKILL"],
  apCost: { BID: 0, PASS: 0, INVESTIGATE: 1, READ: 1, DEAL: 0, CHALLENGE: 1, SABOTAGE: 1, BORROW: 0, EXPOSE: 1, USE_SKILL: 0 },
});
