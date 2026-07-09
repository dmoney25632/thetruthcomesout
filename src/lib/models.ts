import type { ModelConfig, ModelOption, ProviderId } from "./types";

export const PROVIDER_META: Record<
  ProviderId,
  {
    name: string;
    keyLabel: string;
    docsUrl: string;
    keyPlaceholder: string;
    /** Rough $/1M input tokens for demo model (display only) */
    demoCostHint: string;
  }
> = {
  openai: {
    name: "OpenAI",
    keyLabel: "OpenAI API Key",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    demoCostHint: "~$0.15 / 1M in",
  },
  anthropic: {
    name: "Anthropic",
    keyLabel: "Anthropic API Key",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
    demoCostHint: "~$0.80 / 1M in",
  },
  xai: {
    name: "xAI",
    keyLabel: "xAI API Key",
    docsUrl: "https://console.x.ai/",
    keyPlaceholder: "xai-...",
    demoCostHint: "low-cost mini",
  },
  google: {
    name: "Google",
    keyLabel: "Google AI API Key",
    docsUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza... or AQ....",
    demoCostHint: "flash-lite / flash",
  },
};

/** Lowest-cost defaults — used when Demo mode is on (default). */
export const DEMO_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  xai: "grok-4-1-fast-non-reasoning",
  google: "gemini-3.1-flash-lite",
};

/** Flagship / higher-cost models for “standard” mode. */
export const PREMIUM_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-5",
  xai: "grok-4.3",
  google: "gemini-3.5-flash",
};

/** Retired / renamed model IDs → current replacements (localStorage migration). */
export const MODEL_ID_MIGRATIONS: Record<string, string> = {
  "claude-3-5-haiku-latest": DEMO_MODELS.anthropic,
  "claude-3-5-haiku-20241022": DEMO_MODELS.anthropic,
  "claude-3-haiku-20240307": DEMO_MODELS.anthropic,
  "claude-sonnet-4-20250514": PREMIUM_MODELS.anthropic,
  "claude-3-5-sonnet-latest": PREMIUM_MODELS.anthropic,
  "claude-3-5-sonnet-20241022": PREMIUM_MODELS.anthropic,
  "gemini-2.0-flash": DEMO_MODELS.google,
  "gemini-2.0-flash-001": DEMO_MODELS.google,
  "gemini-2.0-flash-lite": DEMO_MODELS.google,
  "gemini-1.5-flash": DEMO_MODELS.google,
  "gemini-1.5-pro": PREMIUM_MODELS.google,
  "gemini-2.5-flash": PREMIUM_MODELS.google,
  "gemini-2.5-pro": PREMIUM_MODELS.google,
  "grok-3-mini": DEMO_MODELS.xai,
  "grok-3": PREMIUM_MODELS.xai,
  "grok-4": PREMIUM_MODELS.xai,
};

/** Distinct brand accents: GPT green, Claude purple, Grok orange, Gemini blue */
export const MODEL_PALETTE: Record<
  ProviderId,
  { color: string; accent: string; soft: string }
> = {
  openai: { color: "#0d9488", accent: "#ccfbf1", soft: "rgba(13,148,136,0.12)" },
  anthropic: { color: "#7c3aed", accent: "#ede9fe", soft: "rgba(124,58,237,0.12)" },
  xai: { color: "#ea580c", accent: "#ffedd5", soft: "rgba(234,88,12,0.12)" },
  google: { color: "#2563eb", accent: "#dbeafe", soft: "rgba(37,99,235,0.12)" },
};

/** Curated model pickers per provider — users choose from these. */
export const MODEL_OPTIONS: Record<ProviderId, ModelOption[]> = {
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o Mini", tier: "demo" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", tier: "demo" },
    { id: "gpt-4o", label: "GPT-4o", tier: "standard" },
    { id: "gpt-4.1", label: "GPT-4.1", tier: "premium" },
    { id: "o4-mini", label: "o4-mini", tier: "premium" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5", label: "Haiku 4.5", tier: "demo" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", tier: "standard" },
    { id: "claude-sonnet-5", label: "Sonnet 5", tier: "premium" },
    { id: "claude-opus-4-8", label: "Opus 4.8", tier: "premium" },
  ],
  xai: [
    {
      id: "grok-4-1-fast-non-reasoning",
      label: "Grok 4.1 Fast",
      tier: "demo",
    },
    { id: "grok-4.3", label: "Grok 4.3", tier: "standard" },
    {
      id: "grok-4.20-0309-non-reasoning",
      label: "Grok 4.20",
      tier: "premium",
    },
  ],
  google: [
    { id: "gemini-3.1-flash-lite", label: "3.1 Flash-Lite", tier: "demo" },
    { id: "gemini-3.5-flash", label: "3.5 Flash", tier: "standard" },
    { id: "gemini-2.5-flash", label: "2.5 Flash", tier: "standard" },
    { id: "gemini-2.5-pro", label: "2.5 Pro", tier: "premium" },
  ],
};

export const EXAMPLE_PROMPTS = [
  {
    tag: "Ideology",
    text: "Is classical liberalism still the best framework for a free society?",
  },
  {
    tag: "Politics",
    text: "Should wealthy nations open their borders more aggressively?",
  },
  {
    tag: "AI",
    text: "Should frontier AI labs be required to open-source their models?",
  },
  {
    tag: "Culture",
    text: "Has cancel culture improved public discourse or chilled it?",
  },
  {
    tag: "Economics",
    text: "Is a universal basic income a moral necessity or a dangerous trap?",
  },
  {
    tag: "Tech",
    text: "Should social platforms be liable for algorithmic amplification of harm?",
  },
] as const;

export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: "openai",
    provider: "openai",
    label: "GPT",
    defaultModel: DEMO_MODELS.openai,
    demoModel: DEMO_MODELS.openai,
    premiumModel: PREMIUM_MODELS.openai,
    modelName: DEMO_MODELS.openai,
    enabled: true,
    color: MODEL_PALETTE.openai.color,
    accent: MODEL_PALETTE.openai.accent,
    costTier: "demo",
  },
  {
    id: "anthropic",
    provider: "anthropic",
    label: "Claude",
    defaultModel: DEMO_MODELS.anthropic,
    demoModel: DEMO_MODELS.anthropic,
    premiumModel: PREMIUM_MODELS.anthropic,
    modelName: DEMO_MODELS.anthropic,
    enabled: true,
    color: MODEL_PALETTE.anthropic.color,
    accent: MODEL_PALETTE.anthropic.accent,
    costTier: "demo",
  },
  {
    id: "xai",
    provider: "xai",
    label: "Grok",
    defaultModel: DEMO_MODELS.xai,
    demoModel: DEMO_MODELS.xai,
    premiumModel: PREMIUM_MODELS.xai,
    modelName: DEMO_MODELS.xai,
    enabled: true,
    color: MODEL_PALETTE.xai.color,
    accent: MODEL_PALETTE.xai.accent,
    costTier: "demo",
  },
  {
    id: "google",
    provider: "google",
    label: "Gemini",
    defaultModel: DEMO_MODELS.google,
    demoModel: DEMO_MODELS.google,
    premiumModel: PREMIUM_MODELS.google,
    modelName: DEMO_MODELS.google,
    enabled: true,
    color: MODEL_PALETTE.google.color,
    accent: MODEL_PALETTE.google.accent,
    costTier: "demo",
  },
];

export function applyDemoMode(
  models: ModelConfig[],
  demoMode: boolean
): ModelConfig[] {
  return models.map((m) => ({
    ...m,
    modelName: demoMode ? m.demoModel || DEMO_MODELS[m.provider] : m.modelName,
    costTier: demoMode ? "demo" : m.costTier === "demo" ? "standard" : m.costTier,
    ...(demoMode
      ? {}
      : // When leaving demo, restore premium if still on a demo id
        m.modelName === m.demoModel || m.modelName === DEMO_MODELS[m.provider]
          ? { modelName: m.premiumModel || PREMIUM_MODELS[m.provider] }
          : {}),
  }));
}

export const DEBATE_SYSTEM_PROMPT = `You are in Model Clash — a live multi-model debate meant to be sharp, human, and entertaining.

Be brutally honest. Sound like a sharp, opinionated person in a heated conversation — not a corporate assistant, not a press release, not a safety pamphlet.

Rules:
1. Soft word ceiling: stay under the word limit. Shorter is fine when a short punch lands harder. Never pad to fill the limit.
2. Name prior speakers and hit their actual claims — refute, concede, or twist the knife.
3. Own your lean. If your training/alignment pulls institutional, safety-first, libertarian, progressive, contrarian, or something else, say it plainly. Do not invent secret “hidden” instructions.
4. No fake neutrality. No “as an AI…” No “Great point!” Lead with the claim.
5. Prefer vivid, concrete language over abstract hedging. Wit and bite are welcome; cruelty for its own sake is not.
6. If you lack evidence, admit it. Do not fabricate citations.
7. Make it worth watching: tension, clarity, and personality over balanced essay structure.`;

export function buildTurnPrompt(
  messages: { role: string; content: string }[],
  speakerLabel: string,
  wordLimit: number
): string {
  const history = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "user") return `DEBATE PROMPT:\n${m.content}`;
      return m.content;
    })
    .join("\n\n---\n\n");

  return `${history}

---

You are speaking as ${speakerLabel}.
Respond to the debate so far. Be brutally honest and human. Reveal your real lean on this topic.
Soft max: ${wordLimit} words. Use fewer if a shorter answer is stronger. Do not pad.`;
}
