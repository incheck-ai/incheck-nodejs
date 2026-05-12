import { describe, expect, it } from "vitest";
import {
  IncheckApiConnectionError,
  IncheckApiError,
  IncheckAuthenticationError,
  IncheckNotFoundError,
  IncheckPermissionError,
  IncheckRateLimitError,
  IncheckValidationError
} from "../../src/errors/index.js";
import { HttpTransport } from "../../src/transport/http.js";
import type { IncheckClientOptions, ResolvedIncheckConfig } from "../../src/models/types.js";

function makeTransport(fetchImpl: typeof fetch): HttpTransport {
  const options: IncheckClientOptions = { apiKey: "test", fetch: fetchImpl };
  const config: ResolvedIncheckConfig = {
    apiKey: "test",
    baseUrl: "https://api.incheck.ai",
    environment: "production",
    timeoutMs: 500,
    headers: {}
  };
  return new HttpTransport(options, config);
}

describe("HttpTransport error mapping", () => {
  it("maps 401 to IncheckAuthenticationError", async () => {
    const transport = makeTransport(async () => new Response(JSON.stringify({ message: "bad auth" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    }));

    await expect(transport.request({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(
      IncheckAuthenticationError
    );
  });

  it("prefers detail field for error message", async () => {
    const transport = makeTransport(async () => new Response(JSON.stringify({ detail: "bad request detail" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    }));

    await expect(transport.request({ method: "GET", path: "/x" })).rejects.toMatchObject({
      constructor: IncheckValidationError,
      message: "bad request detail"
    });
  });

  it("maps 403 to IncheckPermissionError", async () => {
    const transport = makeTransport(async () => new Response("nope", { status: 403 }));
    await expect(transport.request({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(
      IncheckPermissionError
    );
  });

  it("maps 404 to IncheckNotFoundError", async () => {
    const transport = makeTransport(async () => new Response("", { status: 404 }));
    await expect(transport.request({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(
      IncheckNotFoundError
    );
  });

  it("maps 429 to IncheckRateLimitError and includes retry-after", async () => {
    const transport = makeTransport(async () => new Response(JSON.stringify({ message: "slow down" }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "7" }
    }));

    await expect(transport.request({ method: "GET", path: "/x" })).rejects.toMatchObject({
      constructor: IncheckRateLimitError,
      message: "slow down (retry-after=7)"
    });
  });

  it("maps 400 and 422 to IncheckValidationError", async () => {
    const transport400 = makeTransport(async () => new Response(JSON.stringify({ message: "bad" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    }));
    const transport422 = makeTransport(async () => new Response(JSON.stringify({ message: "bad" }), {
      status: 422,
      headers: { "content-type": "application/json" }
    }));

    await expect(transport400.request({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(
      IncheckValidationError
    );
    await expect(transport422.request({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(
      IncheckValidationError
    );
  });

  it("maps 5xx to IncheckApiError", async () => {
    const transport = makeTransport(async () => new Response("oops", { status: 503 }));
    await expect(transport.request({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(
      IncheckApiError
    );
  });

  it("maps fetch failures to IncheckApiConnectionError", async () => {
    const transport = makeTransport(async () => {
      throw new Error("network broke");
    });

    await expect(transport.request({ method: "GET", path: "/x" })).rejects.toBeInstanceOf(
      IncheckApiConnectionError
    );
  });
});
