import type { Plugin } from "../types.ts";
import { BBScanner } from "./scanner.ts";

export const bbscanPlugin: Plugin = {
  meta: { name: "BBScan", description: "Path scanning based on rule files" },
  async execute(ctx) {
    const scanner = new BBScanner({
      url: ctx.url,
      userAgent: ctx.userAgent,
      timeout: ctx.timeout,
    });
    const paths = await scanner.run();
    if (!paths || paths.length === 0) return null;
    return { paths };
  },
};
