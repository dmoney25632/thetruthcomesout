"use client";

import type { ProviderId } from "@/lib/types";
import { cn } from "@/lib/utils";

function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.784-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.602 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4.714 15.956 12 3.043l7.286 12.913H4.714Zm7.286-8.6-3.9 6.914h7.8L12 7.356Z" />
      <path d="M3 18.5h18v2.2H3z" opacity=".85" />
    </svg>
  );
}

function GrokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M6.2 4.5 12 10.3l5.8-5.8 1.7 1.7L13.7 12l5.8 5.8-1.7 1.7L12 13.7l-5.8 5.8-1.7-1.7 5.8-5.8-5.8-5.8 1.7-1.7Z" />
    </svg>
  );
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.5c.4 3.8 1.9 6.6 4.8 9.1-2.9 2.5-4.4 5.3-4.8 9.1-.4-3.8-1.9-6.6-4.8-9.1 2.9-2.5 4.4-5.3 4.8-9.1Z" />
    </svg>
  );
}

const ICONS: Record<
  ProviderId,
  (p: { className?: string }) => React.JSX.Element
> = {
  openai: OpenAIIcon,
  anthropic: ClaudeIcon,
  xai: GrokIcon,
  google: GeminiIcon,
};

export function ModelAvatar({
  provider,
  color,
  size = "md",
  className,
  pulse = false,
}: {
  provider: ProviderId;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  pulse?: boolean;
}) {
  const dim =
    size === "sm"
      ? "h-7 w-7"
      : size === "lg"
        ? "h-11 w-11"
        : "h-9 w-9";
  const icon =
    size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const Icon = ICONS[provider];

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-white/80",
        dim,
        pulse && "animate-soft-pulse",
        className
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      <Icon className={icon} />
    </div>
  );
}
