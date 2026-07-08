"use client";

import type { ModelConfig } from "@/lib/types";
import { ModelAvatar } from "./ModelAvatar";
import { cn } from "@/lib/utils";

export function DebateProgress({
  currentRound,
  totalRounds,
  order,
  currentSpeaker,
  models,
  isRunning,
}: {
  currentRound: number;
  totalRounds: number;
  order: string[];
  currentSpeaker: string | null;
  models: ModelConfig[];
  isRunning: boolean;
}) {
  if (!isRunning && order.length === 0) return null;

  const speakerModel = models.find((m) => m.label === currentSpeaker);
  const speakerIndex = currentSpeaker
    ? order.findIndex((l) => l === currentSpeaker)
    : -1;
  const turnsDone =
    Math.max(0, currentRound - 1) * order.length + Math.max(0, speakerIndex);
  const turnsTotal = Math.max(1, totalRounds * order.length);
  const pct = isRunning
    ? Math.min(99, Math.round((turnsDone / turnsTotal) * 100))
    : 100;

  return (
    <div className="border-b border-stone-200/70 bg-white/70 px-4 py-2.5 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <span className="font-semibold tabular-nums text-stone-800">
            Round {Math.min(currentRound || 1, totalRounds)}
            <span className="font-normal text-stone-400"> / {totalRounds}</span>
          </span>
          {order.length > 0 && (
            <>
              <span className="text-stone-300">·</span>
              <span className="hidden sm:inline">
                {order.length} speakers · {pct}%
              </span>
            </>
          )}
        </div>

        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-stone-800 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {order.map((label) => {
            const m = models.find((x) => x.label === label);
            const active = isRunning && label === currentSpeaker;
            return (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-all",
                  active
                    ? "border-transparent text-white shadow-sm"
                    : "border-stone-200 bg-white text-stone-500"
                )}
                style={
                  active && speakerModel
                    ? { backgroundColor: speakerModel.color }
                    : undefined
                }
              >
                {m && (
                  <ModelAvatar
                    provider={m.provider}
                    color={active ? "rgba(255,255,255,0.25)" : m.color}
                    size="sm"
                    className={cn("!h-5 !w-5 !ring-0", active && "shadow-none")}
                    pulse={active}
                  />
                )}
                <span className="whitespace-nowrap font-medium">
                  {active ? `${label} thinking` : label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
