"use client";

import { useEffect, useRef } from "react";
import type { DebateMessage, ModelConfig } from "@/lib/types";
import { ChatBubble } from "./ChatBubble";
import { TypingIndicator } from "./TypingIndicator";
import { PromptComposer } from "./PromptComposer";
import { Swords } from "lucide-react";

export function DebateTranscript({
  messages,
  isRunning,
  currentSpeaker,
  currentSpeakerModel,
  prompt,
  onPromptChange,
  onSubmit,
  onStop,
  canStart,
  showComposer,
}: {
  messages: DebateMessage[];
  isRunning: boolean;
  currentSpeaker: string | null;
  currentSpeakerModel: ModelConfig | null;
  prompt: string;
  onPromptChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  canStart: boolean;
  showComposer: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const streaming = messages.some((m) => m.streaming && m.content);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isRunning, currentSpeaker]);

  const empty = messages.length === 0 && !isRunning;

  return (
    <div className="flex flex-col gap-5 py-4">
      {empty ? (
        <div className="flex flex-col items-center gap-6 px-2 pb-2 pt-6 text-center sm:pt-10">
          <div className="animate-fade-up flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-xl shadow-stone-900/20">
            <Swords className="h-7 w-7" />
          </div>
          <div className="animate-fade-up max-w-md space-y-2" style={{ animationDelay: "60ms" }}>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              Viewpoint Arena
            </h2>
            <p className="text-sm leading-relaxed text-stone-500 sm:text-[15px]">
              Four models. One contentious question. Watch each reveal the lean
              baked into its training — live, round by round.
            </p>
          </div>
          {showComposer && (
            <div className="animate-fade-up w-full" style={{ animationDelay: "120ms" }}>
              <PromptComposer
                value={prompt}
                onChange={onPromptChange}
                onSubmit={onSubmit}
                onStop={onStop}
                isRunning={isRunning}
                canStart={canStart}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
          {isRunning &&
            currentSpeaker &&
            currentSpeakerModel &&
            !messages.some((m) => m.streaming) && (
              <TypingIndicator
                label={currentSpeaker}
                color={currentSpeakerModel.color}
                provider={currentSpeakerModel.provider}
              />
            )}
          {isRunning && streaming && <div className="h-2" />}
          <div ref={bottomRef} />
        </>
      )}
    </div>
  );
}
