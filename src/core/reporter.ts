import { appendFileSync } from "node:fs";
import { EOL } from "node:os";
import pc from "picocolors";
import type { ScanResult } from "./scanner.ts";

export interface ReporterOptions {
  showError: boolean;
  outputFile?: string;
}

export class Reporter {
  constructor(private opts: ReporterOptions) {}

  formatResult(url: string, results: ScanResult[]): string {
    const lines: string[] = [];
    lines.push(`[+] WhatsWeb report for ${pc.bold(pc.blue(url))}`);

    for (const item of results) {
      const nameStr = `[ ${pc.bold(pc.cyan(item.name))} ]`;
      const parts: string[] = [];

      for (const [key, value] of Object.entries(item.result)) {
        const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
        let valueStr: string;

        if (key === "redirect") {
          valueStr = pc.bold(pc.yellow(displayValue));
        } else if (key === "title") {
          valueStr = pc.bold(pc.yellow(displayValue));
        } else {
          valueStr = displayValue;
        }

        parts.push(`${pc.bold(pc.white(key))}: ${valueStr}`);
      }

      lines.push(`${nameStr} ${parts.join(", ")}`);
    }

    return lines.join("\n");
  }

  formatError(url: string, error: Error): string {
    if (!this.opts.showError) return "";
    return pc.gray(`[-] Request ${url} failed. ${error.message}`);
  }

  appendJsonLine(url: string, results: ScanResult[]): void {
    if (!this.opts.outputFile) return;
    const data = JSON.stringify({ target: url, plugins: results });
    appendFileSync(this.opts.outputFile, data + EOL);
  }
}
