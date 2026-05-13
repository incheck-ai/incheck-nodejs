import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Client, type IncheckClient, type JobStatus, type PresignedUpload } from "../../src/index.js";

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
    const value = line.slice(sepIndex + 1).trim().replace(/^[\'"]|[\'"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const hasApiKey = Boolean(process.env.INCHECK_API_KEY);
const runMutating = process.env.INCHECK_RUN_MUTATING_TESTS === "1";

async function resolveNamespace(client: IncheckClient): Promise<string> {
  if (process.env.INCHECK_TEST_NAMESPACE) {
    return process.env.INCHECK_TEST_NAMESPACE;
  }

  const orgs = await client.documents.listOrgs({ timeoutMs: 30_000 });
  if (typeof orgs.filtered_by === "string" && orgs.filtered_by.trim()) {
    return orgs.filtered_by.trim();
  }

  throw new Error(
    "Cannot infer API namespace from documents.listOrgs(); set INCHECK_TEST_NAMESPACE for mutating integration tests."
  );
}

function makeOrgId(namespace: string, label: string): string {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  return `${namespace}_nodejs_${label}_${Date.now()}_${suffix}`;
}

function expectCompleted(status: JobStatus): void {
  expect(status.job_id).toBeTruthy();
  expect(status.status).toBe("completed");
}

function getPresignedUploads(uploads: PresignedUpload[] | undefined): PresignedUpload[] {
  expect(Array.isArray(uploads)).toBe(true);
  expect(uploads?.length).toBeGreaterThan(0);
  return uploads ?? [];
}

async function uploadToPresignedUrl(presigned: PresignedUpload, contents: string): Promise<void> {
  const url = presigned.url ?? presigned.upload_url;
  const fields = presigned.fields ?? presigned.upload_fields;

  expect(typeof url).toBe("string");
  expect(url).toBeTruthy();
  expect(fields).toBeDefined();

  const form = new FormData();
  for (const [key, value] of Object.entries(fields ?? {})) {
    form.set(key, value);
  }
  form.set("file", new Blob([contents], { type: "text/plain" }), presigned.filename);

  const response = await fetch(url as string, {
    method: "POST",
    body: form
  });

  if (response.status !== 200 && response.status !== 204) {
    throw new Error(
      `Presigned upload failed for ${presigned.filename}: HTTP ${response.status} ${await response.text()}`
    );
  }
}

// Disabled by default because these tests create, update, and delete live API data.
// Temporarily switch to `describe.skipIf(!hasApiKey || !runMutating)` for manual verification.
describe.skip("Mutating document lifecycle integration tests", () => {
  it("can upload a throwaway org with the high-level helper and delete it", async () => {
    const client = new Client();
    const namespace = await resolveNamespace(client);
    const orgId = makeOrgId(namespace, "helper");

    try {
      const status = await client.documents.upload(
        orgId,
        [
          {
            filename: "node-helper-upload.txt",
            data: new TextEncoder().encode("Node SDK high-level upload integration test.")
          }
        ],
        {
          wait: true,
          timeoutMs: 180_000,
          pollIntervalMs: 5_000
        }
      );

      expectCompleted(status as JobStatus);

      const docs = await client.documents.list(orgId, { timeoutMs: 30_000 });
      expect(docs.org_id).toBe(orgId);
      expect(docs.documents.map((doc) => doc.filename)).toContain("node-helper-upload.txt");

      const version = await client.documents.version(orgId, { timeoutMs: 30_000 });
      expect(version.org_id).toBe(orgId);
      expect(version.current_version).toBeTruthy();
    } finally {
      await client.documents.delete(orgId, { timeoutMs: 30_000 }).catch(() => undefined);
    }
  }, 240_000);

  it("can run low-level upload, update, deleteVersion, and delete", async () => {
    const client = new Client();
    const namespace = await resolveNamespace(client);
    const orgId = makeOrgId(namespace, "lifecycle");
    let initialVersion: string | undefined;

    try {
      const initiated = await client.documents.initiateUpload(
        orgId,
        ["node-low-level-upload.txt"],
        6,
        { timeoutMs: 30_000 }
      );
      expect(initiated.job_id).toBeTruthy();
      expect(initiated.org_id).toBe(orgId);
      initialVersion = initiated.version;

      const uploadTargets = getPresignedUploads(initiated.uploads ?? initiated.upload_urls);
      await uploadToPresignedUrl(
        uploadTargets[0],
        "Node SDK low-level initiate/complete upload integration test."
      );

      const completed = await client.documents.completeUpload(
        initiated.job_id,
        ["node-low-level-upload.txt"],
        { timeoutMs: 30_000 }
      );
      expect(completed.job_id).toBe(initiated.job_id);

      const uploadStatus = await client.documents.waitForJob(completed.job_id, {
        timeoutMs: 180_000,
        pollIntervalMs: 5_000
      });
      expectCompleted(uploadStatus);
      initialVersion = initialVersion ?? uploadStatus.version ?? undefined;

      const updateInitiated = await client.documents.initiateUpdate(
        orgId,
        ["node-low-level-update.txt"],
        6,
        { timeoutMs: 30_000 }
      );
      expect(updateInitiated.job_id).toBeTruthy();
      expect(updateInitiated.org_id).toBe(orgId);
      expect(updateInitiated.new_version).toBeTruthy();

      const updateTargets = getPresignedUploads(updateInitiated.upload_urls);
      await uploadToPresignedUrl(
        updateTargets[0],
        "Node SDK low-level initiate/complete update integration test."
      );

      const updateCompleted = await client.documents.completeUpdate(
        orgId,
        updateInitiated.job_id,
        ["node-low-level-update.txt"],
        { timeoutMs: 30_000 }
      );
      expect(updateCompleted.job_id).toBe(updateInitiated.job_id);

      const updateStatus = await client.documents.waitForJob(updateCompleted.job_id, {
        timeoutMs: 180_000,
        pollIntervalMs: 5_000
      });
      expectCompleted(updateStatus);

      const docs = await client.documents.list(orgId, { timeoutMs: 30_000 });
      expect(docs.documents.map((doc) => doc.filename)).toContain("node-low-level-update.txt");

      if (!initialVersion || initialVersion === updateInitiated.new_version) {
        const currentVersion = await client.documents.version(orgId, { timeoutMs: 30_000 });
        initialVersion = currentVersion.current_version ?? undefined;
      }

      expect(initialVersion).toBeTruthy();
      const deleteVersion = await client.documents.deleteVersion(orgId, initialVersion as string, {
        timeoutMs: 30_000
      });
      expect(deleteVersion.success).toBe(true);

      const deleteOrg = await client.documents.delete(orgId, { timeoutMs: 30_000 });
      expect(deleteOrg.success).toBe(true);
    } finally {
      await client.documents.delete(orgId, { timeoutMs: 30_000 }).catch(() => undefined);
    }
  }, 300_000);
});
