import type { Plugin } from "./types.ts";

export const baseInfoPlugin: Plugin = {
  meta: { name: "Base Information" },
  async execute(ctx) {
    const { response, url } = ctx;
    const result: Record<string, unknown> = {};

    result.status = `${response.status} ${response.statusText}`;

    if (response.url !== url) {
      result.redirect = response.url;
    }

    const matched = response.text.match(/<title>([^<]+)<\/title>/i);
    if (matched?.[1]) {
      result.title = matched[1].trim().replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    }

    for (const [key, value] of Object.entries(response.headers)) {
      if (key.startsWith("x-")) {
        result[key] = value;
      }
    }

    return result;
  },
};
