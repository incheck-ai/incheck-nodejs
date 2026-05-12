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

describe("DocumentsResource.listOrgs normalization", () => {
  it("returns orgs from orgs field", async () => {
    const docs = buildResource({ orgs: [{ org_id: "org-1" }] });
    await expect(docs.listOrgs()).resolves.toEqual({ orgs: [{ org_id: "org-1" }] });
  });

  it("maps organizations field to orgs", async () => {
    const docs = buildResource({ organizations: [{ org_id: "org-1" }] });
    await expect(docs.listOrgs()).resolves.toEqual({ orgs: [{ org_id: "org-1" }] });
  });

  it("maps data field to orgs", async () => {
    const docs = buildResource({ data: [{ org_id: "org-1" }] });
    await expect(docs.listOrgs()).resolves.toEqual({ orgs: [{ org_id: "org-1" }] });
  });

  it("maps root array to orgs", async () => {
    const docs = buildResource([{ org_id: "org-1" }]);
    await expect(docs.listOrgs()).resolves.toEqual({ orgs: [{ org_id: "org-1" }] });
  });
});
