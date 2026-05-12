import { describe, expect, it } from "vitest";
import { ChatResource } from "../../src/resources/chat.js";
import { HttpTransport } from "../../src/transport/http.js";
import type { IncheckClientOptions, ResolvedIncheckConfig } from "../../src/models/types.js";

function buildTransport(fetchImpl: typeof fetch): HttpTransport {
  const options: IncheckClientOptions = { apiKey: "k", fetch: fetchImpl };
  const config: ResolvedIncheckConfig = {
    apiKey: "k",
    baseUrl: "https://api.incheck.ai",
    environment: "production",
    timeoutMs: 2000,
    headers: {}
  };
  return new HttpTransport(options, config);
}

describe("ChatResource", () => {
  it("create aggregates SSE content and stops at complete", async () => {
    const body = [
      'data: {"content":"Hel"}',
      'data: {"content":"lo"}',
      'data: {"type":"complete"}',
      'data: {"content":"ignored"}'
    ].join("\n");

    const transport = buildTransport(async () => new Response(body, { status: 200 }));
    const chat = new ChatResource(transport);

    const result = await chat.create({ content: "Hi" });
    expect(result.content).toBe("Hello");
    expect(result.raw?.length).toBe(3);
  });

  it("create omits org_id when undefined and sets defaults", async () => {
    let capturedBody: unknown;
    const transport = buildTransport(async (input, init) => {
      void input;
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response('data: {"type":"complete"}\n', { status: 200 });
    });

    const chat = new ChatResource(transport);
    await chat.create({ content: "Hi" });

    const payload = capturedBody as Record<string, unknown>;
    expect(payload.content).toBe("Hi");
    expect(payload.user_id).toBe("sdk");
    expect(payload.streaming).toBe(false);
    expect(payload.scope).toBe("ALS");
    expect(payload.state).toBe("Massachusetts");
    expect(payload).not.toHaveProperty("org_id");
    expect(typeof payload.conversation_id).toBe("string");
    expect((payload.conversation_id as string).length).toBeGreaterThan(10);
  });

  it("stream yields SSE chunks progressively", async () => {
    let capturedBody: unknown;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"content":"A"}\n'));
        controller.enqueue(new TextEncoder().encode('data: {"content":"B"}\n'));
        controller.enqueue(new TextEncoder().encode('data: {"type":"complete"}\n'));
        controller.close();
      }
    });

    const transport = buildTransport(async (input, init) => {
      void input;
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      });
    });

    const chat = new ChatResource(transport);
    const chunks: string[] = [];

    for await (const chunk of chat.stream({ content: "hello" })) {
      if (chunk.content) {
        chunks.push(chunk.content);
      }
    }

    expect(chunks.join("")).toBe("AB");
    const payload = capturedBody as Record<string, unknown>;
    expect(payload.streaming).toBe(true);
  });
});
