import type { DebateExport, DebateMessage } from "@/lib/types";

type CompactMessage = {
  r: "u" | "a";
  c: string;
  l?: string;
  p?: string;
  o?: number;
  t?: string;
  e?: 1;
};

type CompactShare = {
  v: 1;
  prompt: string;
  rounds: number;
  charLimit: number;
  order: string[];
  messages: CompactMessage[];
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function compress(text: string): Promise<string> {
  if (typeof CompressionStream === "undefined") {
    return `r:${toBase64Url(new TextEncoder().encode(text))}`;
  }
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return `z:${toBase64Url(new Uint8Array(buf))}`;
}

async function decompress(payload: string): Promise<string> {
  const [kind, data] = payload.split(":");
  if (!data) throw new Error("Invalid share payload");
  const bytes = fromBase64Url(data);
  if (kind === "r") return new TextDecoder().decode(bytes);
  if (kind !== "z") throw new Error("Unknown share encoding");
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decode compressed shares");
  }
  const stream = new Blob([bytes.buffer as ArrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

function compactMessages(messages: DebateMessage[]): CompactMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      if (m.role === "user") {
        return { r: "u" as const, c: m.content, t: m.timestamp };
      }
      return {
        r: "a" as const,
        c: m.content,
        l: m.modelLabel,
        p: m.provider,
        o: m.round,
        t: m.timestamp,
        ...(m.error ? { e: 1 as const } : {}),
      };
    });
}

function expandMessages(compact: CompactMessage[]): DebateMessage[] {
  const palette: Record<string, { color: string; accent: string }> = {
    openai: { color: "#0d9488", accent: "#ccfbf1" },
    anthropic: { color: "#7c3aed", accent: "#ede9fe" },
    xai: { color: "#ea580c", accent: "#ffedd5" },
    google: { color: "#2563eb", accent: "#dbeafe" },
  };

  return compact.map((m, i) => {
    if (m.r === "u") {
      return {
        id: `share-u-${i}`,
        role: "user" as const,
        content: m.c,
        timestamp: m.t || new Date().toISOString(),
      };
    }
    const colors = (m.p && palette[m.p]) || { color: "#78716c", accent: "#f5f5f4" };
    return {
      id: `share-a-${i}`,
      role: "assistant" as const,
      content: m.c,
      modelLabel: m.l,
      provider: m.p as DebateMessage["provider"],
      color: colors.color,
      accent: colors.accent,
      round: m.o,
      timestamp: m.t || new Date().toISOString(),
      error: m.e === 1,
    };
  });
}

export async function encodeShareHash(payload: DebateExport): Promise<string> {
  const compact: CompactShare = {
    v: 1,
    prompt: payload.prompt,
    rounds: payload.rounds,
    charLimit: payload.charLimit,
    order: payload.order,
    messages: compactMessages(payload.messages),
  };
  return compress(JSON.stringify(compact));
}

export async function decodeShareHash(
  hash: string
): Promise<{
  prompt: string;
  rounds: number;
  charLimit: number;
  order: string[];
  messages: DebateMessage[];
} | null> {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw.startsWith("d=")) return null;
  try {
    const json = await decompress(raw.slice(2));
    const data = JSON.parse(json) as CompactShare;
    if (data.v !== 1 || !Array.isArray(data.messages)) return null;
    return {
      prompt: data.prompt,
      rounds: data.rounds,
      charLimit: data.charLimit,
      order: data.order ?? [],
      messages: expandMessages(data.messages),
    };
  } catch {
    return null;
  }
}

export async function writeShareUrl(payload: DebateExport): Promise<string> {
  const encoded = await encodeShareHash(payload);
  const url = `${window.location.origin}${window.location.pathname}#d=${encoded}`;
  // Soft limit — very long hashes still work but are awkward to share
  if (url.length > 500_000) {
    throw new Error("Debate is too long to share via URL. Export Markdown instead.");
  }
  window.history.replaceState(null, "", `#d=${encoded}`);
  return url;
}

export function clearShareHash() {
  if (window.location.hash.startsWith("#d=")) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
