import { NextRequest, NextResponse } from "next/server";
import { runDebateTurn } from "@/lib/providers";
import type { DebateTurnRequest, StreamEvent } from "@/lib/types";
import {
  MAX_ROUNDS,
  MAX_WORD_LIMIT,
  MIN_WORD_LIMIT,
} from "@/lib/types";
import {
  ProviderError,
  classifyProviderError,
  httpStatusForCode,
} from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_PROVIDERS = new Set(["openai", "anthropic", "xai", "google"]);

function redactLog(msg: string): string {
  return msg
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/sk-ant-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/xai-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/AIza[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/AQ\.[a-zA-Z0-9_-]+/g, "[redacted]");
}

function validateBody(body: DebateTurnRequest): string | null {
  if (!body.provider || !VALID_PROVIDERS.has(body.provider)) {
    return "provider must be one of: openai, anthropic, xai, google";
  }
  if (!body.model || typeof body.model !== "string") {
    return "model is required";
  }
  if (!body.apiKey || typeof body.apiKey !== "string") {
    return "apiKey is required";
  }
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return "messages array is required";
  }
  if (
    typeof body.wordLimit !== "number" ||
    body.wordLimit < MIN_WORD_LIMIT ||
    body.wordLimit > MAX_WORD_LIMIT
  ) {
    return `wordLimit must be between ${MIN_WORD_LIMIT} and ${MAX_WORD_LIMIT}`;
  }
  const assistantTurns = body.messages.filter((m) => m.role === "assistant").length;
  if (assistantTurns > MAX_ROUNDS * 4) {
    return `Debate exceeds max of ${MAX_ROUNDS} rounds`;
  }
  return null;
}

function sseEncode(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  let body: DebateTurnRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Never log apiKey or full body
  const validationError = validateBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const turnReq: DebateTurnRequest = {
    provider: body.provider,
    model: body.model.trim(),
    apiKey: body.apiKey.trim(),
    messages: body.messages,
    wordLimit: body.wordLimit,
    speakerLabel: body.speakerLabel || body.model,
  };

  const wantStream = body.stream !== false;

  if (wantStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(sseEncode(event)));
        };

        try {
          const result = await runDebateTurn(turnReq, (text) => {
            send({ type: "token", text });
          });
          send({
            type: "done",
            content: result.content,
            usage: result.usage,
          });
        } catch (err) {
          const classified = classifyProviderError(err);
          console.error(
            "[debate] provider error:",
            redactLog(`${classified.code}: ${classified.message}`)
          );
          send({
            type: "error",
            error: classified.message,
            errorCode: classified.code,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  try {
    const result = await runDebateTurn(turnReq);
    return NextResponse.json(result);
  } catch (err) {
    const classified =
      err instanceof ProviderError ? err : classifyProviderError(err);
    console.error(
      "[debate] provider error:",
      redactLog(`${classified.code}: ${classified.message}`)
    );
    return NextResponse.json(
      {
        content: "",
        error: classified.message,
        errorCode: classified.code,
      },
      { status: httpStatusForCode(classified.code) }
    );
  }
}
