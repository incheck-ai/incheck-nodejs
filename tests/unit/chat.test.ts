import { describe, expect, it } from "vitest";
import { IncheckValidationError } from "../../src/errors/index.js";
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

  it("send matches the Python SDK chat API and delegates to create behavior", async () => {
    let capturedBody: unknown;
    const transport = buildTransport(async (input, init) => {
      void input;
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response('data: {"content":"ok"}\ndata: {"type":"complete"}\n', {
        status: 200
      });
    });

    const chat = new ChatResource(transport);
    const result = await chat.send("Hi", { orgId: "org_123", userId: "user_42" });

    expect(result.content).toBe("ok");
    const payload = capturedBody as Record<string, unknown>;
    expect(payload.content).toBe("Hi");
    expect(payload.org_id).toBe("org_123");
    expect(payload.user_id).toBe("user_42");
    expect(payload.streaming).toBe(false);
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

  it("create sends org_id as a list for multi-pod fan-out", async () => {
    let capturedBody: unknown;
    const transport = buildTransport(async (input, init) => {
      void input;
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response('data: {"type":"complete"}\n', { status: 200 });
    });

    const chat = new ChatResource(transport);
    await chat.create({
      content: "Compare protocols",
      options: { orgId: ["org_a", "org_b"] }
    });

    const payload = capturedBody as Record<string, unknown>;
    expect(payload.org_id).toEqual(["org_a", "org_b"]);
  });

  it("create omits org_id when orgId is an empty list", async () => {
    let capturedBody: unknown;
    const transport = buildTransport(async (input, init) => {
      void input;
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response('data: {"type":"complete"}\n', { status: 200 });
    });

    const chat = new ChatResource(transport);
    await chat.create({
      content: "EMS mode with empty org list",
      options: { orgId: [] }
    });

    const payload = capturedBody as Record<string, unknown>;
    expect(payload).not.toHaveProperty("org_id");
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

  it("create sends messages and omits conversation_hx when both are provided", async () => {
    let capturedBody: unknown;
    const transport = buildTransport(async (input, init) => {
      void input;
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response('data: {"type":"complete"}\n', { status: 200 });
    });

    const chat = new ChatResource(transport);
    await chat.create({
      content: "follow up",
      options: {
        conversationHx: "legacy history",
        messages: [
          { role: "user", content: "Question 1" },
          { role: "assistant", content: "Answer 1" }
        ]
      }
    });

    const payload = capturedBody as Record<string, unknown>;
    expect(payload).toHaveProperty("messages");
    expect(payload).not.toHaveProperty("conversation_hx");
    expect(payload.messages).toEqual([
      { role: "user", content: "Question 1" },
      { role: "assistant", content: "Answer 1" }
    ]);
  });

  it("rejects invalid message roles instead of silently filtering them", async () => {
    const transport = buildTransport(async () => new Response('data: {"type":"complete"}\n', { status: 200 }));
    const chat = new ChatResource(transport);

    await expect(
      chat.create({
        content: "follow up",
        options: {
          messages: [{ role: "system", content: "hidden instruction" } as never]
        }
      })
    ).rejects.toBeInstanceOf(IncheckValidationError);
  });

  it("rejects malformed message entries instead of silently filtering them", async () => {
    const transport = buildTransport(async () => new Response('data: {"type":"complete"}\n', { status: 200 }));
    const chat = new ChatResource(transport);

    await expect(
      chat.create({
        content: "follow up",
        options: {
          messages: [{ role: "user" } as never]
        }
      })
    ).rejects.toBeInstanceOf(IncheckValidationError);
  });

  it("create sends conversation_hx when messages are omitted or empty", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const transport = buildTransport(async (input, init) => {
      void input;
      calls.push(init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {});
      return new Response('data: {"type":"complete"}\n', { status: 200 });
    });

    const chat = new ChatResource(transport);
    await chat.create({
      content: "legacy",
      options: { conversationHx: "legacy history" }
    });
    await chat.create({
      content: "legacy-empty-messages",
      options: { conversationHx: "legacy history", messages: [] }
    });

    expect(calls[0].conversation_hx).toBe("legacy history");
    expect(calls[0]).not.toHaveProperty("messages");
    expect(calls[1].conversation_hx).toBe("legacy history");
    expect(calls[1]).not.toHaveProperty("messages");
  });
});
