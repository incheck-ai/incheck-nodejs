import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import {
  IncheckJobFailedError,
  IncheckJobTimeoutError,
  IncheckValidationError
} from "../errors/index.js";
import type {
  DeleteResponse,
  DocumentListResponse,
  FileSpec,
  InlineUploadFile,
  JobStatus,
  OrgInfo,
  OrgListResponse,
  RequestOptions,
  UpdateInitiated,
  UploadCompleted,
  UploadInitiated,
  UploadOptions,
  VersionInfo
} from "../models/types.js";
import { HttpTransport } from "../transport/http.js";

interface PollOptions extends RequestOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

interface NormalizedUploadFile {
  filename: string;
  data: Uint8Array;
}

interface ResolvedPresignedTarget {
  url: string;
  fields: Record<string, string>;
}

export class DocumentsResource {
  constructor(private readonly http: HttpTransport) {}

  async listOrgs(options?: RequestOptions): Promise<OrgListResponse> {
    const response = await this.http.request<unknown>({
      method: "GET",
      path: "/documents/orgs",
      options
    });

    if (response && typeof response === "object" && "org_ids" in response) {
      const raw = response as Record<string, unknown>;
      const orgIds = Array.isArray(raw.org_ids) ? (raw.org_ids as Array<OrgInfo | string>) : [];
      const normalizedOrgs = orgIds
        .filter((v): v is OrgInfo => typeof v === "object" && v !== null && "org_id" in v);
      return {
        ...(raw as unknown as OrgListResponse),
        org_ids: orgIds,
        orgs: normalizedOrgs
      };
    }

    if (Array.isArray(response)) {
      return {
        org_ids: response as OrgInfo[],
        total_count: response.length,
        orgs: response as OrgInfo[]
      };
    }

    if (response && typeof response === "object") {
      const candidate = response as Record<string, unknown>;
      if (Array.isArray(candidate.orgs)) {
        return {
          org_ids: candidate.orgs as OrgInfo[],
          total_count: candidate.orgs.length,
          orgs: candidate.orgs as OrgInfo[]
        };
      }
      if (Array.isArray(candidate.organizations)) {
        return {
          org_ids: candidate.organizations as OrgInfo[],
          total_count: candidate.organizations.length,
          orgs: candidate.organizations as OrgInfo[]
        };
      }
      if (Array.isArray(candidate.data)) {
        return {
          org_ids: candidate.data as OrgInfo[],
          total_count: candidate.data.length,
          orgs: candidate.data as OrgInfo[]
        };
      }
    }

    return { org_ids: [], total_count: 0, orgs: [] };
  }

  async list(orgId: string, options?: RequestOptions): Promise<DocumentListResponse> {
    this.assertOrgId(orgId);
    const response = await this.http.request<DocumentListResponse>({
      method: "GET",
      path: `/documents/orgs/${encodeURIComponent(orgId)}/documents`,
      options
    });
    return {
      ...response,
      documents: response.documents.map((doc) => ({
        ...doc,
        id: doc.id ?? doc.document_id,
        download_url: doc.download_url ?? doc.presigned_url
      }))
    };
  }

  async version(orgId: string, options?: RequestOptions): Promise<VersionInfo> {
    this.assertOrgId(orgId);
    return this.http.request<VersionInfo>({
      method: "GET",
      path: `/documents/orgs/${encodeURIComponent(orgId)}/version`,
      options
    });
  }

  async initiateUpload(
    orgId: string,
    filenames: string[],
    batchSize = 6,
    options?: RequestOptions
  ): Promise<UploadInitiated> {
    this.assertOrgId(orgId);
    this.assertFileNames(filenames);
    return this.http.request<UploadInitiated>({
      method: "POST",
      path: "/documents/initiate-upload",
      body: { org_id: orgId, filenames, batch_size: batchSize },
      options
    });
  }

  async completeUpload(
    jobId: string,
    uploadedFiles: string[],
    options?: RequestOptions
  ): Promise<UploadCompleted> {
    this.assertJobId(jobId);
    return this.http.request<UploadCompleted>({
      method: "POST",
      path: "/documents/complete-upload",
      body: { job_id: jobId, uploaded_files: uploadedFiles },
      options
    });
  }

  async initiateUpdate(
    orgId: string,
    filenames: string[],
    batchSize = 6,
    options?: RequestOptions
  ): Promise<UpdateInitiated> {
    this.assertOrgId(orgId);
    this.assertFileNames(filenames);
    return this.http.request<UpdateInitiated>({
      method: "PUT",
      path: `/documents/orgs/${encodeURIComponent(orgId)}/documents/initiate`,
      body: { filenames, batch_size: batchSize },
      options
    });
  }

  async completeUpdate(
    orgId: string,
    jobId: string,
    uploadedFiles: string[],
    options?: RequestOptions
  ): Promise<UploadCompleted> {
    this.assertOrgId(orgId);
    this.assertJobId(jobId);
    return this.http.request<UploadCompleted>({
      method: "PUT",
      path: `/documents/orgs/${encodeURIComponent(orgId)}/documents/complete`,
      body: { job_id: jobId, uploaded_files: uploadedFiles },
      options
    });
  }

  async job(jobId: string, options?: RequestOptions): Promise<JobStatus> {
    this.assertJobId(jobId);
    return this.http.request<JobStatus>({
      method: "GET",
      path: `/documents/job/${encodeURIComponent(jobId)}`,
      options
    });
  }

  async waitForJob(jobId: string, options?: PollOptions): Promise<JobStatus> {
    this.assertJobId(jobId);
    const timeoutMs = options?.timeoutMs ?? 600_000;
    const pollIntervalMs = options?.pollIntervalMs ?? 10_000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (options?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const status = await this.job(jobId, options);
      if (status.status === "completed") {
        return status;
      }
      if (status.status === "failed") {
        throw new IncheckJobFailedError(
          status.error ?? `Document job ${jobId} failed`,
          status
        );
      }

      await this.sleep(pollIntervalMs, options?.signal);
    }

    throw new IncheckJobTimeoutError(`Timed out waiting for document job ${jobId}`, {
      jobId,
      timeoutMs
    });
  }

  async deleteVersion(
    orgId: string,
    version: string | number,
    options?: RequestOptions
  ): Promise<DeleteResponse> {
    this.assertOrgId(orgId);
    if (version === null || version === undefined || String(version).trim() === "") {
      throw new IncheckValidationError("version must be a non-empty string or number");
    }
    const response = await this.http.request<Partial<DeleteResponse>>({
      method: "DELETE",
      path: `/documents/orgs/${encodeURIComponent(orgId)}/versions/${encodeURIComponent(String(version))}`,
      options
    });
    return this.normalizeDeleteResponse(response);
  }

  async delete(orgId: string, options?: RequestOptions): Promise<DeleteResponse> {
    this.assertOrgId(orgId);
    const response = await this.http.request<Partial<DeleteResponse>>({
      method: "DELETE",
      path: `/documents/orgs/${encodeURIComponent(orgId)}`,
      options
    });
    return this.normalizeDeleteResponse(response);
  }

  async upload(
    orgId: string,
    files: FileSpec[],
    options?: UploadOptions
  ): Promise<UploadCompleted | JobStatus> {
    this.assertOrgId(orgId);
    if (!Array.isArray(files) || files.length === 0) {
      throw new IncheckValidationError("files must be a non-empty array");
    }

    const normalizedFiles = await this.normalizeFiles(files);
    const initiated = await this.initiateUpload(
      orgId,
      normalizedFiles.map((f) => f.filename),
      options?.batchSize ?? 6,
      options
    );

    const uploadEntries = initiated.uploads ?? initiated.upload_urls;
    if (!Array.isArray(uploadEntries) || uploadEntries.length === 0) {
      throw new IncheckValidationError(
        "Missing presigned upload targets in initiate-upload response"
      );
    }
    const uploadsByName = new Map(uploadEntries.map((u) => [u.filename, u]));

    for (const file of normalizedFiles) {
      const presigned = uploadsByName.get(file.filename);
      if (!presigned) {
        throw new IncheckValidationError(
          `Missing presigned upload target for file: ${file.filename}`
        );
      }

      const target = this.resolvePresignedTarget(presigned as unknown as Record<string, unknown>);
      await this.uploadToPresignedUrl(target.url, target.fields, file, options);
    }

    const completed = await this.completeUpload(
      initiated.job_id,
      normalizedFiles.map((f) => f.filename),
      options
    );

    if (options?.wait === false) {
      return completed;
    }

    return this.waitForJob(initiated.job_id, {
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
      pollIntervalMs: options?.pollIntervalMs
    });
  }

  private async normalizeFiles(files: FileSpec[]): Promise<NormalizedUploadFile[]> {
    const normalized: NormalizedUploadFile[] = [];
    for (const file of files) {
      if (typeof file === "string") {
        const data = new Uint8Array(await readFile(file));
        if (data.length === 0) {
          throw new IncheckValidationError(`File is empty: ${file}`);
        }
        normalized.push({ filename: basename(file), data });
        continue;
      }

      const inline = file as InlineUploadFile;
      if (!inline.filename) {
        throw new IncheckValidationError("Inline file requires filename");
      }
      const data = await this.normalizeInlineData(inline.filename, inline.data);
      if (data.length === 0) {
        throw new IncheckValidationError(`File is empty: ${inline.filename}`);
      }
      normalized.push({ filename: inline.filename, data });
    }
    return normalized;
  }

  private async normalizeInlineData(filename: string, data: InlineUploadFile["data"]): Promise<Uint8Array> {
    if (!data) {
      throw new IncheckValidationError(`File is empty: ${filename}`);
    }
    if (data instanceof Blob) {
      return new Uint8Array(await data.arrayBuffer());
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    throw new IncheckValidationError(
      `Unsupported inline file data for ${filename}; expected Uint8Array, Buffer, ArrayBuffer, or Blob`
    );
  }

  private async uploadToPresignedUrl(
    url: string,
    fields: Record<string, string>,
    file: NormalizedUploadFile,
    options?: UploadOptions
  ): Promise<void> {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }
    const copied = new Uint8Array(file.data);
    formData.set("file", new Blob([copied.buffer]), file.filename);

    const response = await this.http.getFetch()(url, {
      method: "POST",
      body: formData,
      signal: options?.signal
    });

    if (response.status !== 200 && response.status !== 204) {
      throw new IncheckValidationError(
        `Presigned upload failed for ${file.filename} with status ${response.status}`
      );
    }
  }

  private resolvePresignedTarget(raw: Record<string, unknown>): ResolvedPresignedTarget {
    const urlCandidate = raw.url ?? raw.upload_url;
    const fieldsCandidate = raw.fields ?? raw.upload_fields;

    if (typeof urlCandidate !== "string" || !urlCandidate) {
      throw new IncheckValidationError("Missing presigned upload url");
    }
    if (!fieldsCandidate || typeof fieldsCandidate !== "object") {
      throw new IncheckValidationError("Missing presigned upload fields");
    }

    return {
      url: urlCandidate,
      fields: fieldsCandidate as Record<string, string>
    };
  }

  private normalizeDeleteResponse(response: Partial<DeleteResponse> | null | undefined): DeleteResponse {
    return {
      ...(response ?? {}),
      success: response?.success ?? true
    };
  }

  private assertOrgId(orgId: string): void {
    if (!orgId) {
      throw new IncheckValidationError("orgId is required");
    }
  }

  private assertJobId(jobId: string): void {
    if (!jobId) {
      throw new IncheckValidationError("jobId is required");
    }
  }

  private assertFileNames(filenames: string[]): void {
    if (!Array.isArray(filenames) || filenames.length === 0) {
      throw new IncheckValidationError("filenames must be a non-empty array");
    }
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (!signal) {
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true }
      );
    });
  }
}
