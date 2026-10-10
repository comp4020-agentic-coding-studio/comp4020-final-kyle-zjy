import type { ActionSet } from "../scenario.ts";
import { BID04, END_TURN04, PASS04 } from "./auction.ts";
import { CHALLENGE04 } from "./blackjack.ts";
import { DEAL04 } from "./deal.ts";
import { BORROW04, EXPOSE04, INVESTIGATE04, READ04, RECOVER04, SABOTAGE04 } from "./tactics.ts";
import { USE_SKILL } from "../actions.ts";
import { USE_LOT04 } from "./items.ts";

export const s04Actions = (): ActionSet => ({
  specs: { BID: BID04, PASS: PASS04, INVESTIGATE: INVESTIGATE04, READ: READ04, DEAL: DEAL04, CHALLENGE: CHALLENGE04, SABOTAGE: SABOTAGE04, BORROW: BORROW04, EXPOSE: EXPOSE04, RECOVER: RECOVER04, USE_SKILL, USE_LOT: USE_LOT04, END_TURN: END_TURN04 },
  turnActions: ["BID", "PASS", "INVESTIGATE", "READ", "DEAL", "CHALLENGE", "SABOTAGE", "BORROW", "EXPOSE", "RECOVER", "USE_SKILL", "USE_LOT", "END_TURN"],
  apCost: { BID: 0, PASS: 0, INVESTIGATE: 1, READ: 1, DEAL: 0, CHALLENGE: 1, SABOTAGE: 1, BORROW: 0, EXPOSE: 1, RECOVER: 1, USE_SKILL: 0, USE_LOT: 0, END_TURN: 0 },
});
