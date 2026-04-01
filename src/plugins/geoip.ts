import geoip from "geoip-lite";
import { resolve4 } from "../utils/dns.ts";
import type { Plugin } from "./types.ts";

export const geoipPlugin: Plugin = {
  meta: { name: "Geolocation" },
  async execute(ctx) {
    try {
      const { host } = new URL(ctx.url);
      if (!host) return null;

      const ip = await resolve4(host);
      const result: Record<string, unknown> = { ip };

      const geo = geoip.lookup(ip);
      if (geo) {
        const { country, city } = geo;
        result.country = [city, country].filter(Boolean).join("/");
      }

      return result;
    } catch {
      return null;
    }
  },
};
