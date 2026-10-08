// What only you know: your obsession, dream cards, the round-5 message and
// anything your ability let you peek at. Sent to you and nobody else.
import type { PlayerView } from "../../shared/game/state.ts";
import { useFormat, useScenario02Text, useScenarioText, useT } from "../i18n/index.ts";
import { ZONES } from "../../shared/game/scenario02/map.ts";
import { NPCS } from "../../shared/game/scenario02/npcs.ts";
import { Drawer } from "./Drawer.tsx";

export function SecretsDrawer({ g, onClose }: { g: PlayerView; onClose: () => void }) {
  const s = g.mySecrets;
  const t = useT();
  const fmt = useFormat();
  const text = useScenarioText();
  const city = useScenario02Text();
  return (
    <Drawer title={t("secrets.title")} onClose={onClose}>
      {s && (
        <div className="space-y-4">
          {s.obsession && (
            <section className="tarot p-3">
              <p className="label text-gold">{t("secrets.obsession")}</p>
              <p className="mt-1 font-display text-xl">{text.obsessions[s.obsession].name}</p>
              <p className="text-sm text-mist">{text.obsessions[s.obsession].text}</p>
              <p className="mt-1 text-xs text-ash">{t("secrets.obsessionNote")}</p>
            </section>
          )}
          {g.city ? (
            <>
              <section className="tarot p-3">
                <p className="label text-gold">{t("s2.secrets.passes")}</p>
                <p className="mt-1 font-display text-2xl text-gold-bright">{g.city.holdings[g.viewerId]?.passes ?? 0}</p>
                <p className="text-xs text-mist">{t("s2.secrets.passesNote")}</p>
                <p className="label mt-3 text-gold">{t("s2.secrets.parts")}</p>
                <p className="mt-1 text-sm text-moon">{(g.city.holdings[g.viewerId]?.parts ?? []).map((p) => city.parts[p].name).join(t("common.listSep")) || t("s2.secrets.none")}</p>
              </section>
              <Section title={t("s2.secrets.intel")} empty={t("s2.secrets.intelEmpty")} items={s.peeks.map((p) => ({ id: p.id, text: fmt(p.text), meta: t("secrets.round", { n: p.round }) }))} />
              <Section
                title={t("s2.secrets.shared")}
                empty={t("s2.secrets.sharedEmpty")}
                items={g.city.shared.map((x, i) => ({ id: `shared-${i}`, text: t("s2.secrets.sharedBy", { name: g.players[x.from]?.nickname ?? "?", text: fmt(x.text) }), meta: t("secrets.round", { n: x.round }) }))}
              />
              <Section
                title={t("s2.secrets.passInfo")}
                empty=""
                items={[
                  { id: "out", text: t("s2.secrets.passesOut", { n: g.city.passesOut }) },
                  { id: "office", text: g.city.officePasses === null ? t("s2.secrets.officeClosed") : t("s2.secrets.officeLeft", { n: g.city.officePasses }) },
                  { id: "known", text: t("s2.secrets.knownSources", { n: g.city.knownPassSources }) },
                ]}
              />
              <Section
                title={t("s2.secrets.people")}
                empty=""
                items={g.city.npcs.map((n) => ({
                  id: n.id,
                  text: t("s2.secrets.person", { name: city.npcs[n.id].name, zone: city.zones[ZONES[n.zone].id].name, reward: t(`s2.reward.${NPCS.find((d) => d.id === n.id)!.reward}`) }),
                  meta: t(`s2.npc.${n.state}`),
                }))}
              />
            </>
          ) : (
            <>
              <Section title={t("secrets.messages")} empty={t("secrets.messagesEmpty")} items={s.messages.map((m) => ({ id: m.id, text: fmt(m.text), meta: t("secrets.round", { n: m.round }) }))} />
              <Section title={t("secrets.dreams")} empty={t("secrets.dreamsEmpty")} items={s.dreamCards.map((d) => ({ id: d.id, text: fmt(d.text) }))} />
              <Section title={t("secrets.glimpses")} empty={t("secrets.glimpsesEmpty")} items={s.peeks.map((p) => ({ id: p.id, text: fmt(p.text), meta: t("secrets.round", { n: p.round }) }))} />
            </>
          )}
          {s.tasks.length > 0 && <Section title={t("secrets.tasks")} empty="" items={s.tasks.map((task) => ({ id: task.id, text: `${fmt(task.text)}${task.done ? t("secrets.done") : ""}`, meta: t("secrets.until", { n: task.untilRound }) }))} />}
          {s.allies.length > 0 && <Section title={t("secrets.allies")} empty="" items={s.allies.map((id) => ({ id, text: g.players[id]?.nickname ?? "?" }))} />}
          {g.nightRule && (
            <section>
              <p className="label">{t("secrets.rule")}</p>
              <p className="mt-1 text-sm">
                <span className="text-gold">{t("secrets.ruleName", { name: text.nightRules[g.nightRule].name })}</span> <span className="text-mist">{text.nightRules[g.nightRule].text}</span>
              </p>
            </section>
          )}
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
