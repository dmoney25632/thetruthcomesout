"use client";

import type { ProviderId } from "@/lib/types";
import { ModelAvatar } from "./ModelAvatar";

export function TypingIndicator({
  label,
  color,
  provider,
}: {
  label: string;
  color: string;
  provider?: ProviderId;
}) {
  return (
    <article className="animate-fade-up mx-auto flex w-full max-w-3xl gap-3 px-1">
      {provider ? (
        <ModelAvatar provider={provider} color={color} pulse />
      ) : (
        <div
          className="h-9 w-9 shrink-0 rounded-full animate-soft-pulse"
          style={{ backgroundColor: color }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color }}>
            {label}
          </span>
          <span className="text-[11px] text-stone-400">preparing a response</span>
        </div>
        <div
          className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm"
          style={{
            backgroundColor: `${color}14`,
            borderColor: `${color}28`,
          }}
        >
          <span className="typing-dot" style={{ backgroundColor: color }} />
          <span className="typing-dot" style={{ backgroundColor: color }} />
          <span className="typing-dot" style={{ backgroundColor: color }} />
        </div>
      </div>
    </article>
  );
}
