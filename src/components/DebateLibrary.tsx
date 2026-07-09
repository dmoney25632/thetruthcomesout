"use client";

import type { SavedDebate } from "@/lib/types";
import { History, Plus, Trash2 } from "lucide-react";

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function DebateLibrary({
  debates,
  activeId,
  isRunning,
  onNew,
  onSelect,
  onDelete,
}: {
  debates: SavedDebate[];
  activeId: string | null;
  isRunning: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
          <History className="h-3.5 w-3.5" />
          Debates
        </h3>
        <button
          type="button"
          onClick={onNew}
          disabled={isRunning}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-40"
          title="Start a new debate"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {debates.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-stone-400">
          Finished debates stay in this browser — switch between a few without
          accounts.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {debates.map((d) => {
            const active = d.id === activeId;
            return (
              <li key={d.id} className="group relative">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => onSelect(d.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                    active
                      ? "border-stone-800 bg-stone-900 text-stone-50"
                      : "border-stone-200 bg-stone-50/80 text-stone-800 hover:border-stone-300 hover:bg-white"
                  }`}
                >
                  <p
                    className={`line-clamp-2 text-xs font-medium leading-snug ${
                      active ? "text-stone-50" : "text-stone-800"
                    }`}
                  >
                    {d.title}
                  </p>
                  <p
                    className={`mt-1 text-[10px] ${
                      active ? "text-stone-400" : "text-stone-400"
                    }`}
                  >
                    {d.messages.filter((m) => m.role === "assistant").length}{" "}
                    turns · {relativeTime(d.updatedAt)}
                  </p>
                </button>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(d.id);
                  }}
                  className={`absolute right-1.5 top-1.5 rounded-md p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 ${
                    active
                      ? "text-stone-400 hover:bg-white/10 hover:text-red-300"
                      : "text-stone-400 hover:bg-red-50 hover:text-red-600"
                  }`}
                  title="Delete debate"
                  aria-label="Delete debate"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
