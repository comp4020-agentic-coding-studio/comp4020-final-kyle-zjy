// Every core ability, by id. A character points at one (coreSkillId); a
// scenario adapter gives it a name, a description and, rarely, a behaviour.
import { BIND } from "./bind.ts";
import { CHALLENGE } from "./challenge.ts";
import { CHANGE_TURN_ORDER } from "./change-turn-order.ts";
import { CONTROL_EVENT } from "./control-event.ts";
import { COPY_EFFECT } from "./copy-effect.ts";
import { EMPOWER } from "./empower.ts";
import { GAIN_RESOURCE } from "./gain-resource.ts";
import { HINDER } from "./hinder.ts";
import { MODIFY_RESULT } from "./modify-result.ts";
import { MOVE } from "./move.ts";
import { PREVIEW_EVENT } from "./preview-event.ts";
import { REDIRECT } from "./redirect.ts";
import { REMOVE_STATUS } from "./remove-status.ts";
import { REROLL } from "./reroll.ts";
import { RESTORE_SKILL } from "./restore-skill.ts";
import { RETALIATE } from "./retaliate.ts";
import { RULE } from "./rule.ts";
import { SHIELD } from "./shield.ts";
import { SWAP_STATE } from "./swap-state.ts";
import { TASK } from "./task.ts";
import type { CoreSkill, CoreSkillId } from "./types.ts";

export const CORE_SKILL_LIST: CoreSkill[] = [...BIND, ...CHALLENGE, ...CHANGE_TURN_ORDER, ...CONTROL_EVENT, ...COPY_EFFECT, ...EMPOWER, ...GAIN_RESOURCE, ...HINDER, ...MODIFY_RESULT, ...MOVE, ...PREVIEW_EVENT, ...REDIRECT, ...REMOVE_STATUS, ...REROLL, ...RESTORE_SKILL, ...RETALIATE, ...RULE, ...SHIELD, ...SWAP_STATE, ...TASK];

export const CORE_SKILLS: Record<CoreSkillId, CoreSkill> = Object.fromEntries(CORE_SKILL_LIST.map((c) => [c.id, c]));
