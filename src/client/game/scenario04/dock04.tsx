import { useState } from "react";
import type { GameAction } from "../../../shared/game/actions.ts";
import { LOTS04 } from "../../../shared/game/scenario04/lots.ts";
import type { LotId04 } from "../../../shared/game/scenario04/types.ts";
import type { PlayerView } from "../../../shared/game/state.ts";
import { auctionIntelText, auctionLotText } from "../../../shared/i18n/scenario04.ts";
import { useLocale, useT } from "../../i18n/index.ts";
import { PeopleRow, type DockExtension } from "../Dock.tsx";

function BidChoices({ bids, send }: { bids: number[]; send: (action: GameAction) => void }) {
  const t = useT();
  return bids.length ? <div data-s4-picker="BID" className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
    {bids.map((amount) => <button key={amount} className="btn btn-gold min-h-12 min-w-0" onClick={() => send({ type: "BID", amount })}>{amount}</button>)}
  </div> : <p className="text-sm text-mist">{t("s4.dock.noBid")}</p>;
}

export const DOCK04: DockExtension = {
  grid: ["BID", "PASS", "INVESTIGATE", "READ", "DEAL", "CHALLENGE", "SABOTAGE", "BORROW", "EXPOSE", "RECOVER"],
  coreActions: ["BID", "PASS"],
  direct: new Set(["PASS", "INVESTIGATE", "BORROW", "RECOVER", "END_TURN"]),
  columns: "lg:grid-cols-5",
  itemAction: "USE_LOT",
  hudClassName: "flex min-w-0 justify-center lg:justify-self-center",
  picker: ({ g, mode, availability, send }) => {
    if (mode === "BID") return { title: "s4.dock.pickBid", body: <BidChoices bids={(availability.targets ?? []).map(Number)} send={send} /> };
    if (mode === "READ" || mode === "SABOTAGE") return { title: mode === "READ" ? "s4.dock.read" : "s4.dock.sabotage", body: <TargetChoice g={g} ids={(availability.targets ?? []).map(String)} send={send} mode={mode} /> };
    if (mode === "DEAL") return { title: "s4.dock.deal", body: <DealBuilder g={g} send={send} /> };
    if (mode === "CHALLENGE") return { title: "s4.dock.challenge", body: <ChallengeBuilder g={g} ids={(availability.targets ?? []).map(String)} send={send} /> };
    if (mode === "EXPOSE") return { title: "s4.dock.expose", body: <ExposeChoices ids={(availability.targets ?? []).map(String)} send={send} /> };
    if (mode === "USE_LOT") return { title: "s4.dock.items", body: <ItemChoices g={g} send={send} /> };
    return null;
  },
};

function ItemChoices({ g, send }: { g: PlayerView; send: (action: GameAction) => void }) {
  const t = useT();
  const locale = useLocale();
  const a = g.auction!;
  const mine = a.players[g.viewerId];
  const known = [...(mine.privateIntel ?? []), ...a.publicIntel];
  const used = (id: LotId04) => Object.values(a.players).some((p) => p.usedLotEffects.includes(id));
  return <div data-s4-picker="USE_LOT" className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto">
    {mine.items.map((id) => {
      const lot = LOTS04.find((entry) => entry.id === id)!;
      const counterfeit = lot.tags.includes("COUNTERFEIT");
      const status = counterfeit ? known.includes(lot.hiddenInfo) || known.includes(lot.perfectInfo) ? "counterfeit" : "unverified"
        : used(id) || id === "LOT_04" && mine.redContractRemainingRounds === 0 ? "used"
        : ["LOT_04", "LOT_08"].includes(id) ? "passive" : "available";
      const actionable = ["LOT_02", "LOT_06", "LOT_09"].includes(id) && !used(id) && (id !== "LOT_06" || mine.debt > 0) && (id !== "LOT_09" || g.players[g.viewerId].sanity > 0);
      const text = auctionLotText(locale, id);
      return <button key={id} className="btn btn-ghost min-h-12 h-auto min-w-0 flex-col items-start whitespace-normal text-left" disabled={!actionable} onClick={() => send({ type: "USE_LOT", lotId: id })}>
        <span className="font-semibold">{text.name} · {t(`s4.item.${status}`)}</span>
        <span className="text-xs text-mist">{text.description}</span>
      </button>;
    })}
  </div>;
}

function TargetChoice({ g, ids, send, mode }: { g: PlayerView; ids: string[]; send: (action: GameAction) => void; mode: "READ" | "SABOTAGE" }) {
  return <div data-s4-picker={mode}><PeopleRow people={ids.map((id) => g.players[id])} onPick={(targetId) => send({ type: mode, targetId })} /></div>;
}

function ExposeChoices({ ids, send }: { ids: string[]; send: (action: GameAction) => void }) {
  const locale = useLocale();
  return <div data-s4-picker="EXPOSE" className="grid grid-cols-1 gap-2">{ids.map((id) => <button key={id} className="btn btn-ghost min-h-12 h-auto min-w-0 whitespace-normal text-left" onClick={() => send({ type: "EXPOSE", intelId: id })}>{auctionIntelText(locale, id as `${`LOT_${string}`}_${string}`)}</button>)}</div>;
}

function ChallengeBuilder({ g, ids, send }: { g: PlayerView; ids: string[]; send: (action: GameAction) => void }) {
  const t = useT();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [wager, setWager] = useState(1);
  const max = g.auction!.players[g.viewerId].blackChips ?? 0;
  return <div data-s4-picker="CHALLENGE" className="grid grid-cols-1 gap-2">
    <p className="label">{t("s4.dock.target")}</p>
    <PeopleRow people={ids.map((id) => g.players[id])} selected={targetId ? [targetId] : []} onPick={setTargetId} />
    <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">{Array.from({ length: max }, (_, i) => i + 1).map((n) => <button key={n} className={`btn min-h-12 ${wager === n ? "btn-gold" : "btn-ghost"}`} onClick={() => setWager(n)}>{t("s4.dock.wager", { n })}</button>)}</div>
    <button className="btn btn-gold min-h-12" disabled={!targetId || max < 1} onClick={() => targetId && send({ type: "CHALLENGE", targetId, wager })}>{t("s4.dock.submitChallenge")}</button>
  </div>;
}

function DealBuilder({ g, send }: { g: PlayerView; send: (action: GameAction) => void }) {
  const t = useT();
  const locale = useLocale();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [kind, setKind] = useState<"PASS" | "INTEL" | "SELL_ITEM" | "BUY_ITEM">("PASS");
  const [amount, setAmount] = useState(1);
  const [asset, setAsset] = useState<string | null>(null);
  const mine = g.auction!.players[g.viewerId];
  const target = targetId ? g.auction!.players[targetId] : null;
  const ownIntel = mine.privateIntel ?? [];
  const ownItems = mine.items.filter((id) => LOTS04.find((lot) => lot.id === id)?.transferable);
  const theirItems = (target?.items ?? []).filter((id) => LOTS04.find((lot) => lot.id === id)?.transferable);
  const items = kind === "INTEL" ? ownIntel : kind === "SELL_ITEM" ? ownItems : kind === "BUY_ITEM" ? theirItems : [];
  const pay = kind === "PASS" || kind === "BUY_ITEM" ? amount : 0;
  const receive = kind === "INTEL" || kind === "SELL_ITEM" ? amount : 0;
  const label = kind === "PASS" ? t("s4.decision.pass") : asset ? kind === "INTEL" ? auctionIntelText(locale, asset as `${`LOT_${string}`}_${string}`) : auctionLotText(locale, asset as `LOT_${string}`).name : "·";
  const max = kind === "PASS" || kind === "BUY_ITEM" ? mine.blackChips ?? 0 : 8;
  return <div data-s4-picker="DEAL" className="grid grid-cols-1 gap-2">
    <p className="label">{t("s4.dock.target")}</p>
    <PeopleRow people={g.auction!.seatOrder.filter((id) => id !== g.viewerId).map((id) => g.players[id])} selected={targetId ? [targetId] : []} onPick={(id) => { setTargetId(id); setAsset(null); }} />
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["PASS", "INTEL", "SELL_ITEM", "BUY_ITEM"] as const).map((value) => <button key={value} className={`btn min-h-12 h-auto min-w-0 whitespace-normal text-xs ${kind === value ? "btn-gold" : "btn-ghost"}`} onClick={() => { setKind(value); setAsset(null); }}>{t(value === "PASS" ? "s4.dock.payPass" : value === "INTEL" ? "s4.dock.sellIntel" : value === "SELL_ITEM" ? "s4.dock.sellItem" : "s4.dock.buyItem")}</button>)}</div>
    {kind !== "PASS" && <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">{items.map((id) => <button key={id} className={`btn min-h-12 h-auto min-w-0 whitespace-normal text-xs ${asset === id ? "btn-gold" : "btn-ghost"}`} onClick={() => setAsset(id)}>{kind === "INTEL" ? auctionIntelText(locale, id as `${`LOT_${string}`}_${string}`) : auctionLotText(locale, id).name}</button>)}</div>}
    <p className="label">{t("s4.dock.chips")}</p>
    <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">{Array.from({ length: Math.min(max, 20) }, (_, i) => i + 1).map((n) => <button key={n} className={`btn min-h-12 ${amount === n ? "btn-gold" : "btn-ghost"}`} onClick={() => setAmount(n)}>{n}</button>)}</div>
    <p className="text-xs text-mist">{t("s4.dock.terms", { from: g.players[g.viewerId].nickname, pay, to: targetId ? g.players[targetId].nickname : "?", receive, asset: label })}</p>
    <button className="btn btn-gold min-h-12" disabled={!targetId || amount > max || (kind !== "PASS" && !asset)} onClick={() => {
      if (!targetId) return;
      send({ type: "DEAL", targetId, chips: pay, receiveChips: receive, forPass: kind === "PASS", giveIntel: kind === "INTEL" ? asset! : undefined, giveItem: kind === "SELL_ITEM" ? asset! : undefined, forItem: kind === "BUY_ITEM" ? asset! : undefined });
    }}>{t("s4.dock.submitDeal")}</button>
  </div>;
}
