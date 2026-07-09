"use client";

import type {
  ApiKeys,
  DebatePace,
  DebateSettings,
  ModelConfig,
  SavedDebate,
} from "@/lib/types";
import {
  MAX_ROUNDS,
  MAX_WORD_LIMIT,
  MIN_WORD_LIMIT,
  PACE_TIMING,
} from "@/lib/types";
import { MODEL_OPTIONS, PROVIDER_META } from "@/lib/models";
import { estimateTokens } from "@/lib/utils";
import { ModelAvatar } from "./ModelAvatar";
import { DebateLibrary } from "./DebateLibrary";
import {
  AlertTriangle,
  ChevronLeft,
  Eye,
  EyeOff,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  settings: DebateSettings;
  setSettings: (
    s: DebateSettings | ((prev: DebateSettings) => DebateSettings)
  ) => void;
  setDemoMode: (demo: boolean) => void;
  models: ModelConfig[];
  updateModel: (id: string, patch: Partial<ModelConfig>) => void;
  apiKeys: ApiKeys;
  updateKey: (provider: keyof ApiKeys, value: string) => void;
  clearKeys: () => void;
  isRunning: boolean;
  estimatedTokens: number;
  debates: SavedDebate[];
  activeDebateId: string | null;
  onNewDebate: () => void;
  onSelectDebate: (id: string) => void;
  onDeleteDebate: (id: string) => void;
}

export function Sidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
  settings,
  setSettings,
  setDemoMode,
  models,
  updateModel,
  apiKeys,
  updateKey,
  clearKeys,
  isRunning,
  estimatedTokens,
  debates,
  activeDebateId,
  onNewDebate,
  onSelectDebate,
  onDeleteDebate,
}: SidebarProps) {
  const [showKeys, setShowKeys] = useState(false);

  const enabledCount = models.filter((m) => m.enabled).length;
  const missingKeys = models.filter(
    (m) => m.enabled && !apiKeys[m.provider]?.trim()
  );

  const costLevel = useMemo(() => {
    if (settings.demoMode && estimatedTokens < 8_000) {
      return {
        label: "Low cost (demo)",
        tone: "emerald" as const,
        detail: "Mini/flash/haiku models — still billed to your keys.",
      };
    }
    if (estimatedTokens < 5_000) {
      return {
        label: "Moderate",
        tone: "amber" as const,
        detail: "Small charge across enabled providers.",
      };
    }
    if (estimatedTokens < 20_000) {
      return {
        label: "Noticeable",
        tone: "amber" as const,
        detail: "History grows each round. Prefer demo mode.",
      };
    }
    return {
      label: "High cost risk",
      tone: "red" as const,
      detail: "Reduce rounds or models, or enable Demo mode.",
    };
  }, [estimatedTokens, settings.demoMode]);

  const toneClasses =
    costLevel.tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : costLevel.tone === "red"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-stone-950/40 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      )}

      {/* Desktop collapsed rail */}
      <div
        className={`hidden shrink-0 flex-col items-center gap-3 border-r border-stone-200 bg-white/90 py-4 transition-all lg:flex ${
          collapsed ? "w-14" : "w-0 overflow-hidden border-0 p-0"
        }`}
      >
        {collapsed && (
          <>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              title="Expand settings"
              aria-label="Expand settings"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
            <div className="mt-2 flex flex-col items-center gap-2">
              {models
                .filter((m) => m.enabled)
                .map((m) => (
                  <ModelAvatar
                    key={m.id}
                    provider={m.provider}
                    color={m.color}
                    size="sm"
                  />
                ))}
            </div>
          </>
        )}
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100%,22rem)] flex-col border-r border-stone-200 bg-white shadow-xl transition-transform duration-200 lg:static lg:z-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${
          collapsed
            ? "lg:w-0 lg:overflow-hidden lg:border-0 lg:translate-x-0"
            : "lg:w-80 lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <span className="text-sm font-semibold text-stone-800">Settings</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 lg:inline-flex"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          <DebateLibrary
            debates={debates}
            activeId={activeDebateId}
            isRunning={isRunning}
            onNew={onNewDebate}
            onSelect={onSelectDebate}
            onDelete={onDeleteDebate}
          />

          <section
            className={`rounded-xl border px-3 py-3 ${
              settings.demoMode
                ? "border-emerald-200 bg-emerald-50/80"
                : "border-stone-200 bg-stone-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-stone-800">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  Demo / cheap mode
                </div>
                <p className="text-[11px] leading-relaxed text-stone-500">
                  Locks each provider to its cheapest model. Turn off to pick
                  freely.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.demoMode}
                disabled={isRunning}
                onClick={() => setDemoMode(!settings.demoMode)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  settings.demoMode ? "bg-emerald-600" : "bg-stone-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    settings.demoMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="rounds"
                className="text-xs font-semibold uppercase tracking-wider text-stone-500"
              >
                Rounds (1–{MAX_ROUNDS})
              </label>
              <input
                id="rounds"
                type="number"
                min={1}
                max={MAX_ROUNDS}
                value={settings.rounds}
                disabled={isRunning}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    rounds: Math.min(
                      MAX_ROUNDS,
                      Math.max(1, Number(e.target.value) || 1)
                    ),
                  }))
                }
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="wordLimit"
                className="text-xs font-semibold uppercase tracking-wider text-stone-500"
              >
                Word limit
              </label>
              <input
                id="wordLimit"
                type="number"
                min={MIN_WORD_LIMIT}
                max={MAX_WORD_LIMIT}
                step={10}
                value={settings.wordLimit}
                disabled={isRunning}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    wordLimit: Math.min(
                      MAX_WORD_LIMIT,
                      Math.max(
                        MIN_WORD_LIMIT,
                        Number(e.target.value) || MIN_WORD_LIMIT
                      )
                    ),
                  }))
                }
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:opacity-60"
              />
            </div>
          </section>
          <p className="-mt-3 text-[11px] leading-relaxed text-stone-400">
            Soft max per turn — models may use fewer words. They won&apos;t pad
            to fill it.
          </p>

          <section className="space-y-1.5">
            <label
              htmlFor="pace"
              className="text-xs font-semibold uppercase tracking-wider text-stone-500"
            >
              Pace
            </label>
            <div
              id="pace"
              className="grid grid-cols-3 gap-1.5"
              role="group"
              aria-label="Debate pace"
            >
              {(Object.keys(PACE_TIMING) as DebatePace[]).map((pace) => {
                const active = settings.pace === pace;
                return (
                  <button
                    key={pace}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setSettings((s) => ({ ...s, pace }))}
                    className={`rounded-xl border px-2 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                      active
                        ? "border-stone-800 bg-stone-800 text-white"
                        : "border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    {PACE_TIMING[pace].label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-stone-400">
              {PACE_TIMING[settings.pace]?.description ??
                PACE_TIMING.normal.description}{" "}
              — gap between models:{" "}
              {Math.round(
                (PACE_TIMING[settings.pace]?.betweenSpeakerMs ??
                  PACE_TIMING.normal.betweenSpeakerMs) / 1000
              )}
              s
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Models
              </h3>
              <span className="text-[11px] text-stone-400">
                {enabledCount} · min 2
              </span>
            </div>
            <ul className="space-y-2">
              {models.map((m) => {
                const options = MODEL_OPTIONS[m.provider];
                const known = options.some((o) => o.id === m.modelName);
                return (
                  <li
                    key={m.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/80 p-3"
                    style={{ borderLeftWidth: 3, borderLeftColor: m.color }}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id={`model-${m.id}`}
                        checked={m.enabled}
                        disabled={isRunning}
                        onChange={(e) =>
                          updateModel(m.id, { enabled: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-400"
                      />
                      <ModelAvatar
                        provider={m.provider}
                        color={m.color}
                        size="sm"
                      />
                      <label
                        htmlFor={`model-${m.id}`}
                        className="flex-1 text-sm font-medium text-stone-800"
                      >
                        {m.label}
                        <span className="ml-1.5 text-xs font-normal text-stone-400">
                          {PROVIDER_META[m.provider].name}
                        </span>
                      </label>
                    </div>
                    <select
                      value={m.modelName}
                      disabled={isRunning || !m.enabled || settings.demoMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        const opt = options.find((o) => o.id === next);
                        updateModel(m.id, {
                          modelName: next,
                          costTier: opt?.tier ?? "standard",
                        });
                      }}
                      className="mt-2 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-200 disabled:opacity-50"
                      aria-label={`${m.label} model`}
                    >
                      {!known && (
                        <option value={m.modelName}>{m.modelName}</option>
                      )}
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                          {o.tier === "demo"
                            ? " · cheap"
                            : o.tier === "premium"
                              ? " · premium"
                              : ""}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
                <KeyRound className="h-3.5 w-3.5" />
                API keys
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKeys((v) => !v)}
                  className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                  title={showKeys ? "Hide keys" : "Show keys"}
                >
                  {showKeys ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={clearKeys}
                  disabled={isRunning}
                  className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  title="Clear all keys"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-stone-400">
              Stored in localStorage only — never logged server-side.
            </p>
            <div className="space-y-2.5">
              {(Object.keys(PROVIDER_META) as (keyof ApiKeys)[]).map((pid) => (
                <div key={pid} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor={`key-${pid}`}
                      className="text-xs font-medium text-stone-600"
                    >
                      {PROVIDER_META[pid].keyLabel}
                    </label>
                    <a
                      href={PROVIDER_META[pid].docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-stone-400 underline-offset-2 hover:text-stone-600 hover:underline"
                    >
                      Get key
                    </a>
                  </div>
                  <input
                    id={`key-${pid}`}
                    type={showKeys ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKeys[pid]}
                    disabled={isRunning}
                    onChange={(e) => updateKey(pid, e.target.value)}
                    placeholder={PROVIDER_META[pid].keyPlaceholder}
                    className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-mono text-xs text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-200 disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className={`rounded-xl border px-3 py-2.5 ${toneClasses}`}>
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
              <div className="space-y-1 text-[11px] leading-relaxed opacity-90">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-3 w-3" />
                  {costLevel.label}
                </p>
                <p>
                  Est. ~<strong>{estimatedTokens.toLocaleString()}</strong>{" "}
                  tokens (~{estimateTokens(settings.prompt)} from prompt).
                </p>
                <p>{costLevel.detail}</p>
              </div>
            </div>
          </section>

          {missingKeys.length > 0 && enabledCount >= 2 && (
            <p className="text-xs text-red-600">
              Missing key:{" "}
              {missingKeys
                .map((m) => PROVIDER_META[m.provider].name)
                .join(", ")}
            </p>
          )}
        </div>

        <div className="hidden border-t border-stone-100 px-4 py-3 text-[10px] text-stone-400 lg:block">
          <ChevronLeft className="mr-1 inline h-3 w-3" />
          Collapse with the panel icon · Esc stops a live debate
        </div>
      </aside>
    </>
  );
}
