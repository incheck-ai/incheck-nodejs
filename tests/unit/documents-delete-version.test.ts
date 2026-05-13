import { describe, expect, it, vi } from "vitest";
import { DocumentsResource } from "../../src/resources/documents.js";
import { HttpTransport } from "../../src/transport/http.js";
import { IncheckValidationError } from "../../src/errors/index.js";
import type { IncheckClientOptions, ResolvedIncheckConfig } from "../../src/models/types.js";

function buildResource(fetchImpl: typeof fetch): DocumentsResource {
  const options: IncheckClientOptions = { apiKey: "k", fetch: fetchImpl };
  const config: ResolvedIncheckConfig = {
    apiKey: "k",
    baseUrl: "https://api.incheck.ai",
    environment: "production",
    timeoutMs: 2000,
    headers: {}
  };
  return new DocumentsResource(new HttpTransport(options, config));
}

describe("DocumentsResource.deleteVersion", () => {
  it("accepts string versions and URL-encodes them in the request path", async () => {
    let capturedUrl = "";
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ message: "Deleted permanently" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const docs = buildResource(fetchMock);
    await expect(
      docs.deleteVersion("org-1", "2026/05/12 12:30:00")
    ).resolves.toEqual({ success: true, message: "Deleted permanently" });

    expect(capturedUrl).toContain(
      "/documents/orgs/org-1/versions/2026%2F05%2F12%2012%3A30%3A00"
    );
  });

  it("preserves python-style delete response metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          org_id: "org-1",
          version: "20260512_123000",
          message: "Deleted version"
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    );

    const docs = buildResource(fetchMock);
    await expect(docs.deleteVersion("org-1", "20260512_123000")).resolves.toEqual({
      success: true,
      org_id: "org-1",
      version: "20260512_123000",
      message: "Deleted version"
    });
  });

  it("normalizes delete responses with success true", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: "Deleted permanently" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const docs = buildResource(fetchMock);
    await expect(docs.delete("org-1")).resolves.toEqual({
      success: true,
      message: "Deleted permanently"
    });
  });

  it("rejects empty string versions", async () => {
    const docs = buildResource(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: "Deleted permanently" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    await expect(docs.deleteVersion("org-1", "   ")).rejects.toBeInstanceOf(
      IncheckValidationError
    );
  });
});
