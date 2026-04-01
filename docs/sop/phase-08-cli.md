# Phase 8：CLI 与 Reporter

> **前置条件**：Phase 7 已完成（Scanner 可用）
> **产出物**：`src/cli.ts`（CLI 入口）+ `src/core/reporter.ts`（结果格式化）+ `src/schemas/cli.ts`（CLI 参数 Zod schema）+ 测试
> **TDD 顺序**：Zod schema → Reporter 测试/实现 → CLI 测试/实现

---

## 模块概览

| 文件 | 职责 | 对应原始代码 |
|------|------|-------------|
| `src/schemas/cli.ts` | CLI 参数 Zod schema + 类型 | `whatsweb.js` 中 commander 选项 |
| `src/core/reporter.ts` | 控制台彩色输出 + JSON 文件输出 | `whatsweb.js` 中 `report()` 函数 |
| `src/cli.ts` | CLI 入口，commander 参数解析 + 主流程 | `whatsweb.js` 整体 |

---

## Step 8.1 — CLI 参数 Zod Schema (`src/schemas/cli.ts`)

### 8.1.1 先写测试 `tests/schemas/cli.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { cliOptionsSchema } from "../../src/schemas/cli.ts";

describe("cliOptionsSchema", () => {
  test("默认值填充", () => {
    const result = cliOptionsSchema.parse({});
    expect(result.concurrency).toBe(50);
    expect(result.timeout).toBe(10000);
    expect(result.showError).toBe(false);
    expect(result.userAgent).toContain("whatsweb");
  });

  test("自定义值通过验证", () => {
    const result = cliOptionsSchema.parse({
      concurrency: 10,
      timeout: 5000,
      userAgent: "custom",
      output: "/tmp/out.json",
      showError: true,
      network: "24",
    });
    expect(result.concurrency).toBe(10);
    expect(result.output).toBe("/tmp/out.json");
    expect(result.network).toBe("24");
  });

  test("并发数必须为正整数", () => {
    const result = cliOptionsSchema.safeParse({ concurrency: -1 });
    expect(result.success).toBe(false);
  });

  test("超时必须为正数", () => {
    const result = cliOptionsSchema.safeParse({ timeout: 0 });
    expect(result.success).toBe(false);
  });
});
```

### 8.1.2 实现 `src/schemas/cli.ts`

```typescript
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
```

---

## Step 8.2 — Reporter TDD (`src/core/reporter.ts`)

### 8.2.1 先写测试 `tests/core/reporter.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { Reporter } from "../../src/core/reporter.ts";
import type { ScanResult } from "../../src/core/scanner.ts";
import { existsSync, unlinkSync } from "node:fs";

describe("Reporter", () => {
  test("formatResult 生成彩色字符串", () => {
    const reporter = new Reporter({ showError: false });
    const results: ScanResult[] = [
      { name: "Base Information", result: { status: "200 OK", title: "Test Page" } },
      { name: "Email", result: { email: ["a@b.com", "c@d.com"] } },
    ];
    const output = reporter.formatResult("http://example.com", results);
    expect(output).toContain("http://example.com");
    expect(output).toContain("Base Information");
    expect(output).toContain("200 OK");
  });

  test("formatError 包含 URL 和错误信息", () => {
    const reporter = new Reporter({ showError: true });
    const output = reporter.formatError("http://example.com", new Error("timeout"));
    expect(output).toContain("http://example.com");
    expect(output).toContain("timeout");
  });

  test("formatError 在 showError=false 时返回空", () => {
    const reporter = new Reporter({ showError: false });
    const output = reporter.formatError("http://example.com", new Error("timeout"));
    expect(output).toBe("");
  });

  test("appendJsonLine 写入文件", async () => {
    const tmpFile = `/tmp/whatsweb-test-${Date.now()}.jsonl`;
    const reporter = new Reporter({ showError: false, outputFile: tmpFile });

    await reporter.appendJsonLine("http://example.com", [
      { name: "test", result: { key: "value" } },
    ]);

    expect(existsSync(tmpFile)).toBe(true);
    const content = await Bun.file(tmpFile).text();
    const parsed = JSON.parse(content.trim());
    expect(parsed.target).toBe("http://example.com");
    expect(parsed.plugins[0].name).toBe("test");

    unlinkSync(tmpFile);
  });

  test("数组值以逗号连接显示", () => {
    const reporter = new Reporter({ showError: false });
    const results: ScanResult[] = [
      { name: "Email", result: { email: ["a@b.com", "c@d.com"] } },
    ];
    const output = reporter.formatResult("http://example.com", results);
    expect(output).toContain("a@b.com, c@d.com");
  });
});
```

### 8.2.2 实现 `src/core/reporter.ts`

**功能需求**（参考原 `whatsweb.js` 第 77-124 行的 `report()` 函数）：

```typescript
import pc from "picocolors";
import type { ScanResult } from "./scanner.ts";

export interface ReporterOptions {
  showError: boolean;
  outputFile?: string;
}

export class Reporter {
  constructor(private opts: ReporterOptions) {}

  /** 格式化成功结果为彩色控制台字符串 */
  formatResult(url: string, results: ScanResult[]): string {
    // 参考原代码的格式：
    // [+] WhatsWeb report for <url>
    // [ Plugin Name ] key1: value1, key2: value2
    // ...
    //
    // 使用 picocolors 着色：
    // - URL: pc.bold(pc.blue(url))
    // - 插件名: pc.bold(pc.cyan(name))
    // - key: pc.bold(pc.white(key))
    // - title 和 redirect 值: pc.bold(pc.yellow(value))
    // - 数组值: 用 ", " 连接
  }

  /** 格式化错误信息 */
  formatError(url: string, error: Error): string {
    // showError=false 时返回空字符串
    // showError=true 时返回 "[-] Request <url> failed. <message>"
  }

  /** 追加 JSON 行到输出文件 */
  async appendJsonLine(url: string, results: ScanResult[]): Promise<void> {
    // 使用 Bun.write (append mode) 写入 JSONL 格式
    // 格式: { target: url, plugins: results }\n
  }
}
```

**es-toolkit 用法**：
```typescript
import { isEmpty } from "es-toolkit/predicate";
// 检查结果是否为空
if (isEmpty(result)) return;
```

---

## Step 8.3 — CLI 入口 (`src/cli.ts`)

### 8.3.1 先写测试 `tests/cli.test.ts`

```typescript
import { describe, test, expect } from "bun:test";

describe("CLI", () => {
  test("无参数时显示帮助信息", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const output = stdout + stderr;
    expect(output).toContain("Usage");
    expect(proc.exitCode).not.toBe(undefined);
  });

  test("--version 输出版本号", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "--version"], {
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("--help 输出帮助信息", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "--help"], {
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output).toContain("-f");
    expect(output).toContain("--concurrency");
    expect(output).toContain("--network");
    expect(output).toContain("--timeout");
    expect(output).toContain("--user-agent");
    expect(output).toContain("--output");
    expect(output).toContain("--show-error");
  });
});
```

### 8.3.2 实现 `src/cli.ts`

```typescript
#!/usr/bin/env bun

import { Command } from "commander";
import pc from "picocolors";
import { SingleBar, Presets } from "cli-progress";
import pLimit from "p-limit";
import { uniq } from "es-toolkit";

import { Scanner } from "./core/scanner.ts";
import { Reporter } from "./core/reporter.ts";
import { normalizeUrl } from "./utils/url.ts";
import { resolve4 } from "./utils/dns.ts";
import { expandCIDR } from "./utils/ip.ts";
import { cliOptionsSchema } from "./schemas/cli.ts";
import { version, name } from "../package.json";

const program = new Command()
  .name(name)
  .version(version)
  .usage("[options] URLs")
  .description("Identifies websites.")
  .argument("[urls...]", "目标 URL 列表")
  .option("-f <file>", "Targets file path")
  .option("-c, --concurrency <num>", "并发数", (v) => Math.abs(parseInt(v)), 50)
  .option("--network <mask>", "Scan all Target/MASK hosts")
  .option("--timeout <ms>", "请求超时 (毫秒)", (v) => Math.abs(parseInt(v)), 10000)
  .option("--user-agent <string>", "Custom User-Agent", `Mozilla/5.0 ${name}/${version}`)
  .option("-o, --output <path>", "Output file path")
  .option("--show-error", "Show error message", false)
  .action(async (urls: string[], opts) => {
    // 主流程参考原 whatsweb.js:
    // 1. 使用 cliOptionsSchema.parse(opts) 验证参数
    // 2. 构建目标列表（参数 URLs + 文件 + CIDR 展开）
    // 3. 使用 es-toolkit 的 uniq() 去重
    // 4. 创建进度条 (cli-progress)
    // 5. 使用 p-limit 控制并发
    // 6. 对每个目标创建 Scanner 并 analyse()
    // 7. 使用 Reporter 格式化输出
  });

program.parse();
```

**关键实现要点**：

1. **Zod 验证 CLI 参数**：`cliOptionsSchema.parse(opts)` 确保运行时参数合法
2. **es-toolkit `uniq()`**：替代 `Array.from(new Set(targets))`
3. **p-limit 并发控制**：替代 `bluebird.Promise.map({ concurrency })`
4. **picocolors**：替代 `chalk` 进行终端着色
5. **cli-progress**：替代 `progress` 库
6. **Bun.file().text()**：替代 `fs.readFileSync()` 读取目标文件
7. **Bun.write()**：替代 `fs.appendFileSync()` 写入输出文件

**进度条格式保持兼容**：
```
:valid Hits(:rate Targets/s) | :current/:total(:percent) scanned in :elapseds, :etas left
```

---

## Step 8.4 — 验证

```bash
bun test tests/schemas/cli.test.ts
bun test tests/core/reporter.test.ts
bun test tests/cli.test.ts
bun test  # 全部测试
bunx eslint src/ tests/
bunx prettier --check src/ tests/
```

---

## 提交

```bash
git add .
git commit -m "feat: Phase 8 — CLI + Reporter (commander/picocolors/cli-progress/p-limit/zod)"
git push
```

---

## 完成标志

- [ ] `tests/schemas/cli.test.ts` 全部通过
- [ ] `tests/core/reporter.test.ts` 全部通过
- [ ] `tests/cli.test.ts` 全部通过
- [ ] CLI 所有原有选项（`-f`, `-c`, `--network`, `--timeout`, `--user-agent`, `-o`, `--show-error`）兼容
- [ ] 输出格式与原版一致（彩色控制台 + JSONL 文件）
- [ ] CLI 参数使用 Zod 运行时验证
- [ ] 去重使用 `es-toolkit/uniq`
- [ ] 并发控制使用 `p-limit`
- [ ] lint 无错误
- [ ] 代码已提交并推送
- [ ] `docs/sop/README.md` 中 Phase 8 状态已更新为 ✅
