# Phase 7：核心扫描引擎

> **前置条件**：Phase 6 已完成（所有插件就绪）
> **产出物**：`src/core/scanner.ts` + 测试
> **TDD 顺序**：测试 → 实现 → 验证

---

## 功能概述

`Scanner` 是项目的核心调度器（对应原 `index.js` 的 `WhatsWeb` 类），负责：

1. 接收目标 URL 和选项
2. 对目标发起一次初始 HTTP GET 请求
3. 按顺序执行所有已注册插件
4. 聚合并返回结果

---

## Step 7.1 — Zod Schema 定义

```typescript
import { z } from "zod";
import { urlSchema } from "../utils/url.ts";

export const scannerOptionsSchema = z.object({
  target: urlSchema,
  timeout: z.number().positive().default(10000),
  userAgent: z.string().min(1).default("Mozilla/5.0 whatsweb/1.0.0"),
});

export type ScannerOptions = z.infer<typeof scannerOptionsSchema>;

export const scanResultSchema = z.object({
  name: z.string(),
  result: z.record(z.string(), z.unknown()),
});

export type ScanResult = z.infer<typeof scanResultSchema>;
```

---

## Step 7.2 — 先写测试 `tests/core/scanner.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Scanner } from "../../src/core/scanner.ts";
import { PluginLoader } from "../../src/core/plugin-loader.ts";
import type { Plugin, PluginContext } from "../../src/plugins/types.ts";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/") {
        return new Response(
          "<html><title>Test Site</title><body>admin@test.com info@test.com</body></html>",
          { headers: { "content-type": "text/html", "x-powered-by": "TestServer" } },
        );
      }
      if (url.pathname === "/WhatsWeb-404-existence-check") {
        return new Response("Not Found", { status: 404 });
      }
      return new Response("Not Found", { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

// Mock 插件用于测试
const successPlugin: Plugin = {
  meta: { name: "success-plugin" },
  execute: async (ctx: PluginContext) => ({ found: true, url: ctx.url }),
};

const emptyPlugin: Plugin = {
  meta: { name: "empty-plugin" },
  execute: async () => null,
};

const errorPlugin: Plugin = {
  meta: { name: "error-plugin" },
  execute: async () => { throw new Error("plugin crashed"); },
};

describe("Scanner", () => {
  test("使用 mock 插件扫描", async () => {
    const loader = new PluginLoader();
    loader.register(successPlugin);
    loader.register(emptyPlugin);

    const scanner = new Scanner({
      target: baseUrl,
      timeout: 5000,
      userAgent: "test",
      pluginLoader: loader,
    });

    const results = await scanner.analyse();
    expect(Array.isArray(results)).toBe(true);

    // success-plugin 有结果
    const successResult = results.find((r) => r.name === "success-plugin");
    expect(successResult).toBeDefined();
    expect(successResult?.result.found).toBe(true);

    // empty-plugin 被跳过（返回 null）
    const emptyResult = results.find((r) => r.name === "empty-plugin");
    expect(emptyResult).toBeUndefined();
  });

  test("单个插件失败不影响其他插件", async () => {
    const loader = new PluginLoader();
    loader.register(successPlugin);
    loader.register(errorPlugin);

    const scanner = new Scanner({
      target: baseUrl,
      timeout: 5000,
      userAgent: "test",
      pluginLoader: loader,
    });

    const results = await scanner.analyse();
    // success-plugin 应仍有结果
    expect(results.find((r) => r.name === "success-plugin")).toBeDefined();
    // error-plugin 应被跳过
    expect(results.find((r) => r.name === "error-plugin")).toBeUndefined();
  });

  test("target 不可达时返回错误", async () => {
    const loader = new PluginLoader();
    loader.register(successPlugin);

    const scanner = new Scanner({
      target: "http://localhost:1",
      timeout: 2000,
      userAgent: "test",
      pluginLoader: loader,
    });

    const result = await scanner.analyse();
    // 应返回 Error 对象或空数组
    expect(result instanceof Error || (Array.isArray(result) && result.length === 0)).toBe(true);
  });

  test("使用 Zod 验证选项", () => {
    // 空 target 应被 Zod 拒绝
    expect(() => {
      new Scanner({ target: "", timeout: 5000, userAgent: "test" });
    }).toThrow();
  });

  test("使用内置插件扫描本地服务器", async () => {
    const scanner = new Scanner({
      target: baseUrl,
      timeout: 10000,
      userAgent: "test",
    });

    const results = await scanner.analyse();
    expect(Array.isArray(results)).toBe(true);

    // 至少应有 Base Information 结果
    const baseInfo = results.find((r) => r.name === "Base Information");
    expect(baseInfo).toBeDefined();
    expect(baseInfo?.result.status).toContain("200");
  }, 30000);
});
```

---

## Step 7.3 — 实现 `src/core/scanner.ts`

```typescript
import { httpGet } from "../utils/http.ts";
import { PluginLoader } from "./plugin-loader.ts";
import { scannerOptionsSchema } from "./scanner-schema.ts";
import type { ScanResult } from "./scanner-schema.ts";
import type { PluginContext } from "../plugins/types.ts";

export interface ScannerInit {
  target: string;
  timeout?: number;
  userAgent?: string;
  pluginLoader?: PluginLoader;
}

export class Scanner {
  private url: string;
  private timeout: number;
  private userAgent: string;
  private pluginLoader: PluginLoader;

  constructor(init: ScannerInit) {
    // 使用 Zod 验证并填充默认值
    const opts = scannerOptionsSchema.parse({
      target: init.target,
      timeout: init.timeout,
      userAgent: init.userAgent,
    });

    this.url = opts.target;
    this.timeout = opts.timeout;
    this.userAgent = opts.userAgent;
    this.pluginLoader = init.pluginLoader ?? PluginLoader.withBuiltins();
  }

  async analyse(): Promise<ScanResult[] | Error> {
    try {
      // 1. 初始 GET 请求
      const response = await httpGet(this.url, {
        timeout: this.timeout,
        userAgent: this.userAgent,
      });

      if (response.status < 200 || response.status > 599) {
        return new Error(`Status code ${response.status} not in range`);
      }

      // 2. 构建插件上下文
      const context: PluginContext = {
        url: this.url,
        timeout: this.timeout,
        userAgent: this.userAgent,
        response,
      };

      // 3. 按顺序执行所有插件，单个失败不影响其他
      const results: ScanResult[] = [];
      for (const plugin of this.pluginLoader.getAll()) {
        try {
          const result = await plugin.execute(context);
          if (result && Object.keys(result).length > 0) {
            results.push({ name: plugin.meta.name, result });
          }
        } catch {
          // 单个插件失败，静默跳过
        }
      }

      return results;
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  }
}
```

**关键要点**：
1. **Zod 验证**：构造函数中使用 `scannerOptionsSchema.parse()` 验证参数，非法参数直接抛 ZodError
2. **默认 PluginLoader**：未传入 `pluginLoader` 时使用 `PluginLoader.withBuiltins()` 加载所有内置插件
3. **错误隔离**：每个插件执行包在 try/catch 中，单个插件 crash 不会影响其他插件
4. **返回类型**：`ScanResult[] | Error`，与原代码行为一致（成功返回数组，失败返回 Error）

---

## Step 7.4 — 更新库入口 (`src/index.ts`)

```typescript
export { Scanner } from "./core/scanner.ts";
export { PluginLoader } from "./core/plugin-loader.ts";
export type { Plugin, PluginContext, PluginMeta, HttpResponse } from "./plugins/types.ts";
export type { ScanResult, ScannerOptions } from "./core/scanner-schema.ts";
```

---

## 验证

```bash
bun test tests/core/scanner.test.ts
bun test  # 确保所有测试仍通过
bunx eslint src/core/
```

---

## 提交

```bash
git add .
git commit -m "feat: Phase 7 — 核心扫描引擎 Scanner (Zod 验证)"
git push
```

---

## 完成标志

- [ ] `tests/core/scanner.test.ts` 全部通过
- [ ] `Scanner` 构造函数使用 Zod 验证参数
- [ ] 支持自定义 `PluginLoader` 和默认内置插件
- [ ] 单个插件失败不影响其他插件
- [ ] `src/index.ts` 正确导出 Scanner 和相关类型
- [ ] lint 无错误
- [ ] 代码已提交并推送
- [ ] `docs/sop/README.md` 中 Phase 7 状态已更新为 ✅
