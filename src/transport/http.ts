import type {
  IncheckClientOptions,
  RequestOptions,
  ResolvedIncheckConfig
} from "../models/types.js";
import {
  IncheckError,
  IncheckApiConnectionError,
  IncheckApiError,
  IncheckAuthenticationError,
  IncheckNotFoundError,
  IncheckPermissionError,
  IncheckRateLimitError,
  IncheckValidationError
} from "../errors/index.js";
import { VERSION } from "../version.js";

export interface HttpRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  options?: RequestOptions;
}

export class HttpTransport {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly config: ResolvedIncheckConfig;

  constructor(options: IncheckClientOptions, config: ResolvedIncheckConfig) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.config = config;
  }

  async request<T>(req: HttpRequest): Promise<T> {
    const response = await this.requestRaw(req);
    const payload = await this.parseResponseBody(response);
    return payload as T;
  }

  async requestRaw(req: HttpRequest): Promise<Response> {
    const timeoutMs = req.options?.timeoutMs ?? this.config.timeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const signal = req.options?.signal
      ? AbortSignal.any([req.options.signal, controller.signal])
      : controller.signal;

    const isJsonBody =
      req.body !== undefined &&
      req.body !== null &&
      typeof req.body === "object" &&
      !(req.body instanceof Uint8Array) &&
      !(req.body instanceof FormData);
    const requestHeaders = isJsonBody
      ? this.buildHeaders({ "Content-Type": "application/json", ...(req.headers ?? {}) })
      : this.buildHeaders(req.headers);

    try {
      const response = await this.fetchImpl(this.buildUrl(req.path), {
        method: req.method,
        headers: requestHeaders,
        body: this.serializeBody(req.body),
        signal
      });

      if (!response.ok) {
        const payload = await this.parseResponseBody(response);
        this.throwMappedError(response.status, payload, response);
      }

      return response;
    } catch (error) {
      if (error instanceof IncheckError) {
        throw error;
      }
      if (error instanceof Error && error.name !== "AbortError") {
        throw new IncheckApiConnectionError(error.message, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  getOptions(): ResolvedIncheckConfig {
    return this.config;
  }

  getFetch(): typeof globalThis.fetch {
    return this.fetchImpl;
  }

  buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
      "User-Agent": `incheck-nodejs/${VERSION}`,
      ...this.config.headers,
      ...(additionalHeaders ?? {})
    };
  }

  buildUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.config.baseUrl}${normalizedPath}`;
  }

  private serializeBody(body: unknown): BodyInit | undefined {
    if (body === undefined || body === null) {
      return undefined;
    }
    if (typeof body === "string" || body instanceof FormData) {
      return body;
    }
    if (body instanceof Uint8Array) {
      const copied = new Uint8Array(body);
      return new Blob([copied.buffer]);
    }
    return JSON.stringify(body);
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    const text = await response.text();
    if (!text) {
      return {};
    }
    return text;
  }

  private throwMappedError(status: number, payload: unknown, response: Response): never {
    const message = this.extractMessage(payload) ?? `HTTP ${status}`;
    if (status === 401) {
      throw new IncheckAuthenticationError(message, payload);
    }
    if (status === 403) {
      throw new IncheckPermissionError(message, payload);
    }
    if (status === 404) {
      throw new IncheckNotFoundError(message, payload);
    }
    if (status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfter ? Number.parseFloat(retryAfter) : null;
      throw new IncheckRateLimitError(
        retryAfter ? `${message} (retry-after=${retryAfter})` : message,
        payload,
        Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null
      );
    }
    if (status === 400 || status === 422) {
      throw new IncheckValidationError(message, payload);
    }
    if (status >= 500) {
      throw new IncheckApiError(message, { statusCode: status, responseBody: payload });
    }
    throw new IncheckApiError(message, { statusCode: status, responseBody: payload });
  }

  private extractMessage(payload: unknown): string | undefined {
    if (!payload || typeof payload !== "object") {
      return undefined;
    }
    if ("detail" in payload) {
      const detail = payload.detail;
      if (typeof detail === "string" && detail) {
        return detail;
      }
      if (Array.isArray(detail) && detail.length > 0) {
        return detail.map((item) => String(item)).join("; ");
      }
    }
    if ("message" in payload && typeof payload.message === "string") {
      return payload.message;
    }
    if ("error" in payload && typeof payload.error === "string") {
      return payload.error;
    }
    return undefined;
  }
}
