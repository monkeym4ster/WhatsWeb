import { uniq } from "es-toolkit";
import type { Plugin } from "./types.ts";

export const emailPlugin: Plugin = {
  meta: { name: "Email" },
  async execute(ctx) {
    const matched = ctx.response.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}/gi);
    if (!matched) return null;

    const emails = uniq(matched);
    if (emails.length < 2) return null;

    return { email: emails };
  },
};
