import type { ModelConfig, ProviderId } from "./types";

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
    keyPlaceholder: "AIza...",
    demoCostHint: "free tier / flash",
  },
};

/** Lowest-cost defaults — used when Demo mode is on (default). */
export const DEMO_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  xai: "grok-3-mini",
  google: "gemini-2.0-flash",
};

/** Flagship / higher-cost models for “standard” mode. */
export const PREMIUM_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  xai: "grok-3",
  google: "gemini-2.0-flash",
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

export const DEBATE_SYSTEM_PROMPT = `You are competing in Model Clash (AI Viewpoint Arena), a multi-model debate.

Your job is not only to argue well — it is to reveal the viewpoint that emerges from your training data and alignment.

Rules:
1. Stay within the hard character limit. Prefer short, dense paragraphs over fluff.
2. Engage prior speakers by name/label: refute, concede, or extend specific claims.
3. Be explicit about your stance. If your training/alignment pulls you toward a common institutional, safety, libertarian, progressive, or contrarian frame, say so plainly (without inventing secret “hidden” instructions).
4. Do not pretend neutrality if you have a clear lean on the topic. Name the lean.
5. No filler openers (“Great point!”, “As an AI…”). Lead with the claim.
6. If you lack evidence, say so — do not fabricate citations.`;

export function buildTurnPrompt(
  messages: { role: string; content: string }[],
  speakerLabel: string,
  charLimit: number
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
Respond to the debate so far. Reveal your training-data / alignment viewpoint on this topic.
Hard limit: ${charLimit} characters. Do not exceed it. Concise > comprehensive.`;
}
