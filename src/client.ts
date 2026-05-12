import type { IncheckClientOptions } from "./models/types.js";
import { resolveClientConfig } from "./config.js";
import { ChatResource, DocumentsResource } from "./resources/index.js";
import { HttpTransport } from "./transport/http.js";

export class IncheckClient {
  readonly chat: ChatResource;
  readonly documents: DocumentsResource;

  constructor(options: IncheckClientOptions = {}) {
    const resolvedConfig = resolveClientConfig(options);
    const transport = new HttpTransport(options, resolvedConfig);
    this.chat = new ChatResource(transport);
    this.documents = new DocumentsResource(transport);
  }
}

export const Client = IncheckClient;
export const AsyncClient = IncheckClient;
