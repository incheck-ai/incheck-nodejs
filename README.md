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

## Chat (EMS / Unified)

### One-shot response

```ts
const result = await client.chat.create({
  content: "Summarize this patient note.",
  options: {
    orgId: "org_123", // optional; omit for EMS mode
    userId: "user_42"
  }
});

console.log(result.content);
```

### Streaming response

```ts
for await (const chunk of client.chat.stream({
  content: "Give me a step-by-step care plan.",
  options: { orgId: "org_123" }
})) {
  if (chunk.content) process.stdout.write(chunk.content);
}
```

## Documents

### List orgs / documents

```ts
const orgs = await client.documents.listOrgs();
const docs = await client.documents.list("org_123");

// Normalization: download_url falls back to presigned_url
console.log(docs.documents[0]?.download_url);
```

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

## Error Handling

```ts
import {
  IncheckAuthenticationError,
  IncheckRateLimitError,
  IncheckValidationError
} from "incheck-nodejs";

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
