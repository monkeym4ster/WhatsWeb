export interface RequestOptions {
  timeout: number;
  userAgent: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
  url: string;
}

export async function httpGet(_url: string, _options: RequestOptions): Promise<HttpResponse> {
  throw new Error("Not implemented yet — Phase 2");
}

export async function httpHead(_url: string, _options: RequestOptions): Promise<HttpResponse> {
  throw new Error("Not implemented yet — Phase 2");
}
