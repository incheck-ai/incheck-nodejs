import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Client } from "../../src/index.js";
import { IncheckRateLimitError } from "../../src/errors/index.js";

function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const sepIndex = line.indexOf("=");
    if (sepIndex <= 0) {
      continue;
    }

    const key = line.slice(0, sepIndex).trim();
    const value = line.slice(sepIndex + 1).trim().replace(/^['\"]|['\"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const hasApiKey = Boolean(process.env.INCHECK_API_KEY);
const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const RETRY_AFTER_REGEX = /retry-after=(\d+)/i;
const MAX_CHAT_ATTEMPTS = 3;

async function withRateLimitRetry<T>(action: () => Promise<T>, skipMessage: string): Promise<T | undefined> {
  for (let attempt = 1; attempt <= MAX_CHAT_ATTEMPTS; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof IncheckRateLimitError)) {
        throw error;
      }
      if (attempt === MAX_CHAT_ATTEMPTS) {
        console.warn(skipMessage);
        return undefined;
      }

      const retrySeconds = Number(error.message.match(RETRY_AFTER_REGEX)?.[1] ?? "2");
      const waitMs = Number.isFinite(retrySeconds) && retrySeconds > 0 ? retrySeconds * 1000 : 2_000;
      await sleep(waitMs);
    }
  }

  return undefined;
}

describe.skipIf(!hasApiKey)("Integration smoke tests", () => {
  it("can list organizations with live API", async () => {
    const client = new Client();
    const response = await client.documents.listOrgs();

    expect(response).toBeDefined();
    expect(Array.isArray(response.orgs)).toBe(true);
  }, 30_000);

  it("can list documents for one organization and normalizes URLs", async () => {
    const client = new Client();
    const { orgs } = await client.documents.listOrgs();
    expect(Array.isArray(orgs)).toBe(true);

    if (orgs.length === 0) {
      return;
    }

    const orgId = orgs[0]?.org_id;
    expect(typeof orgId).toBe("string");
    expect(orgId).toBeTruthy();
    if (!orgId) {
      return;
    }

    const docs = await client.documents.list(orgId);
    expect(docs.org_id).toBe(orgId);
    expect(Array.isArray(docs.documents)).toBe(true);

    for (const doc of docs.documents) {
      if (doc.download_url !== undefined) {
        expect(typeof doc.download_url).toBe("string");
      }
      if (doc.presigned_url && !doc.download_url) {
        throw new Error("Expected download_url normalization from presigned_url");
      }
    }
  }, 30_000);

  it("can create a chat completion with live API", async () => {
    const client = new Client();
    const response = await withRateLimitRetry(
      () =>
        client.chat.create({
          content: "Reply with exactly: pong",
          options: { timeoutMs: 20_000 }
        }),
      "Skipping chat.create integration assertion due to persistent API rate limiting (429)."
    );
    if (!response) {
      return;
    }

    expect(typeof response.content).toBe("string");
    expect(response.content.trim().length).toBeGreaterThan(0);
  }, 90_000);

  it("can stream chat chunks with live API", async () => {
    const client = new Client();
    const chunks = await withRateLimitRetry(
      async () => {
        const received: Array<{ content?: string; type?: string; error?: string }> = [];
        for await (const chunk of client.chat.stream({
          content: "Reply with exactly: pong",
          options: { timeoutMs: 20_000 }
        })) {
          received.push(chunk);
        }
        return received;
      },
      "Skipping chat.stream integration assertion due to persistent API rate limiting (429)."
    );
    if (!chunks) {
      return;
    }

    expect(Array.isArray(chunks)).toBe(true);
    expect(chunks.length).toBeGreaterThan(0);
    const combined = chunks.map((c) => c.content ?? "").join("").trim();
    expect(combined.length).toBeGreaterThan(0);
  }, 90_000);
});
