import { randomUUID } from "node:crypto";
import { IncheckError, IncheckValidationError } from "../errors/index.js";
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

  async send(
    content: string,
    options?: ChatRequestOptions
  ): Promise<ChatCompletionResponse> {
    return this.create({ content, options });
  }

  async create(payload: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await this.http.requestRaw({
      method: "POST",
      path: "/chat",
      body: this.buildPayload(payload.content, payload.options, false),
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
      body: this.buildPayload(payload.content, payload.options, true),
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

  private buildPayload(
    content: string,
    options: ChatRequestOptions | undefined,
    streaming: boolean
  ): Record<string, unknown> {
    const conversationId = options?.conversationId ?? randomUUID();
    const payload: Record<string, unknown> = {
      content,
      user_id: options?.userId ?? DEFAULT_USER_ID,
      conversation_id: conversationId,
      streaming,
      scope: options?.scope ?? DEFAULT_SCOPE,
      state: options?.state ?? DEFAULT_STATE
    };

    const messages = this.normalizeMessages(options?.messages);
    if (messages.length > 0) {
      payload.messages = messages;
    } else if (options?.conversationHx !== undefined) {
      payload.conversation_hx = options.conversationHx;
    }

    if (this.shouldIncludeOrgId(options?.orgId)) {
      payload.org_id = options?.orgId;
    }

    return payload;
  }

  private normalizeMessages(messages: ChatRequestOptions["messages"]): Array<{ role: "user" | "assistant"; content: string }> {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    return messages.map((m, index) => {
      if (!m || typeof m !== "object") {
        throw new IncheckValidationError(
          `messages[${index}] must be an object with role and content`
        );
      }
      if (m.role !== "user" && m.role !== "assistant") {
        throw new IncheckValidationError(
          `messages[${index}].role must be "user" or "assistant"`
        );
      }
      if (typeof m.content !== "string") {
        throw new IncheckValidationError(`messages[${index}].content must be a string`);
      }
      return { role: m.role, content: m.content };
    });
  }

  private shouldIncludeOrgId(orgId: ChatRequestOptions["orgId"]): boolean {
    if (!orgId) {
      return false;
    }
    if (Array.isArray(orgId)) {
      return orgId.length > 0;
    }
    return true;
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
