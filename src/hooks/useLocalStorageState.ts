"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiKeys, DebateSettings, ModelConfig } from "@/lib/types";
import { DEFAULT_CHAR_LIMIT, STORAGE_KEYS } from "@/lib/types";
import { DEFAULT_MODELS, DEMO_MODELS, PREMIUM_MODELS } from "@/lib/models";

const EMPTY_KEYS: ApiKeys = {
  openai: "",
  anthropic: "",
  xai: "",
  google: "",
};

const DEFAULT_SETTINGS: DebateSettings = {
  prompt: "",
  rounds: 2,
  charLimit: DEFAULT_CHAR_LIMIT,
  demoMode: true,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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
      modelName: prev.modelName || def.modelName,
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

    setApiKeys(storedKeys);
    setModels(mergeModels(storedModels));
    setSettings({
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      demoMode: storedSettings.demoMode ?? true,
    });
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
