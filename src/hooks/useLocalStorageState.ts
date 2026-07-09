"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ApiKeys,
  DebatePace,
  DebateSettings,
  ModelConfig,
} from "@/lib/types";
import {
  DEFAULT_PACE,
  DEFAULT_WORD_LIMIT,
  MAX_ROUNDS,
  MAX_WORD_LIMIT,
  MIN_WORD_LIMIT,
  STORAGE_KEYS,
} from "@/lib/types";
import {
  DEFAULT_MODELS,
  DEMO_MODELS,
  MODEL_ID_MIGRATIONS,
  PREMIUM_MODELS,
} from "@/lib/models";

const EMPTY_KEYS: ApiKeys = {
  openai: "",
  anthropic: "",
  xai: "",
  google: "",
};

const DEFAULT_SETTINGS: DebateSettings = {
  prompt: "",
  rounds: 2,
  wordLimit: DEFAULT_WORD_LIMIT,
  pace: DEFAULT_PACE,
  demoMode: true,
};

function resolvePace(value: unknown): DebatePace {
  if (value === "fast" || value === "normal" || value === "slow") return value;
  return DEFAULT_PACE;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function migrateModelName(name: string | undefined, fallback: string): string {
  if (!name) return fallback;
  return MODEL_ID_MIGRATIONS[name] ?? name;
}

/** Migrate older settings that used charLimit. */
function migrateSettings(
  stored: DebateSettings & { charLimit?: number; pace?: DebatePace }
): DebateSettings {
  const wordLimit =
    typeof stored.wordLimit === "number"
      ? stored.wordLimit
      : typeof stored.charLimit === "number"
        ? Math.min(
            MAX_WORD_LIMIT,
            Math.max(MIN_WORD_LIMIT, Math.round(stored.charLimit / 5))
          )
        : DEFAULT_WORD_LIMIT;

  return {
    prompt: stored.prompt ?? "",
    rounds: Math.min(MAX_ROUNDS, Math.max(1, stored.rounds ?? 2)),
    wordLimit: Math.min(
      MAX_WORD_LIMIT,
      Math.max(MIN_WORD_LIMIT, wordLimit)
    ),
    pace: resolvePace(stored.pace),
    demoMode: stored.demoMode ?? true,
  };
}

/** Merge stored models with current defaults so new fields (demoModel, etc.) appear. */
function mergeModels(stored: ModelConfig[]): ModelConfig[] {
  return DEFAULT_MODELS.map((def) => {
    const prev = stored.find((m) => m.id === def.id);
    if (!prev) return def;
    return {
      ...def,
      ...prev,
      // Always refresh palette + demo/premium ids from code
      color: def.color,
      accent: def.accent,
      demoModel: def.demoModel,
      premiumModel: def.premiumModel,
      defaultModel: def.defaultModel,
      modelName: migrateModelName(prev.modelName, def.modelName),
      enabled: prev.enabled,
    };
  });
}

export function useLocalStorageState() {
  const [hydrated, setHydrated] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(EMPTY_KEYS);
  const [models, setModels] = useState<ModelConfig[]>(DEFAULT_MODELS);
  const [settings, setSettings] = useState<DebateSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const storedKeys = safeParse(
      localStorage.getItem(STORAGE_KEYS.apiKeys),
      EMPTY_KEYS
    );
    const storedModels = safeParse(
      localStorage.getItem(STORAGE_KEYS.models),
      DEFAULT_MODELS
    );
    const storedSettings = safeParse(
      localStorage.getItem(STORAGE_KEYS.settings),
      DEFAULT_SETTINGS
    );

    const mergedModels = mergeModels(storedModels);
    const nextSettings = migrateSettings(storedSettings);

    setApiKeys(storedKeys);
    setModels(
      nextSettings.demoMode
        ? mergedModels.map((m) => ({
            ...m,
            modelName: m.demoModel || DEMO_MODELS[m.provider],
            costTier: "demo" as const,
          }))
        : mergedModels
    );
    setSettings(nextSettings);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.apiKeys, JSON.stringify(apiKeys));
  }, [apiKeys, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.models, JSON.stringify(models));
  }, [models, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings, hydrated]);

  const updateKey = useCallback((provider: keyof ApiKeys, value: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
  }, []);

  const updateModel = useCallback(
    (id: string, patch: Partial<ModelConfig>) => {
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    []
  );

  const setDemoMode = useCallback((demoMode: boolean) => {
    setSettings((s) => ({ ...s, demoMode }));
    setModels((prev) =>
      prev.map((m) => ({
        ...m,
        modelName: demoMode
          ? m.demoModel || DEMO_MODELS[m.provider]
          : m.premiumModel || PREMIUM_MODELS[m.provider],
        costTier: demoMode ? "demo" : "standard",
      }))
    );
  }, []);

  const clearKeys = useCallback(() => {
    setApiKeys(EMPTY_KEYS);
    localStorage.removeItem(STORAGE_KEYS.apiKeys);
  }, []);

  return {
    hydrated,
    apiKeys,
    models,
    settings,
    setSettings,
    setDemoMode,
    updateKey,
    updateModel,
    clearKeys,
  };
}
