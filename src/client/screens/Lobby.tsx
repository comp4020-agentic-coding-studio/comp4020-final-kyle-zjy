import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { MBTI_INFO, ZODIAC_INFO } from "../../shared/characters/signs.ts";
import type { Member } from "../../shared/game/state.ts";
import { MAX_PLAYERS, MIN_PLAYERS } from "../../shared/protocol.ts";
import { CharacterCard } from "../components/CharacterCard.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { Sigil } from "../components/Sigil.tsx";
import { sendLobby, useMe, useStore } from "../store.ts";
import { CharacterPicker } from "./CharacterPicker.tsx";

export function Lobby() {
  const room = useStore((s) => s.snapshot!.room);
  const me = useMe()!;
  const [picker, setPicker] = useState<null | "zodiac" | "mbti" | "reveal">(null);
  const [inspect, setInspect] = useState<Member | null>(null);

  const ready = room.members.filter((m) => m.stage === "READY").length;
  const startBlocker =
    room.members.length < MIN_PLAYERS
      ? `Need at least ${MIN_PLAYERS} passengers`
      : ready < room.members.length
        ? `Waiting for ${room.members.length - ready} to be ready`
        : null;

  return (
    <main className="night-sky vignette relative min-h-dvh pb-40">
      <TopBar code={room.code} count={room.members.length} />

      <div className="relative z-10 mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 px-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section aria-label="Passengers" className="min-w-0">
          <StarDial members={room.members} meId={me.playerId} readyCount={ready} onSelect={setInspect} />
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <MyTicket me={me} onPick={setPicker} />
          <ScenarioStrip />
        </aside>
      </div>

      {/* thumb-zone action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-gold/15 bg-[#05060d]/85 px-4 pt-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center">
          <ReadyButton me={me} onPick={() => setPicker("zodiac")} />
          {me.isHost ? (
            <div className="flex flex-1 flex-col items-stretch sm:items-end">
              <button
                className="btn btn-gold w-full sm:w-auto sm:min-w-56"
                disabled={!!startBlocker}
                aria-describedby="start-reason"
                onClick={() => sendLobby({ type: "START_GAME" })}
              >
                Depart
              </button>
              <p id="start-reason" className="mt-1 text-center text-xs text-ash sm:text-right">
                {startBlocker ?? "Everyone is ready. The train is waiting for you."}
              </p>
            </div>
          ) : (
            <p className="flex-1 text-center text-sm text-mist sm:text-right">
              {startBlocker ? `${startBlocker}.` : "Everyone is ready."} The host departs the train.
            </p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {picker && (
          <CharacterPicker
            initialZodiac={me.zodiac}
            initialMbti={me.mbti}
            startAt={picker}
            onClose={() => setPicker(null)}
          />
        )}
        {inspect && <PassengerSheet member={inspect} me={me} onClose={() => setInspect(null)} />}
      </AnimatePresence>
    </main>
  );
}

function TopBar({ code, count }: { code: string; count: number }) {
  const toast = useStore((s) => s.toast);
  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? code : `${location.origin}/room/${code}`;
    try {
      if (what === "link" && navigator.share) {
        await navigator.share({ title: "Fate Instance", text: `Join my room ${code}`, url: text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast(what === "code" ? `Room code ${code} copied` : "Invite link copied");
    } catch {
      /* share sheet dismissed, or clipboard blocked */
    }
  };
  const leave = () => {
    if (confirm("Leave this room? Your seat will be given up.")) sendLobby({ type: "LEAVE" });
  };

  return (
    <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center gap-3 px-4 pt-4 pb-2">
      <button className="btn btn-ghost min-h-12 min-w-12 shrink-0 px-3 text-sm" onClick={leave} aria-label="Leave room">
        <span aria-hidden="true">←</span>
        <span className="hidden sm:inline">Leave</span>
      </button>
      <div className="ticket flex min-w-0 flex-1 items-center justify-between gap-1 py-2 pr-2 pl-5">
        <div className="min-w-0">
          <p className="label text-[10px]">Room</p>
          <button
            className="min-h-12 font-mono text-[26px] leading-tight tracking-[0.18em] text-gold-bright sm:text-4xl sm:tracking-[0.25em]"
            onClick={() => copy("code")}
            aria-label={`Room code ${code.split("").join(" ")}. Copy`}
          >
            {code}
          </button>
        </div>
        <div className="flex shrink-0 gap-1">
          <button className="hidden min-h-12 rounded-full px-3 text-xs font-bold tracking-wider text-mist hover:text-moon sm:block" onClick={() => copy("code")}>
            COPY
          </button>
          <button className="min-h-12 rounded-full px-3 text-xs font-bold tracking-wider text-mist hover:text-moon" onClick={() => copy("link")}>
            INVITE
          </button>
        </div>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="label text-[10px]">Passengers</p>
        <p className="font-mono text-xl">
          {count}
          <span className="text-ash"> / {MAX_PLAYERS}</span>
        </p>
      </div>
    </header>
  );
}

/** Ten seats around an astrolabe. Filled seats show the passenger's sigil. */
function StarDial({
  members,
  meId,
  readyCount,
  onSelect,
}: {
  members: Member[];
  meId: string;
  readyCount: number;
  onSelect: (m: Member) => void;
}) {
  const bySeat = new Map(members.map((m) => [m.seat, m]));
  return (
    <div className="relative mx-auto mt-2 aspect-square w-full max-w-[min(560px,calc(100vw-32px))]">
      {/* rings (spinning; clipped to the circle so the rotated box never overflows) */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
      <motion.svg
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        animate={{ rotate: 360 }}
        transition={{ duration: 240, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="100" cy="100" r="96" fill="none" stroke="#c9a55a" strokeOpacity=".25" />
        <circle cx="100" cy="100" r="78" fill="none" stroke="#c9a55a" strokeOpacity=".12" strokeDasharray="1 2.5" />
        <circle cx="100" cy="100" r="44" fill="none" stroke="#6a4fd8" strokeOpacity=".35" />
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * 5 * Math.PI) / 180;
          const r1 = i % 6 === 0 ? 90 : 93;
          return (
            <line key={i} x1={100 + Math.cos(a) * r1} y1={100 + Math.sin(a) * r1} x2={100 + Math.cos(a) * 96} y2={100 + Math.sin(a) * 96} stroke="#c9a55a" strokeOpacity=".3" strokeWidth=".4" />
          );
        })}
      </motion.svg>
      </div>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* threads from centre to each occupied seat */}
        {members.map((m) => {
          const a = seatAngle(m.seat);
          return (
            <motion.line
              key={m.playerId}
              x1="100"
              y1="100"
              x2={100 + Math.cos(a) * 66}
              y2={100 + Math.sin(a) * 66}
              stroke={m.zodiac ? ZODIAC_INFO[m.zodiac].accent : "#3a4270"}
              strokeOpacity={m.stage === "READY" ? 0.5 : 0.2}
              strokeWidth=".6"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8 }}
            />
          );
        })}
      </svg>

      {/* centre readout */}
      <div className="absolute inset-[32%] flex flex-col items-center justify-center rounded-full text-center">
        <p className="label text-[10px]">Boarding</p>
        <p className="font-mono text-3xl text-moon sm:text-4xl">
          {members.length}
          <span className="text-ash">/{MAX_PLAYERS}</span>
        </p>
        <p className="mt-1 text-xs text-mist">
          <span className="text-moss">{readyCount}</span> ready
        </p>
      </div>

      {Array.from({ length: MAX_PLAYERS }, (_, seat) => {
        const m = bySeat.get(seat);
        const a = seatAngle(seat);
        return (
          <div
            key={seat}
            className="absolute flex w-[22%] max-w-[104px] -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${50 + Math.cos(a) * 39}%`, top: `${50 + Math.sin(a) * 39}%` }}
          >
            <AnimatePresence mode="popLayout">
              {m ? (
                <SeatToken key={m.playerId} member={m} isMe={m.playerId === meId} onSelect={() => onSelect(m)} />
              ) : (
                <motion.div key={`empty-${seat}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                  <Sigil zodiac={null} size={44} dim />
                  <span className="sr-only">Empty seat {seat + 1}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

const seatAngle = (seat: number) => ((seat * 36 - 90) * Math.PI) / 180;

function SeatToken({ member, isMe, onSelect }: { member: Member; isMe: boolean; onSelect: () => void }) {
  const isReady = member.stage === "READY";
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className="group flex w-full flex-col items-center"
      initial={{ opacity: 0, scale: 0.4, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{ type: "spring", damping: 18, stiffness: 220 }}
      aria-label={`${member.nickname}${isMe ? " (you)" : ""}${member.isHost ? ", host" : ""}, ${
        member.zodiac ? ZODIAC_INFO[member.zodiac].name : "no sign yet"
      }${member.mbti ? ` ${member.mbti}` : ""}, ${isReady ? "ready" : "not ready"}${member.connected ? "" : ", offline"}`}
    >
      <span className="relative">
        <span
          className={`absolute -inset-1 rounded-full transition-shadow ${isMe ? "ring-2 ring-signal" : ""}`}
          style={isReady ? { boxShadow: "0 0 0 2px var(--c-moss), 0 0 18px rgb(91 196 137 / .45)" } : undefined}
        />
        <span className="block h-[clamp(36px,13vw,72px)] w-[clamp(36px,13vw,72px)]">
          {member.zodiac && member.mbti ? (
            <Avatar zodiac={member.zodiac} mbti={member.mbti} size={72} dim={!member.connected} className="h-full w-full" />
          ) : (
            <Sigil zodiac={member.zodiac} size={72} dim={!member.connected} className="h-full w-full" />
          )}
        </span>
        {member.isHost && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-gold px-1.5 text-[9px] font-extrabold tracking-wider text-[#1a1206]">
            HOST
          </span>
        )}
        {isReady && (
          <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-moss text-[11px] font-black text-[#04140b]" aria-hidden="true">
            ✓
          </span>
        )}
      </span>
      <span className={`mt-1.5 w-full truncate text-center text-[11px] font-semibold sm:text-xs ${isMe ? "text-signal" : "text-moon"}`}>
        {member.nickname}
      </span>
      <span className="font-mono text-[10px] tracking-wider text-mist">
        {member.mbti ?? (member.zodiac ? ZODIAC_INFO[member.zodiac].name.slice(0, 3).toUpperCase() : "· · ·")}
        {!member.connected && <span className="ml-1 text-ember">OFF</span>}
        {isReady && <span className="sr-only"> ready</span>}
      </span>
    </motion.button>
  );
}

function MyTicket({ me, onPick }: { me: Member; onPick: (s: "zodiac" | "mbti") => void }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="label text-gold">Your ticket</p>
        <p className="text-xs text-ash">{me.nickname}</p>
      </div>
      {me.zodiac && me.mbti ? (
        <>
          <CharacterCard zodiac={me.zodiac} mbti={me.mbti} />
          <button className="mt-3 min-h-12 w-full text-sm text-mist underline-offset-4 hover:text-moon hover:underline" onClick={() => onPick("zodiac")}>
            Change character
          </button>
        </>
      ) : me.zodiac ? (
        <div className="flex items-center gap-4">
          <Sigil zodiac={me.zodiac} size={64} />
          <div className="flex-1">
            <p className="font-display text-2xl">{ZODIAC_INFO[me.zodiac].name}</p>
            <p className="text-sm text-mist">One step left: your type.</p>
          </div>
          <button className="btn btn-gold px-4" onClick={() => onPick("mbti")}>
            Type
          </button>
        </div>
      ) : (
        <button onClick={() => onPick("zodiac")} className="tarot flex w-full items-center gap-4 p-4 text-left">
          <Sigil zodiac={null} size={56} />
          <span className="flex-1">
            <span className="block font-display text-2xl text-gold-bright">Who are you tonight?</span>
            <span className="block text-sm text-mist">Choose your sign and type to receive a character.</span>
          </span>
          <span className="text-2xl text-gold" aria-hidden="true">
            →
          </span>
        </button>
      )}
    </div>
  );
}

function ReadyButton({ me, onPick }: { me: Member; onPick: () => void }) {
  if (!me.zodiac || !me.mbti) {
    return (
      <button className="btn btn-ghost w-full sm:w-auto sm:min-w-48" onClick={onPick}>
        Choose character
      </button>
    );
  }
  const ready = me.stage === "READY";
  return (
    <button
      className={`btn w-full sm:w-auto sm:min-w-48 ${ready ? "btn-ghost border-moss text-moss" : "btn-signal"}`}
      aria-pressed={ready}
      onClick={() => sendLobby({ type: "SET_READY", ready: !ready })}
    >
      {ready ? "✓ Ready (tap to undo)" : "I'm ready"}
    </button>
  );
}

const SCENARIOS = Array.from({ length: 10 }, (_, i) => i + 1);

function ScenarioStrip() {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="label mb-3 text-gold">Scenario</p>
      <div className="tarot overflow-hidden p-4">
        <p className="font-mono text-xs text-signal">01 · ROUTE N13</p>
        <p className="mt-1 font-display text-2xl leading-tight font-semibold">00:17 — The Last Train That Doesn't Exist</p>
        <p className="mt-2 text-sm text-mist italic">"All passengers without names, prepare for ticket inspection."</p>
        <p className="mt-3 text-xs text-ash">2–10 players · 12 rounds · cooperative</p>
      </div>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Other scenarios">
        {SCENARIOS.slice(1).map((n) => (
          <li key={n} className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-indigo text-center">
            <span className="font-mono text-sm text-ash">{String(n).padStart(2, "0")}</span>
            <span className="text-[8px] font-bold tracking-wider text-ash">COMING SOON</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PassengerSheet({ member, me, onClose }: { member: Member; me: Member; onClose: () => void }) {
  const live = useStore((s) => s.snapshot?.room.members.find((m) => m.playerId === member.playerId)) ?? null;
  const m = live ?? member;
  const canKick = me.isHost && m.playerId !== me.playerId && !!live;
  return (
    <motion.div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${m.nickname}'s ticket`}
        className="tarot safe-bottom relative w-full max-w-md rounded-b-none px-5 pt-6 sm:rounded-b-[var(--r-md)] sm:pb-6"
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label">
              Seat {m.seat + 1}
              {m.isHost && " · Host"}
              {m.playerId === me.playerId && " · You"}
            </p>
            <h2 className="font-display text-3xl font-semibold">{m.nickname}</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider ${m.stage === "READY" ? "bg-moss/15 text-moss" : "bg-indigo/60 text-mist"}`}>
            {m.stage === "READY" ? "✓ READY" : "NOT READY"}
          </span>
        </div>
        {m.zodiac && m.mbti ? (
          <CharacterCard zodiac={m.zodiac} mbti={m.mbti} />
        ) : (
          <p className="text-mist">
            {m.zodiac ? `${ZODIAC_INFO[m.zodiac].name}, still choosing a type.` : "Still choosing a sign."}
            {m.mbti && ` ${MBTI_INFO[m.mbti].title}`}
          </p>
        )}
        {!m.connected && <p className="mt-3 text-sm text-ember">Offline. Their seat is kept until they return.</p>}
        <div className="mt-5 flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={onClose}>
            Close
          </button>
          {canKick && (
            <button
              className="btn flex-1 border border-ember/60 text-ember hover:bg-ember/10"
              onClick={async () => {
                if (confirm(`Remove ${m.nickname} from the room?`) && (await sendLobby({ type: "KICK", playerId: m.playerId }))) onClose();
              }}
            >
              Remove from room
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
