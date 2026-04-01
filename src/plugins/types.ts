import { z } from "zod";
import type { HttpResponse } from "../utils/http.ts";

export type { HttpResponse } from "../utils/http.ts";

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

export const pluginMetaSchema = z.object({
  name: z.string().min(1, "Plugin name cannot be empty"),
  description: z.string().optional(),
});

export const pluginResultSchema = z.record(z.string(), z.unknown()).nullable();
