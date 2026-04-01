export type { HttpResponse } from "../utils/http.ts";
import type { HttpResponse } from "../utils/http.ts";

export interface PluginContext {
  url: string;
  timeout: number;
  userAgent: string;
  response: HttpResponse;
}

export interface PluginMeta {
  name: string;
  description?: string;
}

export interface Plugin {
  meta: PluginMeta;
  execute(context: PluginContext): Promise<Record<string, unknown> | null>;
}
