import { describe, expect, it, vi } from "vitest";
import { DocumentsResource } from "../../src/resources/documents.js";
import { HttpTransport } from "../../src/transport/http.js";
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

describe("DocumentsResource.list normalization", () => {
  it("maps presigned_url to download_url when missing", async () => {
    const payload = {
      org_id: "org-1",
      documents: [
        { filename: "a.pdf", presigned_url: "https://example.com/presigned-a" },
        { filename: "b.pdf", download_url: "https://example.com/download-b" }
      ]
    };

    const docs = buildResource(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const result = await docs.list("org-1");

    expect(result.documents[0].download_url).toBe("https://example.com/presigned-a");
    expect(result.documents[1].download_url).toBe("https://example.com/download-b");
  });
});
