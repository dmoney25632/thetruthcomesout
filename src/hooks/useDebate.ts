"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiKeys,
  DebateMessage,
  DebatePace,
  DebateSettings,
  ModelConfig,
  SavedDebate,
  StreamEvent,
} from "@/lib/types";
import {
  DEFAULT_PACE,
  DEFAULT_WORD_LIMIT,
  MAX_ROUNDS,
  MAX_WORD_LIMIT,
  MIN_WORD_LIMIT,
  PACE_TIMING,
} from "@/lib/types";
import { shuffle, sleep } from "@/lib/utils";
import {
  buildExportPayload,
  exportAsJson,
  exportAsMarkdown,
} from "@/lib/export";
import {
  buildSavedDebate,
  createDebateId,
  getDebateSearchParam,
  maxRoundInMessages,
  messagesToApiHistory,
  readActiveDebateId,
  readDebateLibrary,
  removeDebate,
  setDebateSearchParam,
  upsertDebate,
  writeActiveDebateId,
} from "@/lib/debates";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Slow the visible stream so readers can keep up.
 * Preserves leading whitespace so provider chunks like " world" stay intact.
 */
async function pacedToken(
  text: string,
  onToken: (text: string) => void,
  shouldStop: () => boolean,
  streamMultiplier: number
) {
  if (!text || shouldStop()) return;

  if (streamMultiplier <= 0) {
    onToken(text);
    return;
  }

  // Keep leading whitespace as its own piece so it isn't dropped.
  const leading = text.match(/^\s+/)?.[0] ?? "";
  const rest = leading ? text.slice(leading.length) : text;
  const wordParts = rest.match(/\S+\s*/g) ?? (rest ? [rest] : []);
  const parts = leading ? [leading, ...wordParts] : wordParts;

  for (const part of parts) {
    if (shouldStop()) return;
    onToken(part);
    if (!part.trim()) continue; // don't delay on pure whitespace
    const delay = Math.min(
      90,
      Math.max(28, part.length * 6)
    ) * streamMultiplier;
    if (delay > 0) await sleep(delay);
  }
}

async function readSseTurn(
  res: Response,
  onToken: (text: string) => void,
  shouldStop: () => boolean,
  streamMultiplier: number
): Promise<{ content: string; error?: string; errorCode?: string }> {
  if (!res.body) {
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
    if (shouldStop()) break;
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
        await pacedToken(
          event.text,
          (piece) => {
            content += piece;
            onToken(piece);
          },
          shouldStop,
          streamMultiplier
        );
      } else if (event.type === "done") {
        if (event.content) content = event.content;
      } else if (event.type === "error") {
        error = event.error;
        errorCode = event.errorCode;
      }
    }
  }

  return { content, error, errorCode };
}

type ApiHistory = {
  role: "user" | "assistant" | "system";
  content: string;
}[];

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
  const [debateId, setDebateId] = useState<string | null>(null);
  const [library, setLibrary] = useState<SavedDebate[]>([]);
  const [libraryHydrated, setLibraryHydrated] = useState(false);

  const abortRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSettingsRef = useRef<{
    prompt: string;
    rounds: number;
    wordLimit: number;
  } | null>(null);
  const debateIdRef = useRef<string | null>(null);
  const createdAtRef = useRef<string | null>(null);
  const messagesRef = useRef<DebateMessage[]>([]);
  const orderRef = useRef<string[]>([]);
  const isRunningRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    debateIdRef.current = debateId;
  }, [debateId]);

  const persistActive = useCallback((id: string | null) => {
    debateIdRef.current = id;
    setDebateId(id);
    writeActiveDebateId(id);
    setDebateSearchParam(id);
  }, []);

  const saveSnapshot = useCallback(
    (opts?: {
      id?: string;
      messages?: DebateMessage[];
      order?: string[];
      prompt?: string;
      rounds?: number;
      wordLimit?: number;
    }) => {
      const s = lastSettingsRef.current;
      const id = opts?.id ?? debateIdRef.current;
      const msgs = (opts?.messages ?? messagesRef.current).filter(
        (m) => !m.streaming
      );
      if (!id || !s || msgs.length === 0) return;

      const debate = buildSavedDebate({
        id,
        prompt: opts?.prompt ?? s.prompt,
        rounds: opts?.rounds ?? s.rounds,
        wordLimit: opts?.wordLimit ?? s.wordLimit,
        order: opts?.order ?? orderRef.current,
        messages: msgs,
        createdAt: createdAtRef.current ?? undefined,
      });
      createdAtRef.current = debate.createdAt;
      setLibrary((prev) => upsertDebate(prev, debate));
    },
    []
  );

  // Hydrate library + restore last active debate (unless share hash owns the URL)
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const stored = readDebateLibrary();
      setLibrary(stored);

      const hash = window.location.hash;
      if (hash.startsWith("#d=")) {
        setLibraryHydrated(true);
        return;
      }

      const fromUrl = getDebateSearchParam();
      const fromStorage = readActiveDebateId();
      const targetId = fromUrl || fromStorage;
      const found = targetId
        ? stored.find((d) => d.id === targetId)
        : undefined;

      if (found) {
        createdAtRef.current = found.createdAt;
        lastSettingsRef.current = {
          prompt: found.prompt,
          rounds: found.rounds,
          wordLimit: found.wordLimit,
        };
        setMessages(found.messages);
        setOrder(found.order);
        setCurrentRound(maxRoundInMessages(found.messages));
        setTotalRounds(found.rounds);
        persistActive(found.id);
      } else if (fromUrl) {
        setDebateSearchParam(null);
        writeActiveDebateId(null);
      }

      setLibraryHydrated(true);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [persistActive]);

  // Autosave when a debate settles
  useEffect(() => {
    if (!libraryHydrated || isRunning || messages.length === 0) return;
    if (!debateIdRef.current || !lastSettingsRef.current) return;
    const t = window.setTimeout(() => saveSnapshot(), 350);
    return () => window.clearTimeout(t);
  }, [libraryHydrated, isRunning, messages, order, saveSnapshot]);

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
      const avgChars = settings.wordLimit * 5;
      let total = 0;
      let historyChars = settings.prompt.length;
      for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < enabled.length; i++) {
          total += Math.ceil(historyChars / 4);
          total += Math.ceil(avgChars / 4);
          historyChars += avgChars + 80;
        }
      }
      return total;
    },
    []
  );

  const runRounds = useCallback(
    async (opts: {
      speakers: ModelConfig[];
      startRound: number;
      endRound: number;
      wordLimit: number;
      pace: DebatePace;
      demoMode: boolean;
      apiKeys: ApiKeys;
      apiHistory: ApiHistory;
      transcript: DebateMessage[];
      signal: AbortSignal;
    }) => {
      let { apiHistory, transcript } = opts;
      const {
        speakers,
        startRound,
        endRound,
        wordLimit,
        pace,
        demoMode,
        apiKeys,
        signal,
      } = opts;
      const timing = PACE_TIMING[pace] ?? PACE_TIMING[DEFAULT_PACE];

      for (let round = startRound; round <= endRound; round++) {
        setCurrentRound(round);
        for (const model of speakers) {
          if (abortRef.current) break;

          setCurrentSpeaker(model.label);
          setCurrentSpeakerModel(model);

          const msgId = uid();
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

          if (timing.preTurnMs > 0) await sleep(timing.preTurnMs);
          if (abortRef.current) break;

          const modelId = demoMode
            ? model.demoModel || model.modelName
            : model.modelName || model.defaultModel;

          let turnContent = "";
          let turnError: string | undefined;

          try {
            const res = await fetch("/api/debate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal,
              body: JSON.stringify({
                provider: model.provider,
                model: modelId,
                apiKey: apiKeys[model.provider],
                messages: apiHistory,
                wordLimit,
                speakerLabel: `${model.label} (${modelId})`,
                stream: true,
              }),
            });

            const contentType = res.headers.get("content-type") ?? "";
            if (!contentType.includes("text/event-stream")) {
              const data = await res.json().catch(() => ({}));
              turnError = data.error || `Request failed (${res.status})`;
            } else {
              const result = await readSseTurn(
                res,
                (text) => {
                  turnContent += text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === msgId
                        ? { ...m, content: turnContent, streaming: true }
                        : m
                    )
                  );
                },
                () => abortRef.current,
                timing.streamMultiplier
              );

              if (result.error) {
                turnError = result.error;
                turnContent = result.content || turnContent;
              } else {
                turnContent = result.content || turnContent;
              }

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === msgId
                    ? {
                        ...m,
                        content: turnContent,
                        streaming: !turnError && !!turnContent,
                      }
                    : m
                )
              );
            }
          } catch (err) {
            if (
              abortRef.current ||
              (err instanceof DOMException && err.name === "AbortError")
            ) {
              break;
            }
            turnError =
              err instanceof Error
                ? err.message
                : "Network error calling provider";
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

          transcript = transcript.map((m) => (m.id === msgId ? finalMsg : m));
          setMessages(transcript);

          apiHistory = [
            ...apiHistory,
            {
              role: "assistant",
              content: failed
                ? `[${model.label} ERROR]: ${finalContent}`
                : `[${model.label}]: ${turnContent}`,
            },
          ];

          if (!failed) {
            setTotalTokensUsed((t) => t + Math.ceil(turnContent.length / 4));
          }

          if (!abortRef.current && timing.betweenSpeakerMs > 0) {
            await sleep(timing.betweenSpeakerMs);
          }
        }
        if (abortRef.current) break;

        if (
          round < endRound &&
          !abortRef.current &&
          timing.betweenRoundMs > 0
        ) {
          await sleep(timing.betweenRoundMs);
        }
      }

      return { transcript, apiHistory };
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
      const wordLimit = Math.min(
        MAX_WORD_LIMIT,
        Math.max(MIN_WORD_LIMIT, settings.wordLimit)
      );
      const pace = settings.pace ?? DEFAULT_PACE;
      const shuffled = shuffle(enabled);
      abortRef.current = false;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const id = createDebateId();
      const now = new Date().toISOString();
      createdAtRef.current = now;
      persistActive(id);

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
        wordLimit,
      };

      const promptMsg: DebateMessage = {
        id: uid(),
        role: "user",
        content: settings.prompt.trim(),
        kind: "motion",
        timestamp: now,
      };

      let transcript: DebateMessage[] = [promptMsg];
      setMessages(transcript);

      const apiHistory: ApiHistory = [
        { role: "user", content: settings.prompt.trim() },
      ];

      try {
        const result = await runRounds({
          speakers: shuffled,
          startRound: 1,
          endRound: rounds,
          wordLimit,
          pace,
          demoMode: settings.demoMode,
          apiKeys,
          apiHistory,
          transcript,
          signal: controller.signal,
        });
        transcript = result.transcript;
        saveSnapshot({
          id,
          messages: transcript,
          order: shuffled.map((m) => m.label),
          prompt: settings.prompt.trim(),
          rounds,
          wordLimit,
        });
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
    [persistActive, runRounds, saveSnapshot]
  );

  const continueDebate = useCallback(
    async (
      twist: string,
      settings: DebateSettings,
      models: ModelConfig[],
      apiKeys: ApiKeys
    ) => {
      const enabled = models.filter((m) => m.enabled);
      if (enabled.length < 2) {
        setError("Select at least 2 models.");
        return;
      }
      if (!twist.trim()) {
        setError("Enter a twist to continue the debate.");
        return;
      }
      if (messagesRef.current.length === 0) {
        setError("No debate to continue.");
        return;
      }

      const extraRounds = Math.min(
        MAX_ROUNDS,
        Math.max(1, settings.rounds)
      );
      const wordLimit = Math.min(
        MAX_WORD_LIMIT,
        Math.max(MIN_WORD_LIMIT, settings.wordLimit)
      );
      const pace = settings.pace ?? DEFAULT_PACE;

      // Prefer prior speaking order when models still match
      const byLabel = new Map(enabled.map((m) => [m.label, m]));
      let speakers = orderRef.current
        .map((label) => byLabel.get(label))
        .filter((m): m is ModelConfig => !!m);
      if (speakers.length < 2) {
        speakers = shuffle(enabled);
      }

      abortRef.current = false;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let id = debateIdRef.current;
      if (!id) {
        id = createDebateId();
        createdAtRef.current = new Date().toISOString();
        persistActive(id);
      }

      const basePrompt =
        lastSettingsRef.current?.prompt ??
        messagesRef.current.find((m) => m.role === "user")?.content ??
        settings.prompt.trim();

      lastSettingsRef.current = {
        prompt: basePrompt,
        rounds: (lastSettingsRef.current?.rounds ?? 0) + extraRounds,
        wordLimit,
      };

      const startRound = maxRoundInMessages(messagesRef.current) + 1;
      const endRound = startRound + extraRounds - 1;

      setError(null);
      setIsRunning(true);
      setCurrentRound(startRound);
      setTotalRounds(endRound);
      setOrder(speakers.map((m) => m.label));
      setCurrentSpeakerModel(null);

      const twistMsg: DebateMessage = {
        id: uid(),
        role: "user",
        content: twist.trim(),
        kind: "twist",
        timestamp: new Date().toISOString(),
      };

      let transcript: DebateMessage[] = [...messagesRef.current, twistMsg];
      setMessages(transcript);

      const apiHistory: ApiHistory = messagesToApiHistory(transcript);

      try {
        const result = await runRounds({
          speakers,
          startRound,
          endRound,
          wordLimit,
          pace,
          demoMode: settings.demoMode,
          apiKeys,
          apiHistory,
          transcript,
          signal: controller.signal,
        });
        transcript = result.transcript;
        saveSnapshot({
          id,
          messages: transcript,
          order: speakers.map((m) => m.label),
          prompt: basePrompt,
          rounds: lastSettingsRef.current?.rounds ?? endRound,
          wordLimit,
        });
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Continue failed");
        }
      } finally {
        setIsRunning(false);
        setCurrentSpeaker(null);
        setCurrentSpeakerModel(null);
        abortControllerRef.current = null;
      }
    },
    [persistActive, runRounds, saveSnapshot]
  );

  const loadMessages = useCallback(
    (
      next: DebateMessage[],
      meta?: {
        order?: string[];
        rounds?: number;
        prompt?: string;
        wordLimit?: number;
        debateId?: string;
        createdAt?: string;
      }
    ) => {
      if (isRunningRef.current) return;
      setMessages(next);
      setOrder(meta?.order ?? []);
      setCurrentRound(maxRoundInMessages(next));
      setTotalRounds(meta?.rounds ?? 0);
      setError(null);
      if (meta?.prompt) {
        lastSettingsRef.current = {
          prompt: meta.prompt,
          rounds: meta.rounds ?? 1,
          wordLimit: meta.wordLimit ?? DEFAULT_WORD_LIMIT,
        };
      }
      if (meta?.createdAt) createdAtRef.current = meta.createdAt;
      if (meta?.debateId) {
        persistActive(meta.debateId);
      } else if (next.length > 0) {
        // Shared / imported transcript — mint a local id so it can be continued
        const id = createDebateId();
        createdAtRef.current = new Date().toISOString();
        persistActive(id);
        if (meta?.prompt) {
          saveSnapshot({
            id,
            messages: next,
            order: meta.order ?? [],
            prompt: meta.prompt,
            rounds: meta.rounds ?? 1,
            wordLimit: meta.wordLimit ?? DEFAULT_WORD_LIMIT,
          });
        }
      }
    },
    [persistActive, saveSnapshot]
  );

  const switchDebate = useCallback(
    (id: string) => {
      if (isRunningRef.current) return;
      const found = library.find((d) => d.id === id);
      if (!found) return;
      createdAtRef.current = found.createdAt;
      lastSettingsRef.current = {
        prompt: found.prompt,
        rounds: found.rounds,
        wordLimit: found.wordLimit,
      };
      setMessages(found.messages);
      setOrder(found.order);
      setCurrentRound(maxRoundInMessages(found.messages));
      setTotalRounds(found.rounds);
      setError(null);
      setTotalTokensUsed(0);
      persistActive(found.id);
      return found;
    },
    [library, persistActive]
  );

  const newDebate = useCallback(() => {
    if (isRunningRef.current) return;
    // Snapshot current before leaving
    if (debateIdRef.current && messagesRef.current.length > 0) {
      saveSnapshot();
    }
    createdAtRef.current = null;
    lastSettingsRef.current = null;
    setMessages([]);
    setOrder([]);
    setError(null);
    setTotalTokensUsed(0);
    setCurrentRound(0);
    setTotalRounds(0);
    setCurrentSpeakerModel(null);
    persistActive(null);
  }, [persistActive, saveSnapshot]);

  const deleteDebate = useCallback(
    (id: string) => {
      if (isRunningRef.current) return;
      setLibrary((prev) => removeDebate(prev, id));
      if (debateIdRef.current === id) {
        createdAtRef.current = null;
        lastSettingsRef.current = null;
        setMessages([]);
        setOrder([]);
        setError(null);
        setTotalTokensUsed(0);
        setCurrentRound(0);
        setTotalRounds(0);
        persistActive(null);
      }
    },
    [persistActive]
  );

  const clear = useCallback(() => {
    if (isRunningRef.current) return;
    const id = debateIdRef.current;
    if (id) {
      setLibrary((prev) => removeDebate(prev, id));
    }
    createdAtRef.current = null;
    lastSettingsRef.current = null;
    setMessages([]);
    setOrder([]);
    setError(null);
    setTotalTokensUsed(0);
    setCurrentRound(0);
    setTotalRounds(0);
    setCurrentSpeakerModel(null);
    persistActive(null);
  }, [persistActive]);

  const doExportJson = useCallback(() => {
    const s = lastSettingsRef.current;
    if (!s || messages.length === 0) return;
    exportAsJson(
      buildExportPayload(s.prompt, s.rounds, s.wordLimit, order, messages)
    );
  }, [messages, order]);

  const doExportMd = useCallback(() => {
    const s = lastSettingsRef.current;
    if (!s || messages.length === 0) return;
    exportAsMarkdown(
      buildExportPayload(s.prompt, s.rounds, s.wordLimit, order, messages)
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
    debateId,
    library,
    libraryHydrated,
    start,
    continueDebate,
    stop,
    clear,
    newDebate,
    switchDebate,
    deleteDebate,
    loadMessages,
    estimateUsage,
    doExportJson,
    doExportMd,
    canExport: messages.length > 0 && !isRunning,
    canContinue: messages.length > 0 && !isRunning,
    lastSettings: lastSettingsRef,
  };
}
