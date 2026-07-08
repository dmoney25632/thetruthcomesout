export type ProviderErrorCode =
  | "invalid_key"
  | "rate_limit"
  | "quota"
  | "model_not_found"
  | "content_filter"
  | "timeout"
  | "network"
  | "unknown";

export class ProviderError extends Error {
  code: ProviderErrorCode;
  status?: number;

  constructor(message: string, code: ProviderErrorCode, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
  }
}

function redact(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/sk-ant-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/xai-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/AIza[a-zA-Z0-9_-]+/g, "[redacted]");
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
  };
  return e.status ?? e.statusCode ?? e.response?.status;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown provider error";
  }
}

/** Map raw SDK / HTTP errors to user-facing messages. Never includes API keys. */
export function classifyProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;

  const status = extractStatus(err);
  const raw = redact(extractMessage(err));
  const lower = raw.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /invalid.?api.?key|incorrect.?api.?key|authentication|unauthorized|permission.?denied|api key not valid|invalid.?x-api-key/.test(
      lower
    )
  ) {
    return new ProviderError(
      "Invalid API key — check the key for this provider and try again.",
      "invalid_key",
      status
    );
  }

  if (
    status === 429 ||
    /rate.?limit|too many requests|resource.?exhausted|quota exceeded/.test(
      lower
    )
  ) {
    if (/quota|billing|insufficient.?credits|exceeded your current quota/.test(lower)) {
      return new ProviderError(
        "Quota exceeded — this key is out of credits or has hit its billing limit.",
        "quota",
        status
      );
    }
    return new ProviderError(
      "Rate limit hit — wait a moment, then retry. Demo/cheap models help avoid this.",
      "rate_limit",
      status
    );
  }

  if (
    status === 404 ||
    /model.?not.?found|does not exist|invalid.?model|not available/.test(lower)
  ) {
    return new ProviderError(
      "Model not found — check the model name (try a demo-mode default).",
      "model_not_found",
      status
    );
  }

  if (
    /content.?filter|safety|blocked|responsible.?ai|refused/.test(lower) &&
    status !== 500
  ) {
    return new ProviderError(
      "Response blocked by the provider’s content/safety filter.",
      "content_filter",
      status
    );
  }

  if (/timeout|timed out|deadline|ETIMEDOUT|AbortError/.test(lower)) {
    return new ProviderError(
      "Request timed out — try fewer rounds or a shorter char limit.",
      "timeout",
      status
    );
  }

  if (/fetch failed|network|ECONNREFUSED|ENOTFOUND|DNS/.test(lower)) {
    return new ProviderError(
      "Network error reaching the provider. Check your connection.",
      "network",
      status
    );
  }

  const short =
    raw.length > 180 ? `${raw.slice(0, 180).trimEnd()}…` : raw || "Provider error";
  return new ProviderError(short, "unknown", status);
}

export function httpStatusForCode(code: ProviderErrorCode): number {
  switch (code) {
    case "invalid_key":
      return 401;
    case "rate_limit":
    case "quota":
      return 429;
    case "model_not_found":
      return 404;
    case "content_filter":
      return 422;
    case "timeout":
      return 504;
    case "network":
      return 502;
    default:
      return 502;
  }
}
