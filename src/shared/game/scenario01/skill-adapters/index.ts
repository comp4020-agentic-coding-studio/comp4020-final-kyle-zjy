// Scenario 01's dress for the core abilities: every one the roster uses has
// a name and description here (test/skills-architecture.test.ts checks 192/192).
import type { ScenarioSkillSet } from "../../../skills/types.ts";
import { ARIES } from "./aries.ts";
import { TAURUS } from "./taurus.ts";
import { GEMINI } from "./gemini.ts";
import { CANCER } from "./cancer.ts";
import { LEO } from "./leo.ts";
import { VIRGO } from "./virgo.ts";
import { LIBRA } from "./libra.ts";
import { SCORPIO } from "./scorpio.ts";
import { SAGITTARIUS } from "./sagittarius.ts";
import { CAPRICORN } from "./capricorn.ts";
import { AQUARIUS } from "./aquarius.ts";
import { PISCES } from "./pisces.ts";

export const SCENARIO01_SKILLS: ScenarioSkillSet = {
  scenario: "01",
  adapters: { ...ARIES, ...TAURUS, ...GEMINI, ...CANCER, ...LEO, ...VIRGO, ...LIBRA, ...SCORPIO, ...SAGITTARIUS, ...CAPRICORN, ...AQUARIUS, ...PISCES },
  vfxByCategory: {
    REROLL: "DICE",
    MODIFY_RESULT: "DICE",
    PREVIEW_EVENT: "EYE",
    CONTROL_EVENT: "EYE",
    SHIELD: "SHIELD",
    REDIRECT: "SWAP",
    COPY_EFFECT: "SPARK",
    SWAP_STATE: "SWAP",
    GAIN_RESOURCE: "SPARK",
    RESTORE_SKILL: "CLOCK",
    CHANGE_TURN_ORDER: "CLOCK",
    REMOVE_STATUS: "SHIELD",
    BIND: "CHAIN",
    CHALLENGE: "STRIKE",
    RETALIATE: "STRIKE",
    EMPOWER: "SPARK",
    HINDER: "STRIKE",
    MOVE: "SWAP",
    TASK: "CLOCK",
    RULE: "CLOCK",
  },
};
