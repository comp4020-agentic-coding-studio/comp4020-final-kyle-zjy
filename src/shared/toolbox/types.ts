export type Tool = "chips" | "dice";
export type Street = "preflop" | "flop" | "turn" | "river";
export type Seat = { id: string; stack: number; bet: number; total: number; folded: boolean; actedAt: number | null };
export type Pot = { amount: number; eligible: string[]; winners: string[] };
export type Poker = {
  seats: Seat[]; dealer: string | null; actor: string | null; street: Street;
  stage: "waiting" | "betting" | "between" | "settlement";
  small: number; big: number; buyIn: number; price: number; raise: number;
  raised?: string[]; pending: string[]; pots: Pot[]; hand: number; log: string[];
};
export type Toolbox = { version: number; tool: Tool; poker: Poker; dice: Record<string, { values: number[]; at: number }[]>; rng: [number, number, number, number]; rngCalls: number; requests: string[] };
export type ToolboxView = { version: number; tool: Tool; poker: Poker; mine: { values: number[]; at: number }[]; viewer: string; members: { playerId: string; nickname: string; isHost: boolean }[] };
export type ToolAction =
  | { type: "SWITCH"; tool: Tool }
  | { type: "ROLL" }
  | { type: "CONFIG"; buyIn: number; small: number; big: number; ids: string[]; dealer: string }
  | { type: "START" } | { type: "NEXT" }
  | { type: "FOLD" } | { type: "CHECK" } | { type: "CALL" }
  | { type: "RAISE"; to: number } | { type: "ALL_IN" }
  | { type: "AWARD"; pot: number; winners: string[] };
