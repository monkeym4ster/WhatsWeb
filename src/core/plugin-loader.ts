import { pluginMetaSchema } from "../plugins/types.ts";
import type { Plugin } from "../plugins/types.ts";
import { baseInfoPlugin } from "../plugins/base-info.ts";
import { emailPlugin } from "../plugins/email.ts";
import { geoipPlugin } from "../plugins/geoip.ts";

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin): void {
    const parsed = pluginMetaSchema.safeParse(plugin.meta);
    if (!parsed.success) {
      throw new Error(`Invalid plugin meta: ${parsed.error.message}`);
    }
    if (this.plugins.has(plugin.meta.name)) {
      throw new Error(`Plugin "${plugin.meta.name}" is already registered`);
    }
    this.plugins.set(plugin.meta.name, plugin);
  }

  getAll(): Plugin[] {
    return [...this.plugins.values()];
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  get pluginCount(): number {
    return this.plugins.size;
  }

  static withBuiltins(): PluginLoader {
    const loader = new PluginLoader();
    loader.register(baseInfoPlugin);
    loader.register(emailPlugin);
    loader.register(geoipPlugin);
    return loader;
  }
}
