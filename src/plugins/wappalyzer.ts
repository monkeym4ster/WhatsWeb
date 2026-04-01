import type { Plugin } from "./types.ts";

export const wappalyzerPlugin: Plugin = {
  meta: { name: "Wappalyzer", description: "Technology fingerprinting (wappalyzer@6.10.66)" },

  async execute(ctx) {
    let wappalyzer: any = null;
    try {
      const Wappalyzer = (await import("wappalyzer")).default;

      const options = {
        debug: false,
        delay: 500,
        maxDepth: 3,
        maxUrls: 10,
        maxWait: Math.min(ctx.timeout, 5000),
        recursive: true,
        probe: true,
        userAgent: ctx.userAgent,
        noRedirect: false,
      };

      wappalyzer = new Wappalyzer(options);
      await wappalyzer.init();

      const site = await wappalyzer.open(ctx.url);
      site.on("error", () => {});

      const json = await site.analyze();
      const result: Record<string, unknown> = {};

      for (const tech of json.technologies ?? []) {
        let item = tech.name;
        if (tech.version) item += `[${tech.version}]`;

        for (const category of tech.categories ?? []) {
          const catName = category.name;
          if (!result[catName]) {
            result[catName] = [item];
          } else {
            (result[catName] as string[]).push(item);
          }
        }
      }

      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    } finally {
      try {
        await wappalyzer?.destroy();
      } catch {
        /* ignore cleanup errors */
      }
    }
  },
};
