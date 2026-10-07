import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { CodeInput } from "../components/CodeInput.tsx";
import { PlatformScene } from "../components/PlatformScene.tsx";
import { api, ApiError } from "../net/api.ts";
import { session } from "../net/session.ts";
import { navigate } from "../router.ts";
import { reconnect } from "../store.ts";

type Mode = null | "create" | "join";

export function Landing({ initialCode }: { initialCode?: string }) {
  const [mode, setMode] = useState<Mode>(initialCode ? "join" : null);
  const [lastRoom, setLastRoom] = useState<string | null>(null);

  useEffect(() => {
    const code = session.lastRoom();
    if (!code || !session.token() || initialCode) return;
    // only offer a rejoin if the room still exists
    api.roomInfo(code).then(() => setLastRoom(code), () => session.setLastRoom(null));
  }, [initialCode]);

  return (
    <main className="night-sky vignette relative flex min-h-dvh flex-col overflow-hidden">
      <PlatformScene />

      {/* destination board */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-10 mx-auto mt-4 w-[min(100%-32px,560px)] rounded-lg border border-[#1f2547] bg-[#04050b]/90 px-4 py-3 shadow-[0_10px_40px_rgb(0_0_0/.6)]"
      >
        <div className="flex items-center justify-between gap-3 font-mono text-[13px] sm:text-sm">
          <span className="led-amber text-lg sm:text-xl">00:17</span>
          <span className="led">N13</span>
          <span className="truncate text-mist">
            TERMINUS <span className="led-amber tracking-widest">██████</span>
          </span>
        </div>
        <div className="mt-1 overflow-hidden whitespace-nowrap font-mono text-[11px] text-ash">
          <motion.div
            animate={{ x: ["100%", "-100%"] }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          >
            PASSENGERS WITH TICKETS, PLEASE BOARD NOW · PASSENGER COUNT IS BEING CONFIRMED · DO NOT FALL ASLEEP
          </motion.div>
        </div>
      </motion.header>

      <section className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-end px-4 pb-6 text-center sm:justify-center">
        <motion.p
          className="label text-gold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 1 }}
        >
          A party game for 2–10 passengers
        </motion.p>
        <motion.h1
          className="mt-3 font-display text-[clamp(3rem,15vw,6.5rem)] leading-[0.9] font-semibold text-moon"
          style={{ textShadow: "0 0 40px rgb(106 79 216 / .45)" }}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: 0.5, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          Fate
          <br />
          <span className="text-gold-bright italic">Instance</span>
        </motion.h1>
        <motion.p
          className="mt-4 max-w-sm text-[15px] leading-relaxed text-mist"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 1 }}
        >
          Your zodiac sign and MBTI type become a character with exactly one ability. Spend it at the right moment, or
          stay on the last train forever.
        </motion.p>

        <motion.div
          className="mt-8 flex w-full max-w-sm flex-col gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.7 }}
        >
          {lastRoom && (
            <button className="btn btn-signal w-full" onClick={() => navigate(`/room/${lastRoom}`)}>
              Return to room <span className="font-mono tracking-widest">{lastRoom}</span>
            </button>
          )}
          <button className="btn btn-gold w-full" onClick={() => setMode("create")}>
            Create room
          </button>
          <button className="btn btn-ghost w-full" onClick={() => setMode("join")}>
            Join room
          </button>
          <a href="/readme/" className="mt-1 inline-flex min-h-12 items-center justify-center text-sm text-ash underline-offset-4 hover:text-mist hover:underline">
            About this project
          </a>
        </motion.div>
      </section>

      <AnimatePresence>
        {mode && <EntrySheet key={mode} mode={mode} initialCode={initialCode} onClose={() => setMode(null)} />}
      </AnimatePresence>
    </main>
  );
}

function EntrySheet({ mode, initialCode, onClose }: { mode: "create" | "join"; initialCode?: string; onClose: () => void }) {
  const [nickname, setNickname] = useState(session.nickname());
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = nickname.trim().length > 0 && (mode === "create" || code.length === 6) && !busy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    session.setNickname(nickname.trim());
    try {
      const r = mode === "create" ? await api.createRoom(nickname) : await api.joinRoom(code, nickname);
      const target = `/room/${r.roomCode}`;
      // already on this room's URL (joining from an invite link): just connect
      if (location.pathname.toUpperCase() === target.toUpperCase()) reconnect();
      else navigate(target);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
        onSubmit={submit}
        className="tarot safe-bottom relative w-full max-w-md rounded-b-none px-5 pt-6 sm:rounded-b-[var(--r-md)] sm:pb-6"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
      >
        <p className="label text-gold">{mode === "create" ? "New departure" : "Board a train"}</p>
        <h2 id="entry-title" className="mt-1 font-display text-3xl font-semibold">
          {mode === "create" ? "Create a room" : "Join a room"}
        </h2>

        {mode === "join" && (
          <div className="mt-5">
            <label htmlFor="code" className="label mb-2 block">
              Room code
            </label>
            <CodeInput id="code" value={code} onChange={setCode} />
          </div>
        )}

        <div className="mt-5">
          <label htmlFor="nickname" className="label mb-2 block">
            Your name on the ticket
          </label>
          <input
            id="nickname"
            className="field"
            value={nickname}
            maxLength={16}
            autoComplete="nickname"
            autoFocus={mode === "create" || !!initialCode}
            placeholder="Up to 16 characters"
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-ember/50 bg-ember/10 px-3 py-2 text-sm">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
            Back
          </button>
          <button type="submit" className="btn btn-gold flex-[2]" disabled={!canSubmit}>
            {busy ? "Boarding…" : mode === "create" ? "Create room" : "Join room"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
