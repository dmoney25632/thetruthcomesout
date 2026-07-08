"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ApiKeys,
  DebateMessage,
  DebateSettings,
  ModelConfig,
  StreamEvent,
} from "@/lib/types";
import { MAX_ROUNDS } from "@/lib/types";
import { shuffle } from "@/lib/utils";
import {
  buildExportPayload,
  exportAsJson,
  exportAsMarkdown,
} from "@/lib/export";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readSseTurn(
  res: Response,
  onToken: (text: string) => void
): Promise<{ content: string; error?: string; errorCode?: string }> {
  if (!res.body) {
    // Fallback: non-streaming JSON
    const data = await res.json();
    if (data.error) {
      return { content: "", error: data.error, errorCode: data.errorCode };
    }
    return { content: data.content ?? "" };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let error: string | undefined;
  let errorCode: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      let event: StreamEvent;
      try {
        event = JSON.parse(raw) as StreamEvent;
      } catch {
        continue;
      }

      if (event.type === "token") {
        content += event.text;
        onToken(event.text);
      } else if (event.type === "done") {
        content = event.content || content;
      } else if (event.type === "error") {
        error = event.error;
        errorCode = event.errorCode;
      }
    }
  }

  return { content, error, errorCode };
}

export function useDebate() {
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [currentSpeakerModel, setCurrentSpeakerModel] =
    useState<ModelConfig | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [order, setOrder] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSettingsRef = useRef<{
    prompt: string;
    rounds: number;
    charLimit: number;
  } | null>(null);

  const stop = useCallback(() => {
    abortRef.current = true;
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setCurrentSpeaker(null);
    setCurrentSpeakerModel(null);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  }, []);

  const estimateUsage = useCallback(
    (settings: DebateSettings, models: ModelConfig[]) => {
      const enabled = models.filter((m) => m.enabled);
      const rounds = Math.min(MAX_ROUNDS, Math.max(1, settings.rounds));
      let total = 0;
      let historyChars = settings.prompt.length;
      for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < enabled.length; i++) {
          total += Math.ceil(historyChars / 4);
          total += Math.ceil(settings.charLimit / 4);
          historyChars += settings.charLimit + 80;
        }
      }
      return total;
    },
    []
  );

  const start = useCallback(
    async (
      settings: DebateSettings,
      models: ModelConfig[],
      apiKeys: ApiKeys
    ) => {
      const enabled = models.filter((m) => m.enabled);
      if (enabled.length < 2) {
        setError("Select at least 2 models.");
        return;
      }
      if (!settings.prompt.trim()) {
        setError("Enter a debate prompt.");
        return;
      }

      const rounds = Math.min(MAX_ROUNDS, Math.max(1, settings.rounds));
      const shuffled = shuffle(enabled);
      abortRef.current = false;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setError(null);
      setIsRunning(true);
      setTotalTokensUsed(0);
      setCurrentRound(1);
      setTotalRounds(rounds);
      setCurrentSpeakerModel(null);
      setOrder(shuffled.map((m) => m.label));
      lastSettingsRef.current = {
        prompt: settings.prompt.trim(),
        rounds,
        charLimit: settings.charLimit,
      };

      const promptMsg: DebateMessage = {
        id: uid(),
        role: "user",
        content: settings.prompt.trim(),
        timestamp: new Date().toISOString(),
      };

      let transcript: DebateMessage[] = [promptMsg];
      setMessages(transcript);

      const apiHistory: {
        role: "user" | "assistant" | "system";
        content: string;
      }[] = [{ role: "user", content: settings.prompt.trim() }];

      try {
        for (let round = 1; round <= rounds; round++) {
          setCurrentRound(round);
          for (const model of shuffled) {
            if (abortRef.current) break;

            setCurrentSpeaker(model.label);
            setCurrentSpeakerModel(model);

            const msgId = uid();
            // Brief "typing" beat before the stream starts — feels live
            const typingPlaceholder: DebateMessage = {
              id: msgId,
              role: "assistant",
              content: "",
              modelId: model.id,
              modelLabel: model.label,
              provider: model.provider,
              color: model.color,
              accent: model.accent,
              round,
              timestamp: new Date().toISOString(),
              streaming: true,
            };

            transcript = [...transcript, typingPlaceholder];
            setMessages(transcript);

            await new Promise((r) => setTimeout(r, 450));
            if (abortRef.current) break;

            const modelId =
              settings.demoMode
                ? model.demoModel || model.modelName
                : model.modelName || model.defaultModel;

            let turnContent = "";
            let turnError: string | undefined;

            try {
              const res = await fetch("/api/debate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                  provider: model.provider,
                  model: modelId,
                  apiKey: apiKeys[model.provider],
                  messages: apiHistory,
                  charLimit: settings.charLimit,
                  speakerLabel: `${model.label} (${modelId})`,
                  stream: true,
                }),
              });

              // Non-SSE error (validation) before stream starts
              const contentType = res.headers.get("content-type") ?? "";
              if (!contentType.includes("text/event-stream")) {
                const data = await res.json().catch(() => ({}));
                turnError =
                  data.error ||
                  `Request failed (${res.status})`;
              } else {
                const result = await readSseTurn(res, (text) => {
                  turnContent += text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === msgId
                        ? { ...m, content: turnContent, streaming: true }
                        : m
                    )
                  );
                });

                if (result.error) {
                  turnError = result.error;
                  turnContent = result.content || turnContent;
                } else {
                  turnContent = result.content || turnContent;
                }
              }
            } catch (err) {
              if (abortRef.current || (err instanceof DOMException && err.name === "AbortError")) {
                break;
              }
              turnError =
                err instanceof Error ? err.message : "Network error calling provider";
            }

            if (abortRef.current) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId
                    ? {
                        ...m,
                        content: turnContent || "(stopped)",
                        streaming: false,
                      }
                    : m
                )
              );
              break;
            }

            const failed = !!turnError || !turnContent.trim();
            const finalContent = failed
              ? turnError || "Empty response from model"
              : turnContent;

            const finalMsg: DebateMessage = {
              ...typingPlaceholder,
              content: finalContent,
              streaming: false,
              error: failed,
              timestamp: new Date().toISOString(),
            };

            transcript = transcript.map((m) =>
              m.id === msgId ? finalMsg : m
            );
            setMessages(transcript);

            apiHistory.push({
              role: "assistant",
              content: failed
                ? `[${model.label} ERROR]: ${finalContent}`
                : `[${model.label}]: ${turnContent}`,
            });

            // Rough token tally from chars for UI
            if (!failed) {
              setTotalTokensUsed((t) => t + Math.ceil(turnContent.length / 4));
            }
          }
          if (abortRef.current) break;
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Debate failed");
        }
      } finally {
        setIsRunning(false);
        setCurrentSpeaker(null);
        setCurrentSpeakerModel(null);
        abortControllerRef.current = null;
      }
    },
    []
  );

  const loadMessages = useCallback(
    (
      next: DebateMessage[],
      meta?: { order?: string[]; rounds?: number; prompt?: string; charLimit?: number }
    ) => {
      if (isRunning) return;
      setMessages(next);
      setOrder(meta?.order ?? []);
      setCurrentRound(0);
      setTotalRounds(meta?.rounds ?? 0);
      setError(null);
      if (meta?.prompt) {
        lastSettingsRef.current = {
          prompt: meta.prompt,
          rounds: meta.rounds ?? 1,
          charLimit: meta.charLimit ?? 600,
        };
      }
    },
    [isRunning]
  );

  const clear = useCallback(() => {
    if (isRunning) return;
    setMessages([]);
    setOrder([]);
    setError(null);
    setTotalTokensUsed(0);
    setCurrentRound(0);
    setTotalRounds(0);
    setCurrentSpeakerModel(null);
  }, [isRunning]);

  const doExportJson = useCallback(() => {
    const s = lastSettingsRef.current;
    if (!s || messages.length === 0) return;
    exportAsJson(
      buildExportPayload(s.prompt, s.rounds, s.charLimit, order, messages)
    );
  }, [messages, order]);

  const doExportMd = useCallback(() => {
    const s = lastSettingsRef.current;
    if (!s || messages.length === 0) return;
    exportAsMarkdown(
      buildExportPayload(s.prompt, s.rounds, s.charLimit, order, messages)
    );
  }, [messages, order]);

  return {
    messages,
    isRunning,
    currentSpeaker,
    currentSpeakerModel,
    currentRound,
    totalRounds,
    order,
    error,
    totalTokensUsed,
    start,
    stop,
    clear,
    loadMessages,
    estimateUsage,
    doExportJson,
    doExportMd,
    canExport: messages.length > 0 && !isRunning,
    lastSettings: lastSettingsRef,
  };
}
