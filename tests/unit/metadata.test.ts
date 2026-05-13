import { describe, expect, it, vi } from "vitest";
import { MetadataResource } from "../../src/resources/metadata.js";
import { HttpTransport } from "../../src/transport/http.js";
import type { IncheckClientOptions, ResolvedIncheckConfig } from "../../src/models/types.js";

function buildResource(payload: unknown): MetadataResource {
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
  return new MetadataResource(new HttpTransport(options, config));
}

describe("MetadataResource", () => {
  it("returns states-and-scopes payload", async () => {
    const payload = {
      default_state: "Massachusetts",
      default_scope: "ALS",
      states: [
        { value: "Massachusetts", label: "Massachusetts" },
        { value: "New York", label: "New York" }
      ],
      scopes: [
        { value: "ALS", label: "ALS" },
        { value: "BLS", label: "BLS" }
      ],
      scopes_by_state: {
        Massachusetts: ["ALS", "BLS"],
        _default: ["ALS"]
      }
    };

    const metadata = buildResource(payload);
    await expect(metadata.statesAndScopes()).resolves.toEqual(payload);
  });
});
