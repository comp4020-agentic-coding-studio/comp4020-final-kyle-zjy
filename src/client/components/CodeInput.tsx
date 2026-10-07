// Six split-flap cells backed by one real <input>, so paste, autofill,
// keyboards and screen readers all behave like a normal text field.
import { useRef } from "react";
import { ROOM_CODE_LENGTH } from "../../shared/protocol.ts";

const clean = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);

export function CodeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(clean(e.target.value))}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={ROOM_CODE_LENGTH}
        aria-label="Room code, 6 characters"
        className="peer absolute inset-0 h-full w-full cursor-text opacity-0"
      />
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2" aria-hidden="true">
        {Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => {
          const ch = value[i];
          const active = i === Math.min(value.length, ROOM_CODE_LENGTH - 1);
          return (
            <div
              key={i}
              className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md border bg-[#070914] font-mono text-2xl sm:text-3xl ${
                active ? "border-gold peer-focus:border-gold" : "border-indigo"
              }`}
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-black/60" />
              <span className={ch ? "led-amber" : "text-ash/40"}>{ch ?? "·"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
