import type { DebateExport, DebateMessage } from "@/lib/types";
import { downloadFile } from "@/lib/utils";

export function buildExportPayload(
  prompt: string,
  rounds: number,
  charLimit: number,
  order: string[],
  messages: DebateMessage[]
): DebateExport {
  return {
    title: "Model Clash Debate",
    prompt,
    rounds,
    charLimit,
    order,
    messages,
    exportedAt: new Date().toISOString(),
  };
}

export function exportAsJson(payload: DebateExport) {
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  downloadFile(
    `model-clash-${stamp}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
}

export function exportAsMarkdown(payload: DebateExport) {
  const lines: string[] = [
    `# Model Clash Debate`,
    ``,
    `**Exported:** ${payload.exportedAt}`,
    `**Rounds:** ${payload.rounds}`,
    `**Char limit:** ${payload.charLimit}`,
    `**Speaking order:** ${payload.order.join(" → ")}`,
    ``,
    `## Prompt`,
    ``,
    payload.prompt,
    ``,
    `## Transcript`,
    ``,
  ];

  for (const m of payload.messages) {
    if (m.role === "user") {
      lines.push(`### Debate prompt`, ``, m.content, ``);
    } else {
      const round = m.round != null ? ` (Round ${m.round})` : "";
      lines.push(
        `### ${m.modelLabel ?? "Model"}${round}`,
        ``,
        m.error ? `> **Error:** ${m.content}` : m.content,
        ``
      );
    }
  }

  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, "-");
  downloadFile(
    `model-clash-${stamp}.md`,
    lines.join("\n"),
    "text/markdown"
  );
}
