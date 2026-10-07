// After-the-fact triggers (a gain, a buff, a reward, a help, an ability used…)
// are queued here wherever they happen; the Skill Resolver asks the holders
// they wake once the table is free (resolver.ts, processTriggers). Kept apart
// so the effect handlers can queue without importing the resolver.
import type { QueuedTrigger } from "../../shared/game/state.ts";
import type { Ctx } from "./context.ts";

export function queueTrigger(ctx: Ctx, t: Omit<QueuedTrigger, "asked">): void {
  if (ctx.s.phase === "ENDING" || ctx.s.phase === "RESULTS") return;
  ctx.s.triggerQueue.push({ ...t, asked: [] });
}
