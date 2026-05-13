import { describe, expect, it, vi } from "vitest";
import { DocumentsResource } from "../../src/resources/documents.js";
import { HttpTransport } from "../../src/transport/http.js";
import type { IncheckClientOptions, ResolvedIncheckConfig } from "../../src/models/types.js";

function buildResource(payload: unknown): DocumentsResource {
  const options: IncheckClientOptions = {
    apiKey: "k",
    fetch: vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    )
  };
  const config: ResolvedIncheckConfig = {
    apiKey: "k",
    baseUrl: "https://api.incheck.ai",
    environment: "production",
    timeoutMs: 2000,
    headers: {}
  };
  return new DocumentsResource(new HttpTransport(options, config));
}

describe("DocumentsResource version/job response shapes", () => {
  it("supports python-style version response fields", async () => {
    const payload = {
      org_id: "fastmedicalai_dispatch",
      current_version: "20260512_123000",
      job_id: "job-123",
      s3_folder: "org/fastmedicalai_dispatch/2026/05/12/20260512_123000",
      updated_at: "2026-05-12T12:30:00+00:00"
    };
    const docs = buildResource(payload);
    await expect(docs.version("fastmedicalai_dispatch")).resolves.toEqual(payload);
  });

  it("preserves structured job progress payload", async () => {
    const payload = {
      job_id: "job-123",
      status: "processing",
      org_name: "FastMedical",
      org_id: "fastmedicalai_dispatch",
      version: "20260512_123000",
      s3_folder: "org/fastmedicalai_dispatch/2026/05/12/20260512_123000",
      progress: {
        total_documents: 2,
        total_pages: 24,
        processed_pages: 12
      },
      created_at: "2026-05-12T12:30:00+00:00",
      completed_at: null
    };
    const docs = buildResource(payload);
    await expect(docs.job("job-123")).resolves.toEqual(payload);
  });

  it("supports python-style initiateUpdate response fields", async () => {
    const payload = {
      job_id: "job-update",
      org_name: "FastMedical",
      org_id: "fastmedicalai_dispatch",
      current_version: "20260512_123000",
      new_version: "20260512_130000",
      s3_folder: "org/fastmedicalai_dispatch/2026/05/12/20260512_130000",
      upload_urls: [
        {
          filename: "sop.pdf",
          upload_url: "https://s3.local/upload",
          upload_fields: {},
          s3_key: "org/fastmedicalai_dispatch/2026/05/12/20260512_130000/sop.pdf",
          is_update: true
        }
      ],
      existing_documents_to_keep: ["existing.pdf"],
      expires_in: 3600,
      created_at: "2026-05-12T13:00:00+00:00"
    };
    const docs = buildResource(payload);
    await expect(docs.initiateUpdate("fastmedicalai_dispatch", ["sop.pdf"])).resolves.toEqual(payload);
  });
});
