import { getCharacter } from "../../shared/characters/roster/index.ts";
import { ZODIAC_INFO } from "../../shared/characters/signs.ts";
import type { MBTI, SkillType, Zodiac } from "../../shared/characters/types.ts";
import { Avatar } from "./Avatar.tsx";
import { Sigil } from "./Sigil.tsx";

export const SKILL_TYPE_LABEL: Record<SkillType, string> = {
  ACTIVE: "ACTIVE",
  REACTION: "REACTION",
  PASSIVE: "PASSIVE",
};

export const SKILL_TYPE_HINT: Record<SkillType, string> = {
  ACTIVE: "Use it on your own turn.",
  REACTION: "Fires in response to something happening. You'll be asked.",
  PASSIVE: "Offered automatically when its condition comes true.",
};

export const usesText = (n: number) => (n === 1 ? "Once per run." : `${n} times per run.`);

/** A character ticket: sigil, sign + type, title and the one ability. */
export function CharacterCard({ zodiac, mbti, size = "md" }: { zodiac: Zodiac; mbti: MBTI; size?: "sm" | "md" }) {
  const z = ZODIAC_INFO[zodiac];
  const c = getCharacter(zodiac, mbti);
  const sm = size === "sm";
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
            {z.glyph} {z.name}
          </span>
          <span className="text-ash">·</span>
          <span className="font-mono tracking-wider text-moon">{mbti}</span>
        </p>
        <h3 className={`mt-1 font-display leading-tight font-semibold text-gold-bright ${sm ? "text-xl" : "text-2xl"}`}>{c.nickname}</h3>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-display text-lg font-semibold text-moon">{c.skill.name}</span>
          <span className="rounded-full border border-violet-soft/40 px-2 py-0.5 text-[10px] font-bold tracking-widest text-violet-soft">
            {SKILL_TYPE_LABEL[c.skill.type]}
          </span>
          <span className="rounded-full border border-moss/50 px-2 py-0.5 text-[10px] font-bold tracking-widest text-moss">READY</span>
        </p>
        {!sm && (
          <>
            <p className="mt-1 text-sm leading-relaxed text-mist">{c.skill.description}</p>
            <p className="mt-1 text-xs text-ash">
              {usesText(c.skill.maxUses)} {SKILL_TYPE_HINT[c.skill.type]}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
