"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DebateTranscript } from "@/components/DebateTranscript";
import { DebateProgress } from "@/components/DebateProgress";
import { PromptComposer } from "@/components/PromptComposer";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { useDebate } from "@/hooks/useDebate";
import { buildExportPayload } from "@/lib/export";
import {
  clearShareHash,
  decodeShareHash,
  writeShareUrl,
} from "@/lib/share";
import {
  Check,
  Eraser,
  FileJson,
  FileText,
  Link2,
  Menu,
  PanelLeftOpen,
  Swords,
} from "lucide-react";

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const [shareError, setShareError] = useState<string | null>(null);

  const {
    hydrated,
    apiKeys,
    models,
    settings,
    setSettings,
    setDemoMode,
    updateKey,
    updateModel,
    clearKeys,
  } = useLocalStorageState();

  const {
    messages,
    isRunning,
    currentSpeaker,
    currentSpeakerModel,
    currentRound,
    totalRounds,
    order,
    error,
    start,
    stop,
    clear,
    loadMessages,
    estimateUsage,
    doExportJson,
    doExportMd,
    canExport,
    lastSettings,
  } = useDebate();

  const estimatedTokens = useMemo(
    () => estimateUsage(settings, models),
    [estimateUsage, settings, models]
  );

  const enabledCount = models.filter((m) => m.enabled).length;
  const missingKeys = models.some(
    (m) => m.enabled && !apiKeys[m.provider]?.trim()
  );
  const canStart =
    !isRunning &&
    settings.prompt.trim().length > 0 &&
    enabledCount >= 2 &&
    !missingKeys;

  const handleStart = useCallback(() => {
    if (!canStart) return;
    void start(settings, models, apiKeys);
    setSidebarOpen(false);
  }, [canStart, start, settings, models, apiKeys]);

  // Restore shared debate from URL hash
  useEffect(() => {
    if (!hydrated) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#d=")) return;
    let cancelled = false;
    void (async () => {
      const data = await decodeShareHash(hash);
      if (cancelled || !data) return;
      loadMessages(data.messages, {
        order: data.order,
        rounds: data.rounds,
        prompt: data.prompt,
        charLimit: data.charLimit,
      });
      setSettings((s) => ({
        ...s,
        prompt: data.prompt,
        rounds: data.rounds,
        charLimit: data.charLimit,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, loadMessages, setSettings]);

  // Persist finished debates into the hash for easy refresh/share
  useEffect(() => {
    if (isRunning || messages.length === 0) return;
    const s = lastSettings.current;
    if (!s) return;
    const t = window.setTimeout(() => {
      void writeShareUrl(
        buildExportPayload(s.prompt, s.rounds, s.charLimit, order, messages)
      ).catch(() => {
        /* ignore oversized */
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [isRunning, messages, order, lastSettings]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable;

      if (e.key === "Escape" && isRunning) {
        e.preventDefault();
        stop();
        return;
      }

      // Enter-to-start is handled inside PromptComposer when focused;
      // global Enter only when not in another field and prompt ready
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !inField &&
        canStart &&
        !isRunning
      ) {
        e.preventDefault();
        handleStart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRunning, stop, canStart, handleStart]);

  const handleShare = async () => {
    const s = lastSettings.current;
    if (!s || messages.length === 0) return;
    try {
      const url = await writeShareUrl(
        buildExportPayload(s.prompt, s.rounds, s.charLimit, order, messages)
      );
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setShareError(null);
      window.setTimeout(() => setShareState("idle"), 2000);
    } catch (err) {
      setShareState("error");
      setShareError(err instanceof Error ? err.message : "Share failed");
      window.setTimeout(() => setShareState("idle"), 3000);
    }
  };

  const handleClear = () => {
    clear();
    clearShareHash();
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--arena-bg)]">
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        settings={settings}
        setSettings={setSettings}
        setDemoMode={setDemoMode}
        models={models}
        updateModel={updateModel}
        apiKeys={apiKeys}
        updateKey={updateKey}
        clearKeys={clearKeys}
        isRunning={isRunning}
        estimatedTokens={estimatedTokens}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-stone-200/80 bg-white/80 px-3 py-3 backdrop-blur-md sm:px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 lg:hidden"
            aria-label="Open settings"
          >
            <Menu className="h-5 w-5" />
          </button>
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="hidden rounded-lg p-2 text-stone-600 hover:bg-stone-100 lg:inline-flex"
              aria-label="Expand settings"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          )}

          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white shadow-sm">
              <Swords className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold leading-tight tracking-tight text-stone-900">
                Model Clash
              </h1>
              <p className="truncate text-[11px] text-stone-400">
                AI Viewpoint Arena
                {settings.demoMode ? " · Demo" : ""}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={handleShare}
              disabled={!canExport}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40 sm:px-2.5"
              title="Copy shareable link"
            >
              {shareState === "copied" ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {shareState === "copied" ? "Copied" : "Share"}
              </span>
            </button>
            <button
              type="button"
              onClick={doExportMd}
              disabled={!canExport}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40 sm:px-2.5"
              title="Export Markdown"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">MD</span>
            </button>
            <button
              type="button"
              onClick={doExportJson}
              disabled={!canExport}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40 sm:px-2.5"
              title="Export JSON"
            >
              <FileJson className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">JSON</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={isRunning || messages.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40 sm:px-2.5"
              title="Clear transcript"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </header>

        {(isRunning || order.length > 0) && (
          <DebateProgress
            currentRound={currentRound || 1}
            totalRounds={totalRounds || settings.rounds}
            order={order}
            currentSpeaker={currentSpeaker}
            models={models}
            isRunning={isRunning}
          />
        )}

        {!hydrated ? (
          <div className="flex flex-1 items-center justify-center text-sm text-stone-400">
            Loading arena…
          </div>
        ) : (
          <main className="relative flex-1 overflow-y-auto">
            <div className="arena-glow pointer-events-none absolute inset-0" />
            <div
              className={`relative mx-auto max-w-4xl px-3 sm:px-4 ${
                messages.length > 0 ? "pb-36 pt-3" : "pb-8 pt-2"
              }`}
            >
              {(error || shareError) && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error || shareError}
                </div>
              )}
              <DebateTranscript
                messages={messages}
                isRunning={isRunning}
                currentSpeaker={currentSpeaker}
                currentSpeakerModel={currentSpeakerModel}
                prompt={settings.prompt}
                onPromptChange={(v) =>
                  setSettings((s) => ({ ...s, prompt: v }))
                }
                onSubmit={handleStart}
                onStop={stop}
                canStart={canStart}
                showComposer={messages.length === 0 && !isRunning}
              />
            </div>
          </main>
        )}

        {/* Sticky composer when a debate is on screen */}
        {hydrated && (messages.length > 0 || isRunning) && (
          <div className="border-t border-stone-200/80 bg-white/85 px-3 py-3 backdrop-blur-md sm:px-4">
            <PromptComposer
              value={settings.prompt}
              onChange={(v) => setSettings((s) => ({ ...s, prompt: v }))}
              onSubmit={handleStart}
              onStop={stop}
              isRunning={isRunning}
              canStart={canStart}
            />
          </div>
        )}

        {!(messages.length > 0 || isRunning) && (
          <footer className="border-t border-stone-200/80 bg-white/70 px-4 py-2 text-center text-[10px] text-stone-400 backdrop-blur-sm">
            Keys stay in your browser. You pay providers directly. Share links
            encode the transcript in the URL hash — no server storage.
          </footer>
        )}
      </div>
    </div>
  );
}
