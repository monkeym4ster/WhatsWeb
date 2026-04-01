import { z } from "zod";

export function normalizeUrl(url: string): string {
  if (!url) throw new Error(`Invalid url: ${url}`);
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

export const urlSchema = z
  .string()
  .min(1, "URL cannot be empty")
  .transform((val) => normalizeUrl(val));
