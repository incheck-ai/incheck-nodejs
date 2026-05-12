export type IncheckMode = "ems" | "unified";
export type IncheckEnvironment = "production" | "staging";

export interface ResolvedIncheckConfig {
  apiKey: string;
  baseUrl: string;
  environment: IncheckEnvironment;
  timeoutMs: number;
  headers: Record<string, string>;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface IncheckClientOptions {
  apiKey?: string;
  environment?: IncheckEnvironment;
  baseUrl?: string;
  mode?: IncheckMode;
  organizationId?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
}

export interface UploadDocumentRequest {
  fileName: string;
  contentType: string;
  data: Uint8Array;
  metadata?: Record<string, string>;
}

export interface UploadDocumentResponse {
  id: string;
  status: string;
  fileName?: string;
  downloadUrl?: string;
  createdAt?: string;
}

export interface GetDocumentResponse extends UploadDocumentResponse {}

export interface DeleteDocumentResponse {
  id: string;
  deleted: boolean;
}

export interface OrgInfo {
  org_id: string;
  name?: string;
}

export interface OrgListResponse {
  orgs: OrgInfo[];
}

export interface DocumentInfo {
  filename: string;
  content_type?: string;
  presigned_url?: string;
  download_url?: string;
}

export interface DocumentListResponse {
  org_id: string;
  documents: DocumentInfo[];
}

export interface VersionInfo {
  org_id: string;
  version: number;
}

export interface PresignedUpload {
  filename: string;
  url: string;
  fields: Record<string, string>;
}

export interface UploadInitiated {
  job_id: string;
  uploads: PresignedUpload[];
}

export interface UploadCompleted {
  job_id: string;
  status: string;
}

export interface UploadedFileRef {
  filename: string;
}

export interface InlineUploadFile {
  filename: string;
  data: Uint8Array;
}

export type FileSpec = string | InlineUploadFile;

export interface UploadOptions extends RequestOptions {
  batchSize?: number;
  wait?: boolean;
  pollIntervalMs?: number;
}

export interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  error?: string;
  progress?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequestOptions extends RequestOptions {
  orgId?: string;
  userId?: string;
  conversationId?: string;
  scope?: string;
  state?: string;
  conversationHx?: string;
}

export interface ChatCompletionRequest {
  content: string;
  options?: ChatRequestOptions;
}

export interface ChatCompletionResponse {
  content: string;
  raw?: StreamChatChunk[];
}

export interface StreamChatChunk {
  content?: string;
  type?: string;
  error?: string;
}
