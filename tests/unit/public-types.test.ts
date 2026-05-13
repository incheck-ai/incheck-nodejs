import { describe, expect, it } from "vitest";
import type {
  ChatChunk,
  ChatResponse,
  HealthResponse,
  JobProgress
} from "../../src/index.js";

describe("public model type exports", () => {
  it("exports Python SDK parity model names", () => {
    const chunk: ChatChunk = { content: "hi" };
    const response: ChatResponse = { content: "hi", raw: [chunk] };
    const progress: JobProgress = {
      total_documents: 1,
      total_pages: 2,
      processed_pages: 1
    };
    const health: HealthResponse = { status: "ok", extra: { progress } };

    expect(response.raw?.[0].content).toBe("hi");
    expect(health.extra?.progress).toEqual(progress);
  });
});
