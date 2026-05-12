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
  const transport = new HttpTransport(options, config);
  return new DocumentsResource(transport);
}

describe("DocumentsResource.upload", () => {
  it("uploads all files, completes, and waits by default", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const docs = buildResource(fetchMock);

    vi.spyOn(docs, "initiateUpload").mockResolvedValue({
      job_id: "job-1",
      uploads: [
        { filename: "a.txt", url: "https://s3.local/upload-a", fields: { key: "a" } },
        { filename: "b.txt", url: "https://s3.local/upload-b", fields: { key: "b" } }
      ]
    });
    vi.spyOn(docs, "completeUpload").mockResolvedValue({ job_id: "job-1", status: "processing" });
    vi.spyOn(docs, "waitForJob").mockResolvedValue({ job_id: "job-1", status: "completed" });

    const result = await docs.upload(
      "org-1",
      [
        { filename: "a.txt", data: new Uint8Array([1]) },
        { filename: "b.txt", data: new Uint8Array([2]) }
      ],
      { wait: true }
    );

    expect(result).toEqual({ job_id: "job-1", status: "completed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns complete response when wait is false", async () => {
    const docs = buildResource(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));

    vi.spyOn(docs, "initiateUpload").mockResolvedValue({
      job_id: "job-2",
      uploads: [{ filename: "a.txt", url: "https://s3.local/upload-a", fields: {} }]
    });
    vi.spyOn(docs, "completeUpload").mockResolvedValue({ job_id: "job-2", status: "processing" });

    const waitSpy = vi.spyOn(docs, "waitForJob");

    const result = await docs.upload(
      "org-1",
      [{ filename: "a.txt", data: new Uint8Array([1]) }],
      { wait: false }
    );

    expect(result).toEqual({ job_id: "job-2", status: "processing" });
    expect(waitSpy).not.toHaveBeenCalled();
  });

  it("accepts upload_urls field from initiate response", async () => {
    const docs = buildResource(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));

    vi.spyOn(docs, "initiateUpload").mockResolvedValue({
      job_id: "job-2b",
      upload_urls: [{ filename: "a.txt", url: "https://s3.local/upload-a", fields: {} }]
    });
    const completeSpy = vi
      .spyOn(docs, "completeUpload")
      .mockResolvedValue({ job_id: "job-2b", status: "processing" });

    const result = await docs.upload(
      "org-1",
      [{ filename: "a.txt", data: new Uint8Array([1]) }],
      { wait: false }
    );

    expect(result).toEqual({ job_id: "job-2b", status: "processing" });
    expect(completeSpy).toHaveBeenCalledWith("job-2b", ["a.txt"], { wait: false });
  });

  it("fails when presigned entry is missing", async () => {
    const docs = buildResource(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));

    vi.spyOn(docs, "initiateUpload").mockResolvedValue({
      job_id: "job-3",
      uploads: []
    });

    await expect(
      docs.upload("org-1", [{ filename: "a.txt", data: new Uint8Array([1]) }])
    ).rejects.toBeInstanceOf(IncheckValidationError);
  });

  it("fails on non-200/204 presigned upload response", async () => {
    const docs = buildResource(vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 500 })));

    vi.spyOn(docs, "initiateUpload").mockResolvedValue({
      job_id: "job-4",
      uploads: [{ filename: "a.txt", url: "https://s3.local/upload-a", fields: {} }]
    });

    await expect(
      docs.upload("org-1", [{ filename: "a.txt", data: new Uint8Array([1]) }])
    ).rejects.toBeInstanceOf(IncheckValidationError);
  });

  it("fails on empty inline file", async () => {
    const docs = buildResource(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(
      docs.upload("org-1", [{ filename: "empty.txt", data: new Uint8Array([]) }])
    ).rejects.toBeInstanceOf(IncheckValidationError);
  });
});
