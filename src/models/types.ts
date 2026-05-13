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

export type UploadFileData = Uint8Array | ArrayBuffer | Blob;

export interface UploadDocumentRequest {
  fileName: string;
  contentType: string;
  data: UploadFileData;
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

export interface DeleteResponse {
  success: boolean;
  org_id?: string | null;
  version?: string | null;
  message?: string | null;
}

export interface OrgInfo {
  org_id: string;
  org_name?: string;
  current_version?: string | null;
  document_count?: number | null;
  last_updated_at?: string | null;
}

export interface OrgListResponse {
  org_ids: Array<OrgInfo | string>;
  total_count?: number;
  filtered_by?: string;
  orgs?: OrgInfo[];
}

export interface DocumentInfo {
  id?: string;
  document_id?: string;
  filename: string;
  content_type?: string;
  size_bytes?: number;
  last_modified?: string;
  url_expires_in?: number;
  presigned_url?: string;
  download_url?: string;
}

export interface DocumentListResponse {
  org_id: string;
  version?: string;
  document_count?: number;
  job_id?: string;
  s3_folder?: string;
  expires_in?: number;
  documents: DocumentInfo[];
}

export interface VersionInfo {
  org_id: string;
  current_version?: string | null;
  job_id?: string | null;
  s3_folder?: string | null;
  updated_at?: string | null;
}

export interface PresignedUpload {
  filename: string;
  url?: string;
  fields?: Record<string, string>;
  upload_url?: string;
  upload_fields?: Record<string, string>;
  s3_key?: string;
  is_update?: boolean | null;
}

export interface UploadInitiated {
  job_id: string;
  org_name?: string;
  org_id?: string;
  version?: string;
  s3_folder?: string;
  expires_in?: number;
  created_at?: string;
  uploads?: PresignedUpload[];
  upload_urls?: PresignedUpload[];
}

export interface UpdateInitiated {
  job_id: string;
  org_name?: string;
  org_id?: string;
  current_version?: string | null;
  new_version: string;
  s3_folder?: string;
  upload_urls: PresignedUpload[];
  existing_documents_to_keep: string[];
  expires_in?: number;
  created_at?: string;
}

export interface UploadCompleted {
  job_id: string;
  status: string;
  org_name?: string;
  org_id?: string;
  version?: string;
  s3_folder?: string;
  files_confirmed?: string[];
  created_at?: string;
}

export interface InlineUploadFile {
  filename: string;
  data: UploadFileData;
}

export type FileSpec = string | InlineUploadFile;

export interface UploadOptions extends RequestOptions {
  batchSize?: number;
  wait?: boolean;
  pollIntervalMs?: number;
}

export interface JobProgress {
  total_documents?: number;
  total_pages?: number;
  processed_pages?: number;
}

export interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  error?: string;
  org_name?: string | null;
  org_id?: string | null;
  version?: string | null;
  s3_folder?: string | null;
  progress?: JobProgress;
  created_at?: string | null;
  completed_at?: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestOptions extends RequestOptions {
  orgId?: string | string[];
  userId?: string;
  conversationId?: string;
  scope?: string;
  state?: string;
  messages?: Array<ChatMessage | ChatMessageInput>;
  conversationHx?: string;
}

export interface StateOrScope {
  value: string;
  label: string;
}

export interface StatesAndScopesResponse {
  default_state: string;
  default_scope: string;
  states: StateOrScope[];
  scopes: StateOrScope[];
  scopes_by_state: Record<string, string[]>;
}

export interface ChatCompletionRequest {
  content: string;
  options?: ChatRequestOptions;
}

export interface ChatCompletionResponse {
  content: string;
  raw?: StreamChatChunk[];
}

export type ChatResponse = ChatCompletionResponse;

export interface StreamChatChunk {
  content?: string;
  type?: string;
  error?: string;
}

export type ChatChunk = StreamChatChunk;

export interface HealthResponse {
  status: string;
  extra?: Record<string, unknown> | null;
}
