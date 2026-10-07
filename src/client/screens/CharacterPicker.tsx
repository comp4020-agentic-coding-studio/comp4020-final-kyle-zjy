// Full-screen character creation: zodiac wheel → MBTI grid → reveal.
// Every step is confirmed by the server before the next one shows.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { getCharacter } from "../../shared/characters/roster/index.ts";
import { MBTI_INFO, TEMPERAMENTS, ZODIAC_INFO } from "../../shared/characters/signs.ts";
import { ZODIACS, type MBTI, type Zodiac } from "../../shared/characters/types.ts";
import { SKILL_TYPE_HINT, SKILL_TYPE_LABEL, usesText } from "../components/CharacterCard.tsx";
import { Avatar, preloadAvatar } from "../components/Avatar.tsx";
import { Sigil } from "../components/Sigil.tsx";
import { sendLobby } from "../store.ts";

type Step = "zodiac" | "mbti" | "reveal";

export function CharacterPicker({
  initialZodiac,
  initialMbti,
  startAt,
  onClose,
}: {
  initialZodiac: Zodiac | null;
  initialMbti: MBTI | null;
  startAt: Step;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(startAt);
  const [zodiac, setZodiac] = useState<Zodiac>(initialZodiac ?? "aries");
  const [mbti, setMbti] = useState<MBTI | null>(initialMbti);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const confirmZodiac = async () => {
    setBusy(true);
    if (await sendLobby({ type: "PICK_ZODIAC", zodiac })) {
      setMbti(null);
      setStep("mbti");
    }
    setBusy(false);
  };
  const confirmMbti = async () => {
    if (!mbti) return;
    preloadAvatar(zodiac, mbti);
    setBusy(true);
    if (await sendLobby({ type: "PICK_MBTI", mbti })) setStep("reveal");
    setBusy(false);
  };

  return (
    <motion.div
      className="night-sky fixed inset-0 z-40 flex flex-col overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Create your character"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {step !== "reveal" && (
        <header className="flex items-center justify-between px-4 pt-4">
          <button className="btn btn-ghost min-h-12 px-4 text-sm" onClick={step === "mbti" ? () => setStep("zodiac") : onClose}>
            {step === "mbti" ? "← Sign" : "Close"}
          </button>
          <ol className="flex items-center gap-2 text-xs font-bold tracking-widest" aria-label="Steps">
            {(["zodiac", "mbti", "reveal"] as const).map((s, i) => (
              <li key={s} className={s === step ? "text-gold-bright" : "text-ash"} aria-current={s === step ? "step" : undefined}>
                {i + 1}. {s === "zodiac" ? "SIGN" : s === "mbti" ? "TYPE" : "REVEAL"}
              </li>
            ))}
          </ol>
        </header>
      )}

      <AnimatePresence mode="wait">
        {step === "zodiac" && (
          <motion.section
            key="zodiac"
            className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-4 pt-4 pb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <h2 className="text-center font-display text-3xl font-semibold">Under which sign were you born?</h2>
            <ZodiacWheel value={zodiac} onChange={setZodiac} />
            <SignSummary zodiac={zodiac} />
            <button className="btn btn-gold mt-5 w-full max-w-sm" disabled={busy} onClick={confirmZodiac}>
              Choose {ZODIAC_INFO[zodiac].name}
            </button>
          </motion.section>
        )}

        {step === "mbti" && (
          <motion.section
            key="mbti"
            className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <div className="flex items-center justify-center gap-3">
              <Sigil zodiac={zodiac} size={44} />
              <h2 className="font-display text-3xl font-semibold">And your type?</h2>
            </div>
            <MbtiGrid value={mbti} onChange={setMbti} />
            <div className="safe-bottom sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-void via-void/95 to-transparent px-4 pt-6">
              <button className="btn btn-gold mx-auto flex w-full max-w-sm" disabled={!mbti || busy} onClick={confirmMbti}>
                {mbti ? `Reveal ${ZODIAC_INFO[zodiac].name} · ${mbti}` : "Choose a type"}
              </button>
            </div>
          </motion.section>
        )}

        {step === "reveal" && mbti && <Reveal key="reveal" zodiac={zodiac} mbti={mbti} onDone={onClose} />}
      </AnimatePresence>
    </motion.div>
  );
}

function ZodiacWheel({ value, onChange }: { value: Zodiac; onChange: (z: Zodiac) => void }) {
  const index = ZODIACS.indexOf(value);
  // rotate so the chosen sign sits at 12 o'clock
  const rotation = -index * 30;
  return (
    <div className="relative mt-6 aspect-square w-full max-w-[340px]">
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: rotation }}
        transition={{ type: "spring", damping: 22, stiffness: 120 }}
      >
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="100" cy="100" r="98" fill="none" stroke="#c9a55a" strokeOpacity=".45" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#c9a55a" strokeOpacity=".2" strokeDasharray="1 3" />
          <circle cx="100" cy="100" r="44" fill="#0a0f22" stroke="#c9a55a" strokeOpacity=".35" />
          {ZODIACS.map((_, i) => {
            const a = ((i * 30 - 90 + 15) * Math.PI) / 180;
            return (
              <line key={i} x1={100 + Math.cos(a) * 44} y1={100 + Math.sin(a) * 44} x2={100 + Math.cos(a) * 98} y2={100 + Math.sin(a) * 98} stroke="#c9a55a" strokeOpacity=".18" />
            );
          })}
        </svg>
        {ZODIACS.map((z, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          const r = 41; // % of the box
          const selected = z === value;
          return (
            <motion.button
              key={z}
              type="button"
              onClick={() => onChange(z)}
              aria-pressed={selected}
              aria-label={ZODIAC_INFO[z].name}
              className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              style={{ left: `${50 + Math.cos(a) * r}%`, top: `${50 + Math.sin(a) * r}%` }}
              animate={{ rotate: -rotation, scale: selected ? 1.18 : 1 }}
              transition={{ type: "spring", damping: 22, stiffness: 120 }}
            >
              <span
                className="font-display text-[26px] leading-none"
                style={{
                  color: selected ? ZODIAC_INFO[z].accent : "#a3a9c7",
                  textShadow: selected ? `0 0 14px ${ZODIAC_INFO[z].accent}` : undefined,
                }}
              >
                {ZODIAC_INFO[z].glyph}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
      {/* pointer at 12 o'clock */}
      <div className="pointer-events-none absolute top-[-6px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent border-t-gold-bright" />
      <div className="pointer-events-none absolute inset-[28%] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div key={value} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <Sigil zodiac={value} size={120} draw className="h-auto w-full max-w-[120px]" />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SignSummary({ zodiac }: { zodiac: Zodiac }) {
  const z = ZODIAC_INFO[zodiac];
  return (
    <div className="mt-5 text-center" aria-live="polite">
      <p className="font-display text-4xl font-semibold" style={{ color: z.accent }}>
        {z.name}
      </p>
      <p className="label mt-1">{z.dates}</p>
      <p className="mt-2 text-mist">{z.theme}</p>
    </div>
  );
}

function MbtiGrid({ value, onChange }: { value: MBTI | null; onChange: (m: MBTI) => void }) {
  return (
    <div className="mt-6 space-y-5">
      {TEMPERAMENTS.map((t) => (
        <div key={t.id}>
          <p className="label mb-2">
            {t.name} <span className="text-ash">· {t.id}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {t.types.map((m) => {
              const selected = value === m;
              return (
                <motion.button
                  key={m}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(m)}
                  whileTap={{ scale: 0.97 }}
                  className={`tarot min-h-[84px] px-3 py-3 text-left transition-shadow ${selected ? "shadow-[var(--glow-gold)]" : ""}`}
                  style={selected ? { borderColor: "var(--c-gold-bright)" } : undefined}
                >
                  <span className={`block font-mono text-xl tracking-widest ${selected ? "text-gold-bright" : "text-moon"}`}>{m}</span>
                  <span className="mt-1 block font-display text-base text-mist">{MBTI_INFO[m].title}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
      {value && (
        <p className="text-center text-sm text-mist" aria-live="polite">
          {MBTI_INFO[value].traits}
        </p>
      )}
    </div>
  );
}

/** The character reveal: darkness → sigil → sign and type → title → ability. */
function Reveal({ zodiac, mbti, onDone }: { zodiac: Zodiac; mbti: MBTI; onDone: () => void }) {
  const z = ZODIAC_INFO[zodiac];
  const c = getCharacter(zodiac, mbti);
  const at = (s: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: s, duration: 0.8 } });
  return (
    <motion.section
      className="relative flex flex-1 flex-col items-center justify-center bg-black px-6 py-10 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      aria-live="polite"
    >
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 2 }}
        style={{ background: `radial-gradient(circle at 50% 38%, ${z.accent}33, transparent 55%)` }}
      />
      {/* the sigil draws itself, then the portrait rises out of the dark inside it */}
      <div className="relative h-[220px] w-[220px]">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: [0, 1, 1, 0.9], scale: [0.85, 1, 1, 1.06] }}
          transition={{ duration: 2.4, times: [0, 0.35, 0.6, 1], ease: [0.16, 1, 0.3, 1] }}
        >
          <Sigil zodiac={zodiac} size={220} draw />
        </motion.div>
        <motion.div
          className="absolute inset-[18px] overflow-hidden rounded-full"
          style={{ boxShadow: `0 0 60px ${z.accent}55` }}
          initial={{ opacity: 0, scale: 0.92, filter: "blur(14px) brightness(0)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px) brightness(1)" }}
          transition={{ delay: 1.0, duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Avatar zodiac={zodiac} mbti={mbti} size={184} eager className="h-full w-full" />
        </motion.div>
      </div>
      <motion.p className="label relative mt-6" {...at(1.4)}>
        <span style={{ color: z.accent }}>
          {z.glyph} {z.name}
        </span>{" "}
        · <span className="font-mono text-moon">{mbti}</span>
      </motion.p>
      <motion.h2 className="relative mt-3 font-display text-[clamp(2.2rem,9vw,3.5rem)] leading-tight font-semibold text-gold-bright" {...at(2.0)}>
        {c.nickname}
      </motion.h2>
      <motion.p className="relative mt-5 font-display text-2xl text-moon" {...at(2.7)}>
        {c.skill.name}
        <span className="ml-2 align-middle text-[11px] font-bold tracking-widest text-violet-soft">{SKILL_TYPE_LABEL[c.skill.type]}</span>
      </motion.p>
      <motion.p className="relative mt-2 max-w-sm leading-relaxed text-mist" {...at(3.2)}>
        {c.skill.description}
      </motion.p>
      <motion.p className="relative mt-3 max-w-sm text-sm text-ash" {...at(3.6)}>
        {usesText(c.skill.maxUses)} {SKILL_TYPE_HINT[c.skill.type]}
      </motion.p>
      <motion.button className="btn btn-gold relative mt-8 w-full max-w-xs" onClick={onDone} {...at(3.8)}>
        Take my ticket
      </motion.button>
      <button className="absolute top-4 right-4 min-h-12 px-3 text-sm text-ash hover:text-mist" onClick={onDone}>
        Skip
      </button>
    </motion.section>
  );
}
