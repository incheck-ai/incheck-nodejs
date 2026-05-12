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
  it("supports the current live documents response shape", async () => {
    const payload = {
      org_id: "fastmedicalai_proddemo",
      version: "20260511_213242",
      document_count: 1,
      documents: [
        {
          filename: "test_pdf_without_toc.pdf",
          size_bytes: 4364,
          last_modified: "2026-05-11T21:32:44+00:00",
          presigned_url: "https://example.com/presigned-a",
          url_expires_in: 3600
        }
      ],
      job_id: "b248ff0c-e2e7-494c-a91e-5d14d2b6337a",
      s3_folder: "fastmedicalai/fastmedicalai_proddemo/2026/05/11/20260511_213242"
    };

    const docs = buildResource(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const result = await docs.list("fastmedicalai_proddemo");

    expect(result.org_id).toBe("fastmedicalai_proddemo");
    expect(result.version).toBe("20260511_213242");
    expect(result.document_count).toBe(1);
    expect(result.job_id).toBe("b248ff0c-e2e7-494c-a91e-5d14d2b6337a");
    expect(result.s3_folder).toContain("fastmedicalai_proddemo");
    expect(result.documents[0].filename).toBe("test_pdf_without_toc.pdf");
    expect(result.documents[0].size_bytes).toBe(4364);
    expect(result.documents[0].url_expires_in).toBe(3600);
    expect(result.documents[0].download_url).toBe("https://example.com/presigned-a");
  });

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

  it("maps document_id to id when id is missing", async () => {
    const payload = {
      org_id: "org-1",
      documents: [
        { document_id: "doc-123", filename: "a.pdf" },
        { id: "doc-456", filename: "b.pdf" }
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

    expect(result.documents[0].id).toBe("doc-123");
    expect(result.documents[1].id).toBe("doc-456");
  });
});
