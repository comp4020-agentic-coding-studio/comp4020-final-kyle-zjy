// Static checks on a character's data: things that must hold before the Skill
// Resolver ever runs it. Used by test/roster.test.ts over all 192.
import { EFFECT_KINDS, type Effect } from "../game/effects.ts";
import { TRIGGERS, type Character, type Skill, type TargetRule } from "./types.ts";

const CJK = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef]/;
const NO_CHOSEN_TARGET: TargetRule[] = ["SELF", "NONE"];
const TARGET_SUBJECTS = new Set(["TARGET", "TARGETS", "SECOND_TARGET"]);

/** Every effect, including ones nested in rewards, options and branches. */
export function walkEffects(effects: Effect[], visit: (e: Effect) => void): void {
  for (const e of effects) {
    visit(e);
    const nested: Effect[][] = [];
    if ("reward" in e && Array.isArray(e.reward)) nested.push(e.reward);
    if ("effects" in e && Array.isArray(e.effects)) nested.push(e.effects);
    if ("onSuccess" in e && Array.isArray(e.onSuccess)) nested.push(e.onSuccess);
    if ("onFail" in e && Array.isArray(e.onFail)) nested.push(e.onFail);
    if (e.kind === "CHOOSE_ONE") nested.push(...e.options);
    if (e.kind === "CONDITIONAL") nested.push(e.then, ...(e.otherwise ? [e.otherwise] : []));
    for (const list of nested) walkEffects(list, visit);
  }
}

// fields that hold an EffectSubject (others, like MODIFY_EVENT.change, can say "TARGET" and mean something else)
const SUBJECT_FIELDS = ["who", "from", "to", "between", "against", "participants", "protects"];
const subjectsOf = (e: Effect): string[] =>
  Object.entries(e)
    .filter(([k]) => SUBJECT_FIELDS.includes(k))
    .flatMap(([, v]) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === "string") : []));

export function validateCharacter(c: Character, s: Skill): string[] {
  const problems: string[] = [];
  const say = (msg: string) => problems.push(`${c.id}: ${msg}`);

  for (const [field, text] of [
    ["title", c.nickname],
    ["skill name", s.name],
    ["description", s.description],
  ] as const) {
    if (!text.trim()) say(`empty ${field}`);
    if (CJK.test(text)) say(`${field} contains CJK text: ${text}`);
  }
  if (s.description.length > 220) say("description longer than 220 characters");
  if (!Number.isInteger(s.maxUses) || s.maxUses < 1) say(`maxUses must be a positive integer (got ${s.maxUses})`);
  if (s.tags.length === 0) say("no tags");
  if (!TRIGGERS.includes(s.trigger.on)) say(`unknown trigger ${s.trigger.on}`);
  if (s.type === "ACTIVE" && s.trigger.on !== "OWN_TURN") say("ACTIVE skills trigger on OWN_TURN");
  if (s.type !== "ACTIVE" && s.trigger.on === "OWN_TURN") say(`${s.type} skills need a trigger other than OWN_TURN`);
  if (s.trigger.on === "CONDITION_MET" && !s.trigger.condition) say("CONDITION_MET without a condition id");
  if (s.effects.length === 0) say("no effects");

  let usesChosenTarget = false;
  walkEffects(s.effects, (e) => {
    if (!(EFFECT_KINDS as readonly string[]).includes(e.kind)) say(`unknown effect kind ${e.kind}`);
    if (subjectsOf(e).some((v) => TARGET_SUBJECTS.has(v))) usesChosenTarget = true;
  });
  if (usesChosenTarget && NO_CHOSEN_TARGET.includes(s.target)) {
    say(`effects refer to a target but the target rule is ${s.target}`);
  }
  return problems;
}
