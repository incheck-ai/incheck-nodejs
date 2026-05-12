import { afterEach, describe, expect, it } from "vitest";
import { IncheckValidationError } from "../../src/errors/index.js";
import { resolveClientConfig } from "../../src/config.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveClientConfig", () => {
  it("uses precedence options.baseUrl > env base url > environment", () => {
    process.env.INCHECK_API_KEY = "env-key";
    process.env.INCHECK_BASE_URL = "https://env.example.com";
    process.env.INCHECK_ENVIRONMENT = "staging";

    const cfg = resolveClientConfig({
      apiKey: "opt-key",
      baseUrl: "https://opt.example.com",
      environment: "production"
    });

    expect(cfg.baseUrl).toBe("https://opt.example.com");
    expect(cfg.apiKey).toBe("opt-key");
    expect(cfg.environment).toBe("production");
  });

  it("uses staging URL from environment when no explicit base url", () => {
    process.env.INCHECK_API_KEY = "env-key";
    process.env.INCHECK_ENVIRONMENT = "staging";
    delete process.env.INCHECK_BASE_URL;

    const cfg = resolveClientConfig({});
    expect(cfg.baseUrl).toBe("https://api-acceptance.incheck.ai");
  });

  it("throws for invalid environment", () => {
    process.env.INCHECK_API_KEY = "env-key";
    process.env.INCHECK_ENVIRONMENT = "broken";

    expect(() => resolveClientConfig({})).toThrow(IncheckValidationError);
  });

  it("throws when api key is missing", () => {
    delete process.env.INCHECK_API_KEY;
    expect(() => resolveClientConfig({})).toThrow(IncheckValidationError);
  });
});
