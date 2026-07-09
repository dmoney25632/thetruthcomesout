"use client";

import { EXAMPLE_PROMPTS } from "@/lib/models";
import { Play, Square, Shuffle } from "lucide-react";
import { useRef } from "react";

export function PromptComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isRunning,
  canStart,
  disabled,
  mode = "start",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isRunning: boolean;
  canStart: boolean;
  disabled?: boolean;
  /** `continue` = add a twist and run more rounds */
  mode?: "start" | "continue";
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isContinue = mode === "continue";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_8px_30px_rgba(28,25,23,0.06)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-300 to-transparent" />
        <label htmlFor="arena-prompt" className="sr-only">
          {isContinue ? "Debate twist" : "Debate prompt"}
        </label>
        {isContinue && (
          <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-amber-700/80 sm:px-5">
            Continue with a twist
            <span className="ml-2 font-normal normal-case tracking-normal text-stone-400">
              · uses Rounds from settings for more turns
            </span>
          </p>
        )}
        <textarea
          id="arena-prompt"
          ref={textareaRef}
          rows={isContinue ? 2 : 3}
          value={value}
          disabled={isRunning || disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canStart && !isRunning) onSubmit();
            }
          }}
          placeholder={
            isContinue
              ? "Add a new angle, constraint, or revelation — then keep debating…"
              : "Pose a contentious question — politics, ideology, tech, culture…"
          }
          className="w-full resize-none bg-transparent px-4 pb-3 pt-3 text-[15px] leading-relaxed text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-60 sm:px-5"
        />
        <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-3 py-2.5 sm:px-4">
          <p className="hidden text-[11px] text-stone-400 sm:block">
            <kbd className="rounded border border-stone-200 bg-stone-50 px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            {isContinue ? "continue" : "start"} ·{" "}
            <kbd className="rounded border border-stone-200 bg-stone-50 px-1 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>{" "}
            stop · Shift+Enter for newline
          </p>
          <p className="text-[11px] text-stone-400 sm:hidden">
            Enter to {isContinue ? "continue" : "start"}
          </p>
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop
            </button>
          ) : isContinue ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canStart}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Continue debate
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canStart}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Start debate
            </button>
          )}
        </div>
      </div>

      {!isRunning && !isContinue && !value.trim() && (
        <div className="animate-fade-up space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Try a spark
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex.text}
                type="button"
                onClick={() => {
                  onChange(ex.text);
                  textareaRef.current?.focus();
                }}
                className="group max-w-full rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-left text-xs text-stone-600 shadow-sm transition hover:border-stone-300 hover:bg-white hover:text-stone-900"
              >
                <span className="mr-1.5 font-semibold text-stone-400 group-hover:text-stone-500">
                  {ex.tag}
                </span>
                <span className="line-clamp-1 sm:line-clamp-none">{ex.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
