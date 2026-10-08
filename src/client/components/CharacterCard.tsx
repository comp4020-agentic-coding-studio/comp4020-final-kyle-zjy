import { getCharacter } from "../../shared/characters/roster/index.ts";
import { ZODIAC_INFO } from "../../shared/characters/signs.ts";
import type { MBTI, SkillType, Zodiac } from "../../shared/characters/types.ts";
import { useCharacterText, useScenarioText, useT, type MessageKey, type TFunction } from "../i18n/index.ts";
import { Avatar } from "./Avatar.tsx";
import { Sigil } from "./Sigil.tsx";
import { characterSkill } from "../../shared/game/skills.ts";
import { useStore } from "../store.ts";

const SKILL_TYPE_LABEL = { ACTIVE: "skill.type.ACTIVE", REACTION: "skill.type.REACTION", PASSIVE: "skill.type.PASSIVE" } as const satisfies Record<SkillType, MessageKey>;
const SKILL_TYPE_HINT = { ACTIVE: "skill.hint.ACTIVE", REACTION: "skill.hint.REACTION", PASSIVE: "skill.hint.PASSIVE" } as const satisfies Record<SkillType, MessageKey>;

export const skillTypeLabel = (t: TFunction, type: SkillType) => t(SKILL_TYPE_LABEL[type]);

/** "Once per run. Use it on your own turn." */
export const usesAndHint = (t: TFunction, maxUses: number, type: SkillType) =>
  t("skill.usesAndHint", { uses: maxUses === 1 ? t("skill.uses.one") : t("skill.uses.other", { n: maxUses }), hint: t(SKILL_TYPE_HINT[type]) });

/** A character ticket: sigil, sign + type, title and the one ability. */
export function CharacterCard({ zodiac, mbti, size = "md" }: { zodiac: Zodiac; mbti: MBTI; size?: "sm" | "md" }) {
  const z = ZODIAC_INFO[zodiac];
  const c = getCharacter(zodiac, mbti);
  const sm = size === "sm";
  const t = useT();
  const text = useCharacterText()(c.id);
  const scenario = useStore((s) => s.snapshot?.game?.scenarioId ?? s.snapshot?.room.scenarioId);
  const skill = characterSkill(c.id, scenario);
  const sign = useScenarioText().zodiac[zodiac].name;
  return (
    // below 360 px the portrait sits above the text, so the title gets the full width
    <div className={`tarot foil flex flex-col gap-3 min-[360px]:flex-row min-[360px]:gap-4 ${sm ? "p-3" : "p-4"}`} style={{ borderColor: `${z.accent}88` }}>
      <div className="relative shrink-0 self-start">
        <Avatar zodiac={zodiac} mbti={mbti} size={sm ? 72 : 96} className="ring-1 ring-gold/50" />
        <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-night">
          <Sigil zodiac={zodiac} size={sm ? 26 : 32} />
        </span>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="label flex flex-wrap items-center gap-x-2">
          <span style={{ color: z.accent }}>
            {z.glyph} {sign}
          </span>
          <span className="text-ash">·</span>
          <span className="font-mono tracking-wider text-moon">{mbti}</span>
        </p>
        <h3 className={`mt-1 font-display leading-tight font-semibold text-gold-bright ${sm ? "text-xl" : "text-2xl"}`}>{text.title}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-display text-lg font-semibold text-moon">{text.skillName}</span>
          <span className="rounded-full border border-violet-soft/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-violet-soft">
            {skillTypeLabel(t, skill.type)}
          </span>
          <span className="rounded-full border border-moss/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-moss">{t("skill.state.READY")}</span>
        </p>
        {!sm && (
          <>
            <p className="mt-1 text-sm leading-relaxed text-mist">{text.skillDescription}</p>
            <p className="mt-1 text-xs text-ash">{usesAndHint(t, skill.maxUses, skill.type)}</p>
          </>
        )}
      </div>
    </div>
  );
}
