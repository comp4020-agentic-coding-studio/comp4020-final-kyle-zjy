// People still in the city. A few are placed each run; reaching one and
// rescuing them pays off (what they know, what they carry). An NPC whose zone
// goes under before anyone reaches them is gone.
export type NpcReward = "INTEL" | "ITEM" | "FATE" | "PASS";

export type NpcDef = { id: string; name: string; text: string; reward: NpcReward };

export const NPCS: NpcDef[] = [
  { id: "NURSE", name: "Nurse Okafor", text: "Still doing rounds. She knows which wards are dry.", reward: "ITEM" },
  { id: "FERRYMAN", name: "Old Ferryman", text: "Insists it isn't water. He knows the currents anyway.", reward: "INTEL" },
  { id: "CHILD", name: "A Child with a Torch", text: "Waiting for parents who said they'd be right back.", reward: "FATE" },
  { id: "ENGINEER", name: "Harbour Engineer", text: "Pinned under a fallen shelf, shouting directions. Has a spare boarding pass.", reward: "PASS" },
  { id: "COURIER", name: "Bike Courier", text: "Soaked, furious, still carrying the parcels.", reward: "ITEM" },
  { id: "TEACHER", name: "Ms Varga", text: "Kept her class's register. Every name ticked but one. She has a pass she won't use.", reward: "PASS" },
];
