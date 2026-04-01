import { z } from "zod";

export const cliOptionsSchema = z.object({
  concurrency: z.number().int().positive().default(50),
  timeout: z.number().positive().default(10000),
  userAgent: z.string().min(1).default("Mozilla/5.0 whatsweb/1.0.0"),
  output: z.string().optional(),
  showError: z.boolean().default(false),
  network: z.string().optional(),
  file: z.string().optional(),
});

export type CliOptions = z.infer<typeof cliOptionsSchema>;
