import type { DebateMessage, SavedDebate } from "@/lib/types";
import { MAX_SAVED_DEBATES, STORAGE_KEYS } from "@/lib/types";

export function createDebateId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function titleFromPrompt(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Untitled debate";
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}…` : cleaned;
}

/** Rebuild provider chat history from a transcript (for resume / continue). */
export function messagesToApiHistory(
  messages: DebateMessage[]
): { role: "user" | "assistant" | "system"; content: string }[] {
  return messages
    .filter(
      (m) =>
        !m.streaming &&
        (m.role === "user" || m.role === "assistant") &&
        m.content.trim()
    )
    .map((m) => {
      if (m.role === "user") {
        if (m.kind === "twist") {
          return {
            role: "user" as const,
            content: `TWIST / NEW ANGLE (respond to this development while staying in the debate):\n${m.content}`,
          };
        }
        return { role: "user" as const, content: m.content };
      }
      const label = m.modelLabel ?? "Model";
      return {
        role: "assistant" as const,
        content: m.error
          ? `[${label} ERROR]: ${m.content}`
          : `[${label}]: ${m.content}`,
      };
    });
}

export function maxRoundInMessages(messages: DebateMessage[]): number {
  let max = 0;
  for (const m of messages) {
    if (typeof m.round === "number" && m.round > max) max = m.round;
  }
  return max;
}

export function buildSavedDebate(input: {
  id: string;
  prompt: string;
  rounds: number;
  wordLimit: number;
  order: string[];
  messages: DebateMessage[];
  createdAt?: string;
}): SavedDebate {
  const now = new Date().toISOString();
  return {
    id: input.id,
    title: titleFromPrompt(input.prompt),
    prompt: input.prompt,
    rounds: input.rounds,
    wordLimit: input.wordLimit,
    order: input.order,
    messages: input.messages.filter((m) => !m.streaming),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function readDebateLibrary(): SavedDebate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.debates);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDebate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d) => d && typeof d.id === "string" && Array.isArray(d.messages)
    );
  } catch {
    return [];
  }
}

export function writeDebateLibrary(debates: SavedDebate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.debates, JSON.stringify(debates));
}

export function upsertDebate(
  library: SavedDebate[],
  debate: SavedDebate
): SavedDebate[] {
  const without = library.filter((d) => d.id !== debate.id);
  const next = [debate, ...without].slice(0, MAX_SAVED_DEBATES);
  writeDebateLibrary(next);
  return next;
}

export function removeDebate(
  library: SavedDebate[],
  id: string
): SavedDebate[] {
  const next = library.filter((d) => d.id !== id);
  writeDebateLibrary(next);
  return next;
}

export function readActiveDebateId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.activeDebateId);
}

export function writeActiveDebateId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(STORAGE_KEYS.activeDebateId, id);
  else localStorage.removeItem(STORAGE_KEYS.activeDebateId);
}

/** Sync `?debate=<id>` without dropping other search params. */
export function setDebateSearchParam(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("debate", id);
  else url.searchParams.delete("debate");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", next);
}

export function getDebateSearchParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URL(window.location.href).searchParams.get("debate");
}
