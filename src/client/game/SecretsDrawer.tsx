// What only you know: your obsession, dream cards, the round-5 message and
// anything your ability let you peek at. Sent to you and nobody else.
import { NIGHT_RULES, OBSESSIONS } from "../../shared/game/scenario01/content.ts";
import type { PlayerView } from "../../shared/game/state.ts";
import { Drawer } from "./Drawer.tsx";

export function SecretsDrawer({ g, onClose }: { g: PlayerView; onClose: () => void }) {
  const s = g.mySecrets;
  return (
    <Drawer title="Only you know" onClose={onClose}>
      {s && (
        <div className="space-y-4">
          <section className="tarot p-3">
            <p className="label text-gold">Your obsession</p>
            <p className="mt-1 font-display text-xl">{OBSESSIONS[s.obsession].name}</p>
            <p className="text-sm text-mist">{OBSESSIONS[s.obsession].text}</p>
            <p className="mt-1 text-xs text-ash">Personal goal: it doesn't affect the team's escape, only your title at the end.</p>
          </section>
          <Section title="Messages" empty="Nothing yet. Round 5 brings everyone one message. Not all of them are true." items={s.messages.map((m) => ({ id: m.id, text: m.text, meta: `Round ${m.round}` }))} />
          <Section title="Dream cards" empty="Investigate the Sleeper Car to dream. Two in three dreams tell the truth." items={s.dreamCards.map((d) => ({ id: d.id, text: d.text }))} />
          <Section title="Glimpses" empty="Some abilities let you look ahead. What you see appears here." items={s.peeks.map((p) => ({ id: p.id, text: p.text, meta: `Round ${p.round}` }))} />
          {s.tasks.length > 0 && <Section title="Tasks" empty="" items={s.tasks.map((t) => ({ id: t.id, text: `${t.text}${t.done ? " (done)" : ""}`, meta: `until round ${t.untilRound}` }))} />}
          {s.allies.length > 0 && <Section title="Secret allies" empty="" items={s.allies.map((id) => ({ id, text: g.players[id]?.nickname ?? "?" }))} />}
          <section>
            <p className="label">Tonight's rule</p>
            <p className="mt-1 text-sm">
              <span className="text-gold">{NIGHT_RULES[g.nightRule].name}.</span> <span className="text-mist">{NIGHT_RULES[g.nightRule].text}</span>
            </p>
          </section>
        </div>
      )}
    </Drawer>
  );
}

function Section({ title, empty, items }: { title: string; empty: string; items: { id: string; text: string; meta?: string }[] }) {
  return (
    <section>
      <p className="label">{title}</p>
      {items.length ? (
        <ul className="mt-1 space-y-1.5">
          {items.map((i) => (
            <li key={i.id} className="rounded-lg border border-violet/30 bg-violet/5 px-3 py-2 text-sm">
              {i.text}
              {i.meta && <span className="ml-2 font-mono text-[10px] text-ash">{i.meta}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ash">{empty}</p>
      )}
    </section>
  );
}
