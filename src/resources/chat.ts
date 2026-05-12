import { randomUUID } from "node:crypto";
import { IncheckError } from "../errors/index.js";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatRequestOptions,
  StreamChatChunk
} from "../models/types.js";
import { HttpTransport } from "../transport/http.js";

const DEFAULT_USER_ID = "sdk";
const DEFAULT_SCOPE = "ALS";
const DEFAULT_STATE = "Massachusetts";

export class ChatResource {
  constructor(private readonly http: HttpTransport) {}

  async create(payload: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await this.http.requestRaw({
      method: "POST",
      path: "/chat",
      body: this.buildPayload(payload.content, payload.options),
      options: payload.options
    });

    const text = await response.text();
    const raw: StreamChatChunk[] = [];
    let content = "";

    for (const chunk of this.parseSseText(text)) {
      raw.push(chunk);
      if (chunk.error) {
        throw new IncheckError(chunk.error, { responseBody: chunk });
      }
      if (chunk.content) {
        content += chunk.content;
      }
      if (chunk.type === "complete") {
        break;
      }
    }

    return { content, raw };
  }

  async *stream(payload: ChatCompletionRequest): AsyncIterable<StreamChatChunk> {
    const response = await this.http.requestRaw({
      method: "POST",
      path: "/chat",
      body: this.buildPayload(payload.content, payload.options),
      options: payload.options
    });

    if (!response.body) {
      throw new IncheckError("Streaming response body is empty");
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const chunk = this.parseSseLine(line);
        if (!chunk) {
          continue;
        }
        if (chunk.error) {
          throw new IncheckError(chunk.error, { responseBody: chunk });
        }
        yield chunk;
        if (chunk.type === "complete") {
          return;
        }
      }
    }

    if (buffer) {
      const chunk = this.parseSseLine(buffer);
      if (chunk) {
        if (chunk.error) {
          throw new IncheckError(chunk.error, { responseBody: chunk });
        }
        yield chunk;
      }
    }
  }

  private buildPayload(content: string, options?: ChatRequestOptions): Record<string, unknown> {
    const conversationId = options?.conversationId ?? randomUUID();
    const payload: Record<string, unknown> = {
      content,
      user_id: options?.userId ?? DEFAULT_USER_ID,
      conversation_id: conversationId,
      scope: options?.scope ?? DEFAULT_SCOPE,
      state: options?.state ?? DEFAULT_STATE,
      conversation_hx: options?.conversationHx
    };

    if (options?.orgId) {
      payload.org_id = options.orgId;
    }

    return payload;
  }

  private *parseSseText(text: string): Iterable<StreamChatChunk> {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const chunk = this.parseSseLine(line);
      if (chunk) {
        yield chunk;
      }
    }
  }

  private parseSseLine(line: string): StreamChatChunk | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      return null;
    }

    const json = trimmed.slice(5).trim();
    if (!json) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(json);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      return parsed as StreamChatChunk;
    } catch {
      return null;
    }
  }
}
