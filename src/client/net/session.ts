// What this device remembers: an anonymous identity token (so a refresh or a
// visit tomorrow returns to the same seat), the last nickname and the last
// room. Never game state. Storage can be unavailable (private mode), so every
// access is guarded and the app still works without it, minus resume.
const KEY_TOKEN = "fate:token";
const KEY_NICK = "fate:nickname";
const KEY_ROOM = "fate:lastRoom";

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: resume won't survive a reload, everything else works */
  }
};

let memoryToken: string | null = null;

export const session = {
  token: (): string | null => read(KEY_TOKEN) ?? memoryToken,
  setToken: (token: string) => {
    memoryToken = token;
    write(KEY_TOKEN, token);
  },
  nickname: (): string => read(KEY_NICK) ?? "",
  setNickname: (n: string) => write(KEY_NICK, n),
  lastRoom: (): string | null => read(KEY_ROOM),
  setLastRoom: (code: string | null) => write(KEY_ROOM, code),
};
