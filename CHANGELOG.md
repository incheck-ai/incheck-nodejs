# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-05-12

### Added

- Initial TypeScript Node.js SDK structure and build setup.
- `Client` / `IncheckClient` / `AsyncClient` exports.
- Configuration resolution for API key, environment, base URL, timeout, and headers.
- HTTP transport layer with request/response handling.
- Typed error hierarchy and HTTP status-to-error mapping.
- Chat resource support for one-shot (`chat.create`) and streaming (`chat.stream`) APIs.
- Documents resource support for org listing, documents listing/versioning, upload initiation/completion, update initiation/completion, job polling, and delete operations.
- End-to-end document upload helper with presigned URL multipart upload flow.
- Unit test suite for config, transport errors, chat behavior, file input handling, client aliases, and document response normalization.

### Changed

- Normalized `documents.list` document URL output to ensure `download_url` falls back from `presigned_url` when needed.
- Normalized `documents.listOrgs` response shapes to consistently return `{ orgs: [...] }`.
- Updated package metadata (`repository`, `homepage`, `bugs`, `keywords`).
