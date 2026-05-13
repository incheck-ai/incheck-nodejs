import type { RequestOptions, StatesAndScopesResponse } from "../models/types.js";
import { HttpTransport } from "../transport/http.js";

export class MetadataResource {
  constructor(private readonly http: HttpTransport) {}

  async statesAndScopes(options?: RequestOptions): Promise<StatesAndScopesResponse> {
    return this.http.request<StatesAndScopesResponse>({
      method: "GET",
      path: "/states-and-scopes",
      options
    });
  }
}
