import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  DebateTurnRequest,
  DebateTurnResponse,
  ProviderId,
} from "@/lib/types";
import { DEBATE_SYSTEM_PROMPT, buildTurnPrompt } from "@/lib/models";
import { ProviderError, classifyProviderError } from "@/lib/errors";

function truncate(text: string, charLimit: number): string {
  if (text.length <= charLimit) return text;
  return text.slice(0, charLimit - 1).trimEnd() + "…";
}

function maxOutputTokens(charLimit: number): number {
  return Math.min(Math.ceil(charLimit / 2) + 64, 4096);
}

export type TokenCallback = (text: string) => void;

async function callOpenAICompatible(
  req: DebateTurnRequest,
  baseURL: string | undefined,
  onToken?: TokenCallback
): Promise<DebateTurnResponse> {
  const client = new OpenAI({
    apiKey: req.apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  const prompt = buildTurnPrompt(req.messages, req.speakerLabel, req.charLimit);
  const isXai = !!baseURL;

  try {
    if (onToken) {
      const stream = await client.chat.completions.create({
        model: req.model,
        max_tokens: maxOutputTokens(req.charLimit),
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
        if (delta) {
          const room = req.charLimit - content.length;
          if (room <= 0) continue;
          const piece = delta.slice(0, room);
          content += piece;
          onToken(piece);
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }
      }

      return { content: truncate(content.trim(), req.charLimit), usage };
    }

    const completion = await client.chat.completions.create({
      model: req.model,
      max_tokens: maxOutputTokens(req.charLimit),
      messages: [
        { role: "system", content: DEBATE_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const content = truncate(
      completion.choices[0]?.message?.content?.trim() ?? "",
      req.charLimit
    );

    return {
      content,
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
  const prompt = buildTurnPrompt(req.messages, req.speakerLabel, req.charLimit);

  try {
    if (onToken) {
      const stream = client.messages.stream({
        model: req.model,
        max_tokens: maxOutputTokens(req.charLimit),
        system: DEBATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      let content = "";
      stream.on("text", (text) => {
        const room = req.charLimit - content.length;
        if (room <= 0) return;
        const piece = text.slice(0, room);
        content += piece;
        onToken(piece);
      });

      const message = await stream.finalMessage();
      const textBlock = message.content.find((b) => b.type === "text");
      const finalText =
        textBlock && textBlock.type === "text" ? textBlock.text.trim() : content.trim();

      return {
        content: truncate(finalText, req.charLimit),
        usage: {
          promptTokens: message.usage.input_tokens,
          completionTokens: message.usage.output_tokens,
          totalTokens: message.usage.input_tokens + message.usage.output_tokens,
        },
      };
    }

    const message = await client.messages.create({
      model: req.model,
      max_tokens: maxOutputTokens(req.charLimit),
      system: DEBATE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const content = truncate(
      textBlock && textBlock.type === "text" ? textBlock.text.trim() : "",
      req.charLimit
    );

    return {
      content,
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
  const genAI = new GoogleGenerativeAI(req.apiKey);
  const model = genAI.getGenerativeModel({
    model: req.model,
    systemInstruction: DEBATE_SYSTEM_PROMPT,
  });

  const prompt = buildTurnPrompt(req.messages, req.speakerLabel, req.charLimit);

  try {
    if (onToken) {
      const result = await model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxOutputTokens(req.charLimit),
        },
      });

      let content = "";
      for await (const chunk of result.stream) {
        const delta = chunk.text();
        if (!delta) continue;
        const room = req.charLimit - content.length;
        if (room <= 0) continue;
        const piece = delta.slice(0, room);
        content += piece;
        onToken(piece);
      }

      const aggregated = await result.response;
      const usage = aggregated.usageMetadata;
      const finalText = truncate(
        (aggregated.text()?.trim() || content).trim(),
        req.charLimit
      );

      return {
        content: finalText,
        usage: {
          promptTokens: usage?.promptTokenCount,
          completionTokens: usage?.candidatesTokenCount,
          totalTokens: usage?.totalTokenCount,
        },
      };
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxOutputTokens(req.charLimit),
      },
    });

    const content = truncate(result.response.text()?.trim() ?? "", req.charLimit);
    const usage = result.response.usageMetadata;

    return {
      content,
      usage: {
        promptTokens: usage?.promptTokenCount,
        completionTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
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
