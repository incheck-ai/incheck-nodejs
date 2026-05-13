# InCheck Node.js SDK

TypeScript-first Node.js SDK for InCheck AI APIs.

## Install

```bash
npm install @incheckai/sdk
# or
pnpm add @incheckai/sdk
# or
yarn add @incheckai/sdk
# or
bun add @incheckai/sdk
```

## Requirements

- Node.js `>=18`

## Authentication

An API key is required. Provide it in one of these ways:

- Constructor option: `apiKey`
- Environment variable: `INCHECK_API_KEY`

If neither is set, client initialization fails with a validation error.

```ts
import { Client } from "@incheckai/sdk";

// Option 1: pass apiKey explicitly
const clientWithApiKey = new Client({
  apiKey: "your_api_key_here",
  environment: "production"
});

// Option 2: omit apiKey and use INCHECK_API_KEY from environment
const client = new Client({
  environment: "production"
});
```

## Environment and Base URL

Resolution order:

1. `baseUrl` option
2. `INCHECK_BASE_URL`
3. `environment` option (`"production" | "staging"`)
4. `INCHECK_ENVIRONMENT`
5. Production default (`https://api.incheck.ai`)

Staging URL:

- `https://api-acceptance.incheck.ai`

```ts
const client = new Client({
  environment: "staging"
});
```

## Client Exports

- `IncheckClient`
- `Client` (alias)
- `AsyncClient` (alias)

Client resources:
- `client.chat`
- `client.documents`
- `client.metadata`

## Chat (EMS / Unified)

### One-shot response

```ts
const result = await client.chat.send("Summarize this patient note.", {
  orgId: "org_123", // optional; omit for EMS mode
  userId: "user_42"
});

console.log(result.content);
```

`chat.send` options:
- `orgId?: string | string[]` (omit for EMS mode)
- `userId?: string` (default: `"sdk"`)
- `conversationId?: string` (auto-generated UUID when omitted)
- `scope?: string` (default: `"ALS"`)
- `state?: string` (default: `"Massachusetts"`)
- `messages?: Array<{ role, content }>`
- `conversationHx?: string` (legacy history field)

`chat.create({ content, options })` remains available as a backwards-compatible alias.

### Streaming response

```ts
for await (const chunk of client.chat.stream({
  content: "Give me a step-by-step care plan.",
  options: { orgId: "org_123" }
})) {
  if (chunk.content) process.stdout.write(chunk.content);
}
```

### Multi-turn context with `messages`

```ts
const reply = await client.chat.send("And for pediatric patients?", {
  messages: [
    { role: "user", content: "Adult atropine dose for bradycardia?" },
    { role: "assistant", content: "1 mg IV/IO q3-5min, max 3 mg." }
  ]
});
```

Notes:
- `messages` and `conversationHx` are legacy/new history inputs; when both are set, SDK sends `messages`.
- Current user turn stays in `content`.
- `orgId` can be a single string or a string array for multi-Pod fan-out.

## Metadata

Fetch the canonical state/scope reference data that `/chat` accepts:

```ts
const metadata = await client.metadata.statesAndScopes();

console.log(metadata.default_state);
console.log(metadata.default_scope);
console.log(metadata.scopes_by_state[metadata.default_state]);
```

## Documents

### List orgs / documents

```ts
const orgs = await client.documents.listOrgs();
const docs = await client.documents.list("org_123");

// Normalization: download_url falls back to presigned_url
console.log(docs.documents[0]?.download_url);
```

Current `documents.list` response shape (live API):

```json
{
  "org_id": "org_id",
  "version": "20260511_213242",
  "document_count": 1,
  "documents": [
    {
      "filename": "test_pdf_without_toc.pdf",
      "size_bytes": 4364,
      "last_modified": "2026-05-11T21:32:44+00:00",
      "presigned_url": "https://...X-Amz-Expires=3600...",
      "url_expires_in": 3600
    }
  ],
  "job_id": "b248ff0c-e2e7-494c-a91e-5d14d2b6337a",
  "s3_folder": "org_id/org_123/2026/05/11/20260511_213242"
}
```

Notes:

- `documents[].id` is not guaranteed by this endpoint.
- SDK normalization ensures `documents[].download_url` falls back from `presigned_url`.
- Presigned URLs are time-limited (`url_expires_in`, commonly `3600` seconds).
- `documents.version(orgId)` mirrors current API fields (`current_version`, `job_id`, `s3_folder`, `updated_at`).
- `documents.job(jobId)` exposes structured progress (`total_documents`, `total_pages`, `processed_pages`).
- `documents.delete(orgId)` and `documents.deleteVersion(orgId, version)` return `{ success, org_id?, version?, message? }`.
- `documents.deleteVersion(orgId, version)` accepts string or numeric version identifiers.

### Upload files

```ts
import { readFile } from "node:fs/promises";

const status = await client.documents.upload(
  "org_123",
  [
    "./docs/protocol.pdf",
    { filename: "extra.txt", data: new Uint8Array(await readFile("./docs/extra.txt")) }
  ],
  {
    batchSize: 6,
    wait: true,
    timeoutMs: 600_000,
    pollIntervalMs: 10_000
  }
);

console.log(status.status);
```

Inline upload data accepts `Uint8Array`, Node `Buffer`, `ArrayBuffer`, or `Blob`.

## Error Handling

```ts
import {
  IncheckAuthenticationError,
  IncheckRateLimitError,
  IncheckValidationError
} from "@incheckai/sdk";

try {
  await client.chat.create({ content: "Hello" });
} catch (error) {
  if (error instanceof IncheckAuthenticationError) {
    console.error("Bad API key");
  } else if (error instanceof IncheckRateLimitError) {
    console.error("Rate limited", error.message);
  } else if (error instanceof IncheckValidationError) {
    console.error("Validation issue", error.message);
  } else {
    console.error("Unhandled error", error);
  }
}
```
