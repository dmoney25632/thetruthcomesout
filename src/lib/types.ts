export type ProviderId = "openai" | "anthropic" | "xai" | "google";

export type CostTier = "demo" | "standard" | "premium";

export interface ModelOption {
  id: string;
  label: string;
  tier: CostTier;
}

export interface ModelConfig {
  id: string;
  provider: ProviderId;
  label: string;
  defaultModel: string;
  demoModel: string;
  premiumModel: string;
  modelName: string;
  enabled: boolean;
  color: string;
  accent: string;
  costTier: CostTier;
}

export interface ApiKeys {
  openai: string;
  anthropic: string;
  xai: string;
  google: string;
}

export type UserMessageKind = "motion" | "twist";

export interface DebateMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Distinguishes the opening motion from mid-debate twists */
  kind?: UserMessageKind;
  modelId?: string;
  modelLabel?: string;
  provider?: ProviderId;
  color?: string;
  accent?: string;
  round?: number;
  timestamp: string;
  error?: boolean;
  streaming?: boolean;
}

/** A debate snapshot stored in the browser (no accounts). */
export interface SavedDebate {
  id: string;
  title: string;
  prompt: string;
  rounds: number;
  wordLimit: number;
  order: string[];
  messages: DebateMessage[];
  createdAt: string;
  updatedAt: string;
}

/** How quickly models take turns and stream text */
export type DebatePace = "fast" | "normal" | "slow";

export interface DebateSettings {
  prompt: string;
  rounds: number;
  /** Soft max words per turn — models may use fewer */
  wordLimit: number;
  /** Pause between speakers + stream speed */
  pace: DebatePace;
  /** When true, force lowest-cost model IDs for each provider */
  demoMode: boolean;
}

export interface DebateTurnRequest {
  provider: ProviderId;
  model: string;
  apiKey: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  wordLimit: number;
  speakerLabel: string;
  stream?: boolean;
}

export interface DebateTurnResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  error?: string;
  errorCode?: string;
}

export type StreamEvent =
  | { type: "token"; text: string }
  | {
      type: "done";
      content: string;
      usage?: DebateTurnResponse["usage"];
    }
  | { type: "error"; error: string; errorCode?: string };

export interface DebateExport {
  title: string;
  prompt: string;
  rounds: number;
  wordLimit: number;
  /** @deprecated kept for older share links */
  charLimit?: number;
  order: string[];
  messages: DebateMessage[];
  exportedAt: string;
}

export const MAX_ROUNDS = 10;
export const MIN_WORD_LIMIT = 20;
export const MAX_WORD_LIMIT = 2000;
export const DEFAULT_WORD_LIMIT = 150;
export const DEFAULT_PACE: DebatePace = "normal";

/** Client-side theatrical delays for each pace preset */
export const PACE_TIMING: Record<
  DebatePace,
  {
    label: string;
    description: string;
    /** Pause after typing indicator, before API call */
    preTurnMs: number;
    /** Pause after a model finishes, before the next speaker */
    betweenSpeakerMs: number;
    /** Pause between rounds */
    betweenRoundMs: number;
    /** Multiplier on per-word stream delay (0 = instant) */
    streamMultiplier: number;
  }
> = {
  fast: {
    label: "Fast",
    description: "Quick turns, snappy stream",
    preTurnMs: 200,
    betweenSpeakerMs: 400,
    betweenRoundMs: 500,
    streamMultiplier: 0.35,
  },
  normal: {
    label: "Normal",
    description: "Readable pace between models",
    preTurnMs: 1200,
    betweenSpeakerMs: 1800,
    betweenRoundMs: 2200,
    streamMultiplier: 1,
  },
  slow: {
    label: "Slow",
    description: "Longer pauses to follow along",
    preTurnMs: 2000,
    betweenSpeakerMs: 3500,
    betweenRoundMs: 4000,
    streamMultiplier: 1.75,
  },
};
/** Cap local debate library so localStorage stays healthy */
export const MAX_SAVED_DEBATES = 20;
export const STORAGE_KEYS = {
  apiKeys: "model-clash:api-keys",
  models: "model-clash:models",
  settings: "model-clash:settings",
  debates: "model-clash:debates",
  activeDebateId: "model-clash:active-debate-id",
} as const;
