import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import type {
  DebateTurnRequest,
  DebateTurnResponse,
  ProviderId,
} from "@/lib/types";
import { DEBATE_SYSTEM_PROMPT, buildTurnPrompt } from "@/lib/models";
import { ProviderError, classifyProviderError } from "@/lib/errors";
import { countWords, truncateWords } from "@/lib/utils";

/** Generous token budget so the soft word ceiling is the real constraint. */
function maxOutputTokens(wordLimit: number): number {
  return Math.min(Math.ceil(wordLimit * 2) + 64, 8192);
}

export type TokenCallback = (text: string) => void;

function finalizeContent(text: string, wordLimit: number): string {
  return truncateWords(text.trim(), wordLimit);
}

/** Stream deltas until we hit the soft word ceiling. */
function appendWithinWordLimit(
  content: string,
  delta: string,
  wordLimit: number,
  onToken?: TokenCallback
): string {
  if (!delta) return content;
  if (countWords(content) >= wordLimit) return content;

  const next = content + delta;
  if (countWords(next) <= wordLimit) {
    onToken?.(delta);
    return next;
  }

  // Last chunk would overflow — emit only what fits as whole words
  const clipped = truncateWords(next, wordLimit);
  const extra = clipped.slice(content.length);
  if (extra) onToken?.(extra);
  return clipped;
}

async function callOpenAICompatible(
  req: DebateTurnRequest,
  baseURL: string | undefined,
  onToken?: TokenCallback
): Promise<DebateTurnResponse> {
  const client = new OpenAI({
    apiKey: req.apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  const prompt = buildTurnPrompt(req.messages, req.speakerLabel, req.wordLimit);
  const isXai = !!baseURL;

  try {
    if (onToken) {
      const stream = await client.chat.completions.create({
        model: req.model,
        max_tokens: maxOutputTokens(req.wordLimit),
        stream: true,
        // OpenAI supports include_usage; xAI may not — omit for xAI
        ...(!isXai ? { stream_options: { include_usage: true } } : {}),
        messages: [
          { role: "system", content: DEBATE_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      });

      let content = "";
      let usage: DebateTurnResponse["usage"];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        content = appendWithinWordLimit(content, delta, req.wordLimit, onToken);
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }

      return { content: finalizeContent(content, req.wordLimit), usage };
    }

    const completion = await client.chat.completions.create({
      model: req.model,
      max_tokens: maxOutputTokens(req.wordLimit),
      messages: [
        { role: "system", content: DEBATE_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    return {
      content: finalizeContent(
        completion.choices[0]?.message?.content ?? "",
        req.wordLimit
      ),
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      },
    };
  } catch (err) {
    throw classifyProviderError(err);
  }
}

async function callAnthropic(
  req: DebateTurnRequest,
  onToken?: TokenCallback
): Promise<DebateTurnResponse> {
  const client = new Anthropic({ apiKey: req.apiKey });
  const prompt = buildTurnPrompt(req.messages, req.speakerLabel, req.wordLimit);

  try {
    if (onToken) {
      const stream = client.messages.stream({
        model: req.model,
        max_tokens: maxOutputTokens(req.wordLimit),
        system: DEBATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      let content = "";
      stream.on("text", (text) => {
        content = appendWithinWordLimit(content, text, req.wordLimit, onToken);
      });

      const message = await stream.finalMessage();
      const textBlock = message.content.find((b) => b.type === "text");
      const finalText =
        textBlock && textBlock.type === "text" ? textBlock.text : content;

      return {
        content: finalizeContent(finalText, req.wordLimit),
        usage: {
          promptTokens: message.usage.input_tokens,
          completionTokens: message.usage.output_tokens,
          totalTokens: message.usage.input_tokens + message.usage.output_tokens,
        },
      };
    }

    const message = await client.messages.create({
      model: req.model,
      max_tokens: maxOutputTokens(req.wordLimit),
      system: DEBATE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const raw =
      textBlock && textBlock.type === "text" ? textBlock.text : "";

    return {
      content: finalizeContent(raw, req.wordLimit),
      usage: {
        promptTokens: message.usage.input_tokens,
        completionTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    };
  } catch (err) {
    throw classifyProviderError(err);
  }
}

async function callGoogle(
  req: DebateTurnRequest,
  onToken?: TokenCallback
): Promise<DebateTurnResponse> {
  const ai = new GoogleGenAI({ apiKey: req.apiKey });
  const prompt = buildTurnPrompt(req.messages, req.speakerLabel, req.wordLimit);
  const config = {
    systemInstruction: DEBATE_SYSTEM_PROMPT,
    maxOutputTokens: maxOutputTokens(req.wordLimit),
  };

  try {
    if (onToken) {
      const stream = await ai.models.generateContentStream({
        model: req.model,
        contents: prompt,
        config,
      });

      let content = "";
      let usage: DebateTurnResponse["usage"];

      for await (const chunk of stream) {
        content = appendWithinWordLimit(
          content,
          chunk.text ?? "",
          req.wordLimit,
          onToken
        );
        const meta = chunk.usageMetadata;
        if (meta) {
          usage = {
            promptTokens: meta.promptTokenCount,
            completionTokens: meta.candidatesTokenCount,
            totalTokens: meta.totalTokenCount,
          };
        }
      }

      return { content: finalizeContent(content, req.wordLimit), usage };
    }

    const result = await ai.models.generateContent({
      model: req.model,
      contents: prompt,
      config,
    });

    return {
      content: finalizeContent(result.text ?? "", req.wordLimit),
      usage: {
        promptTokens: result.usageMetadata?.promptTokenCount,
        completionTokens: result.usageMetadata?.candidatesTokenCount,
        totalTokens: result.usageMetadata?.totalTokenCount,
      },
    };
  } catch (err) {
    throw classifyProviderError(err);
  }
}

export async function runDebateTurn(
  req: DebateTurnRequest,
  onToken?: TokenCallback
): Promise<DebateTurnResponse> {
  if (!req.apiKey?.trim()) {
    throw new ProviderError(
      "Invalid API key — no key provided for this provider.",
      "invalid_key"
    );
  }

  switch (req.provider as ProviderId) {
    case "openai":
      return callOpenAICompatible(req, undefined, onToken);
    case "xai":
      return callOpenAICompatible(req, "https://api.x.ai/v1", onToken);
    case "anthropic":
      return callAnthropic(req, onToken);
    case "google":
      return callGoogle(req, onToken);
    default:
      throw new ProviderError(
        `Unknown provider: ${req.provider}`,
        "unknown"
      );
  }
}
