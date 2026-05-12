import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("DocumentsResource.upload path inputs", () => {
  it("extracts basename and uploads from file path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "incheck-nodejs-"));
    const filePath = join(tempDir, "report-a.txt");
    await writeFile(filePath, "hello");

    const docs = buildResource(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));

    const initiateSpy = vi.spyOn(docs, "initiateUpload").mockResolvedValue({
      job_id: "job-path",
      uploads: [{ filename: "report-a.txt", url: "https://s3.local/upload", fields: {} }]
    });
    vi.spyOn(docs, "completeUpload").mockResolvedValue({ job_id: "job-path", status: "processing" });

    const result = await docs.upload("org-1", [filePath], { wait: false });

    expect(result).toEqual({ job_id: "job-path", status: "processing" });
    expect(initiateSpy).toHaveBeenCalledWith("org-1", ["report-a.txt"], 6, { wait: false });
  });

  it("rejects empty file from path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "incheck-nodejs-"));
    const filePath = join(tempDir, "empty.txt");
    await writeFile(filePath, "");

    const docs = buildResource(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(docs.upload("org-1", [filePath], { wait: false })).rejects.toBeInstanceOf(
      IncheckValidationError
    );
  });

  it("fails when path does not exist", async () => {
    const docs = buildResource(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(
      docs.upload("org-1", ["/definitely/missing/file.txt"], { wait: false })
    ).rejects.toBeInstanceOf(Error);
  });
});
