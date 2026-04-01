#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { Presets, SingleBar } from "cli-progress";
import { Command } from "commander";
import { uniq } from "es-toolkit";
import pLimit from "p-limit";
import pc from "picocolors";

import { Reporter } from "./core/reporter.ts";
import { Scanner } from "./core/scanner.ts";
import type { ScanResult } from "./core/scanner.ts";
import { cliOptionsSchema } from "./schemas/cli.ts";
import { resolve4 } from "./utils/dns.ts";
import { expandCIDR } from "./utils/ip.ts";
import { normalizeUrl } from "./utils/url.ts";

const pack = await import("../package.json");

const program = new Command()
  .name(pack.name)
  .version(pack.version)
  .usage("[options] URLs")
  .description("Identifies websites.")
  .argument("[urls...]", "Target URLs")
  .option("-f <file>", "Targets file path")
  .option("-c, --concurrency <num>", "Concurrency limit", (v: string) => Math.abs(Number.parseInt(v)), 50)
  .option("--network <mask>", "Scan all Target/MASK hosts")
  .option("--timeout <ms>", "Request timeout in ms", (v: string) => Math.abs(Number.parseInt(v)), 10000)
  .option("--user-agent <string>", "Custom User-Agent", `Mozilla/5.0 ${pack.name}/${pack.version}`)
  .option("-o, --output <path>", "Output file path")
  .option("--show-error", "Show error message", false)
  .action(async (urls: string[], rawOpts) => {
    const opts = cliOptionsSchema.parse({
      concurrency: rawOpts.concurrency,
      timeout: rawOpts.timeout,
      userAgent: rawOpts.userAgent,
      output: rawOpts.output,
      showError: rawOpts.showError,
      network: rawOpts.network,
      file: rawOpts.F,
    });

    let targets = [...urls];

    if (process.argv.length < 3) {
      program.outputHelp();
      process.exit(0);
    }

    if (!targets.length && !opts.file) {
      console.error(pc.red("[-] Error. Target is required."));
      process.exit(1);
    }

    if (opts.file) {
      const fileData = readFileSync(opts.file, "utf8").trim();
      if (!fileData.length) {
        console.error(pc.red("[-] Error. File is empty."));
        process.exit(1);
      }
      targets = targets.concat(
        fileData
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      );
    }

    if (opts.network) {
      const expanded: string[] = [];
      for (const target of targets) {
        try {
          const url = normalizeUrl(target);
          const { host } = new URL(url);
          if (!host) continue;
          const ip = await resolve4(host);
          for (const addr of expandCIDR(`${ip}/${opts.network}`)) {
            expanded.push(addr);
          }
        } catch {
          /* ignore expansion errors */
        }
      }
      targets = targets.concat(expanded);
    }

    targets = uniq(targets);

    console.log(
      pc.dim(
        `[*] Options: ${JSON.stringify({
          outputFile: opts.output,
          concurrency: opts.concurrency,
          network: opts.network,
          timeout: opts.timeout,
          userAgent: opts.userAgent,
          targetCount: targets.length,
          showError: opts.showError,
        })}`,
      ),
    );

    const reporter = new Reporter({ showError: opts.showError, outputFile: opts.output });
    let valid = 0;

    const bar = new SingleBar(
      { format: "{valid} Hits({rate} Targets/s) | {value}/{total}({percentage}%) scanned in {duration}s, ETA: {eta}s" },
      Presets.shades_classic,
    );
    bar.start(targets.length, 0, { valid: 0, rate: "N/A" });

    const limit = pLimit(opts.concurrency);
    const startTime = Date.now();

    const tasks = targets.map((target) =>
      limit(async () => {
        const scanner = new Scanner({
          target,
          timeout: opts.timeout,
          userAgent: opts.userAgent,
        });

        const data = await scanner.analyse();

        const printAboveBar = (msg: string) => {
          process.stdout.write(`\x1b[2K\x1b[0G${msg}\n`);
        };

        if (Array.isArray(data)) {
          valid++;
          reporter.appendJsonLine(normalizeUrl(target), data);
          const output = reporter.formatResult(normalizeUrl(target), data);
          if (output.includes("[+]")) {
            printAboveBar(output);
          }
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = elapsed > 0 ? (valid / elapsed).toFixed(1) : "N/A";
          bar.increment(1, { valid, rate });
        } else {
          bar.increment(1, { valid });
          if (opts.showError && data instanceof Error) {
            printAboveBar(reporter.formatError(normalizeUrl(target), data));
          }
        }
      }),
    );

    await Promise.all(tasks);
    bar.stop();
    process.exit(0);
  });

program.parse();
