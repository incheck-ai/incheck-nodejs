export class IncheckError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly responseBody?: unknown;

  constructor(message: string, options?: { statusCode?: number; code?: string; responseBody?: unknown }) {
    super(message);
    this.name = "IncheckError";
    this.statusCode = options?.statusCode;
    this.code = options?.code;
    this.responseBody = options?.responseBody;
  }
}

export class IncheckAuthenticationError extends IncheckError {
  constructor(message = "Authentication failed", responseBody?: unknown) {
    super(message, { statusCode: 401, code: "authentication_error", responseBody });
    this.name = "IncheckAuthenticationError";
  }
}

export class IncheckRateLimitError extends IncheckError {
  readonly retryAfter: number | null;

  constructor(message = "Rate limit exceeded", responseBody?: unknown, retryAfter: number | null = null) {
    super(message, { statusCode: 429, code: "rate_limit_error", responseBody });
    this.name = "IncheckRateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class IncheckValidationError extends IncheckError {
  constructor(message = "Validation error", responseBody?: unknown) {
    super(message, { statusCode: 400, code: "validation_error", responseBody });
    this.name = "IncheckValidationError";
  }
}

export class IncheckPermissionError extends IncheckError {
  constructor(message = "Permission denied", responseBody?: unknown) {
    super(message, { statusCode: 403, code: "permission_error", responseBody });
    this.name = "IncheckPermissionError";
  }
}

export class IncheckNotFoundError extends IncheckError {
  constructor(message = "Resource not found", responseBody?: unknown) {
    super(message, { statusCode: 404, code: "not_found_error", responseBody });
    this.name = "IncheckNotFoundError";
  }
}

export class IncheckApiError extends IncheckError {
  constructor(message = "API error", options?: { statusCode?: number; responseBody?: unknown }) {
    super(message, { statusCode: options?.statusCode, code: "api_error", responseBody: options?.responseBody });
    this.name = "IncheckApiError";
  }
}

export class IncheckApiConnectionError extends IncheckError {
  constructor(message = "Connection error", responseBody?: unknown) {
    super(message, { code: "api_connection_error", responseBody });
    this.name = "IncheckApiConnectionError";
  }
}

export class IncheckJobFailedError extends IncheckError {
  constructor(message = "Job failed", responseBody?: unknown) {
    super(message, { code: "job_failed_error", responseBody });
    this.name = "IncheckJobFailedError";
  }
}

export class IncheckJobTimeoutError extends IncheckError {
  constructor(message = "Job timed out", responseBody?: unknown) {
    super(message, { code: "job_timeout_error", responseBody });
    this.name = "IncheckJobTimeoutError";
  }
}
