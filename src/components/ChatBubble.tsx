"use client";

import type { DebateMessage } from "@/lib/types";
import { formatTimestamp } from "@/lib/utils";
import { ModelAvatar } from "./ModelAvatar";
import { TypingIndicator } from "./TypingIndicator";
import { AlertCircle } from "lucide-react";

export function ChatBubble({ message }: { message: DebateMessage }) {
  if (message.role === "user") {
    const isTwist = message.kind === "twist";
    return (
      <div className="animate-fade-up mx-auto w-full max-w-3xl px-1">
        <div
          className={`relative overflow-hidden rounded-2xl border px-5 py-4 shadow-lg ${
            isTwist
              ? "border-amber-700/20 bg-amber-950 text-amber-50 shadow-amber-950/10"
              : "border-stone-800/10 bg-stone-900 text-stone-50 shadow-stone-900/10"
          }`}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
          <div className="mb-2 flex items-center justify-between gap-3">
            <span
              className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                isTwist ? "text-amber-400/80" : "text-stone-400"
              }`}
            >
              {isTwist ? "The twist" : "The motion"}
            </span>
            <time
              className={`text-xs ${isTwist ? "text-amber-500/70" : "text-stone-500"}`}
            >
              {formatTimestamp(message.timestamp)}
            </time>
          </div>
          <p
            className={`relative whitespace-pre-wrap font-display leading-snug tracking-tight ${
              isTwist
                ? "text-base text-amber-50 sm:text-lg"
                : "text-lg text-stone-50 sm:text-xl"
            }`}
          >
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  const color = message.color ?? "#78716c";
  const accent = message.accent ?? "#f5f5f4";

  // Empty streaming bubble → typing indicator
  if (message.streaming && !message.content && message.provider) {
    return (
      <TypingIndicator
        label={message.modelLabel ?? "Model"}
        color={color}
        provider={message.provider}
      />
    );
  }

  return (
    <article className="animate-fade-up mx-auto flex w-full max-w-3xl gap-3 px-1">
      {message.provider && (
        <ModelAvatar
          provider={message.provider}
          color={color}
          pulse={!!message.streaming}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold" style={{ color }}>
            {message.modelLabel ?? "Model"}
          </span>
          {message.round != null && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              style={{ backgroundColor: accent, color }}
            >
              Round {message.round}
            </span>
          )}
          <time className="ml-auto text-xs text-stone-400">
            {formatTimestamp(message.timestamp)}
          </time>
        </div>
        <div
          className="rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm"
          style={{
            backgroundColor: accent,
            borderColor: `${color}30`,
            boxShadow: `0 1px 0 ${color}10`,
          }}
        >
          {message.error ? (
            <p className="flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="whitespace-pre-wrap">{message.content}</span>
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800">
              {message.content}
              {message.streaming && (
                <span
                  className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-pulse align-baseline"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
              )}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
