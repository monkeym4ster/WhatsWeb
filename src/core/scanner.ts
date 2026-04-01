import { z } from "zod";
import type { PluginContext } from "../plugins/types.ts";
import { httpGet } from "../utils/http.ts";
import { normalizeUrl } from "../utils/url.ts";
import { PluginLoader } from "./plugin-loader.ts";

export const scannerOptionsSchema = z.object({
  target: z
    .string()
    .min(1)
    .transform((val) => normalizeUrl(val)),
  timeout: z.number().positive().default(10000),
  userAgent: z.string().min(1).default("Mozilla/5.0 whatsweb/1.0.0"),
});

export type ScannerOptions = z.infer<typeof scannerOptionsSchema>;

export interface ScanResult {
  name: string;
  result: Record<string, unknown>;
}

export interface ScannerInit {
  target: string;
  timeout?: number;
  userAgent?: string;
  pluginLoader?: PluginLoader;
}

export class Scanner {
  private url: string;
  private timeout: number;
  private userAgent: string;
  private pluginLoader: PluginLoader;

  constructor(init: ScannerInit) {
    const opts = scannerOptionsSchema.parse({
      target: init.target,
      timeout: init.timeout,
      userAgent: init.userAgent,
    });

    this.url = opts.target;
    this.timeout = opts.timeout;
    this.userAgent = opts.userAgent;
    this.pluginLoader = init.pluginLoader ?? PluginLoader.withBuiltins();
  }

  async analyse(): Promise<ScanResult[] | Error> {
    try {
      const response = await httpGet(this.url, {
        timeout: this.timeout,
        userAgent: this.userAgent,
      });

      if (response.status < 200 || response.status > 599) {
        return new Error(`Status code ${response.status} not in range`);
      }

      const context: PluginContext = {
        url: this.url,
        timeout: this.timeout,
        userAgent: this.userAgent,
        response,
      };

      const results: ScanResult[] = [];
      for (const plugin of this.pluginLoader.getAll()) {
        try {
          const result = await plugin.execute(context);
          if (result && Object.keys(result).length > 0) {
            results.push({ name: plugin.meta.name, result });
          }
        } catch {
          // single plugin failure doesn't affect others
        }
      }

      return results;
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  }
}
