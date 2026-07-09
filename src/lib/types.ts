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

export interface DebateMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
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

export interface DebateSettings {
  prompt: string;
  rounds: number;
  /** Soft max words per turn — models may use fewer */
  wordLimit: number;
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
export const STORAGE_KEYS = {
  apiKeys: "model-clash:api-keys",
  models: "model-clash:models",
  settings: "model-clash:settings",
} as const;
