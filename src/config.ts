import { IncheckValidationError } from "./errors/index.js";
import type {
  IncheckClientOptions,
  IncheckEnvironment,
  ResolvedIncheckConfig
} from "./models/types.js";

const PRODUCTION_BASE_URL = "https://api.incheck.ai";
const STAGING_BASE_URL = "https://api-acceptance.incheck.ai";
const DEFAULT_TIMEOUT_MS = 60_000;

function resolveEnvironment(
  optionsEnvironment?: IncheckEnvironment,
  envEnvironment?: string
): IncheckEnvironment {
  const resolved = optionsEnvironment ?? envEnvironment ?? "production";
  if (resolved !== "production" && resolved !== "staging") {
    throw new IncheckValidationError(
      `Invalid environment: ${resolved}. Expected 'production' or 'staging'.`
    );
  }
  return resolved;
}

function baseUrlFromEnvironment(environment: IncheckEnvironment): string {
  return environment === "staging" ? STAGING_BASE_URL : PRODUCTION_BASE_URL;
}

export function resolveClientConfig(options: IncheckClientOptions): ResolvedIncheckConfig {
  const environment = resolveEnvironment(
    options.environment,
    process.env.INCHECK_ENVIRONMENT
  );

  const baseUrl =
    options.baseUrl ??
    process.env.INCHECK_BASE_URL ??
    baseUrlFromEnvironment(environment);

  const apiKey = options.apiKey ?? process.env.INCHECK_API_KEY;
  if (!apiKey) {
    throw new IncheckValidationError(
      "Missing API key. Provide options.apiKey or set INCHECK_API_KEY."
    );
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    environment,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    headers: options.headers ?? {}
  };
}
