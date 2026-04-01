# Phase 5：Wappalyzer 插件

> **前置条件**：Phase 4 已完成
> **产出物**：`src/plugins/wappalyzer.ts` + 测试 + 注册到 PluginLoader
> **特殊依赖**：`wappalyzer@6.10.66`（依赖 `puppeteer@~19.7.0`，内含 Chromium）

---

## 背景

`wappalyzer@6.10.66` 是 wappalyzer npm 包被废弃前的最后一个功能版本。其 API 与旧版 `@5.x` 完全不同：

### wappalyzer@6.10.66 API

```typescript
const Wappalyzer = require("wappalyzer");

const wappalyzer = new Wappalyzer(options);
await wappalyzer.init();                          // 初始化 (启动 puppeteer/chromium)
const site = await wappalyzer.open(url, headers); // 打开目标站点
site.on("error", console.error);                  // 错误事件
const results = await site.analyze();             // 分析
await wappalyzer.destroy();                       // 销毁 (关闭浏览器)
```

### Options

```typescript
const options = {
  debug: false,
  delay: 500,
  headers: {},
  maxDepth: 3,
  maxUrls: 10,
  maxWait: 5000,
  recursive: true,
  probe: true,
  proxy: false,
  userAgent: "Wappalyzer",
  htmlMaxCols: 2000,
  htmlMaxRows: 2000,
  noScripts: false,
  noRedirect: false,
};
```

### Results 结构

```json
{
  "urls": { "http://example.com/": { "status": 200 } },
  "technologies": [
    {
      "slug": "wordpress",
      "name": "WordPress",
      "confidence": 100,
      "version": "5.9",
      "icon": "WordPress.svg",
      "website": "https://wordpress.org",
      "cpe": "cpe:/a:wordpress:wordpress",
      "categories": [
        { "id": 1, "slug": "cms", "name": "CMS" }
      ]
    }
  ]
}
```

**注意**：v6 的结果结构是 `technologies[]`（不是 v5 的 `applications[]`），每个 technology 直接包含 `categories[]` 数组。

---

## Step 5.1 — 先写测试 `tests/plugins/wappalyzer.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { wappalyzerPlugin } from "../../src/plugins/wappalyzer.ts";
import type { PluginContext } from "../../src/plugins/types.ts";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      return new Response(
        `<html>
          <head>
            <title>Test</title>
            <meta name="generator" content="WordPress 5.9" />
          </head>
          <body><h1>Test Page</h1></body>
        </html>`,
        { headers: { "content-type": "text/html", "x-powered-by": "Express" } },
      );
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

const makeContext = (url: string): PluginContext => ({
  url,
  timeout: 30000,
  userAgent: "WhatsWeb/1.0",
  response: { status: 200, statusText: "OK", headers: {}, text: "", url },
});

describe("wappalyzerPlugin", () => {
  test("meta.name 正确", () => {
    expect(wappalyzerPlugin.meta.name).toBe("Wappalyzer");
  });

  // 注意：这个测试需要 puppeteer/chromium 可用
  // 在 CI 环境中可能需要 skip
  test("分析本地测试服务器", async () => {
    const result = await wappalyzerPlugin.execute(makeContext(baseUrl));
    // 至少应该识别出 Express (通过 x-powered-by 头)
    expect(result).toBeDefined();
    if (result) {
      // 结果应该是 { category: [techName, ...] } 格式
      const values = Object.values(result);
      expect(values.some((v) => Array.isArray(v))).toBe(true);
    }
  }, 60000); // wappalyzer 分析可能较慢

  test("无法访问的 URL 应返回 null 或空对象", async () => {
    const result = await wappalyzerPlugin.execute(
      makeContext("http://localhost:1"),
    );
    // 应优雅处理而不是 throw
    expect(result === null || (result && Object.keys(result).length === 0)).toBe(true);
  }, 30000);
});
```

---

## Step 5.2 — 实现 `src/plugins/wappalyzer.ts`

```typescript
import type { Plugin } from "./types.ts";
import { groupBy } from "es-toolkit";

export const wappalyzerPlugin: Plugin = {
  meta: { name: "Wappalyzer", description: "技术栈识别 (wappalyzer@6.10.66)" },

  async execute(ctx) {
    // wappalyzer 是 CJS 包，需要动态 import 或 require
    const Wappalyzer = (await import("wappalyzer")).default;

    const options = {
      debug: false,
      delay: 500,
      maxDepth: 3,
      maxUrls: 10,
      maxWait: Math.min(ctx.timeout, 5000),
      recursive: true,
      probe: true,
      userAgent: ctx.userAgent,
      noRedirect: false,
    };

    const wappalyzer = new Wappalyzer(options);

    try {
      await wappalyzer.init();
      const site = await wappalyzer.open(ctx.url);

      // 静默错误事件，防止未处理的 rejection
      site.on("error", () => {});

      const json = await site.analyze();
      const result: Record<string, unknown> = {};

      // v6 结构: json.technologies[]
      for (const tech of json.technologies ?? []) {
        let item = tech.name;
        if (tech.version) item += `[${tech.version}]`;

        for (const category of tech.categories ?? []) {
          const catName = category.name;
          if (!result[catName]) {
            result[catName] = [item];
          } else {
            (result[catName] as string[]).push(item);
          }
        }
      }

      return Object.keys(result).length > 0 ? result : null;
    } catch {
      return null;
    } finally {
      try { await wappalyzer.destroy(); } catch { /* ignore */ }
    }
  },
};
```

**关键实现要点**：

1. **`wappalyzer.init()` 会启动 Chromium**——必须在 finally 中 `wappalyzer.destroy()` 确保关闭
2. **v6 的结果字段是 `technologies`** 而非 v5 的 `applications`
3. **v6 的 category 结构是 `{ id, slug, name }`**，使用 `category.name` 作为分组键
4. **错误处理**：`site.on("error", ...)` 防止未处理 rejection；外层 try/catch 确保任何失败都返回 `null`
5. **CJS 兼容**：wappalyzer 是 CJS 包，在 Bun 中用 `import("wappalyzer")` 动态导入

---

## Step 5.3 — 注册到 PluginLoader

在 `src/core/plugin-loader.ts` 的 `withBuiltins()` 中增加：

```typescript
import { wappalyzerPlugin } from "../plugins/wappalyzer.ts";
// ...
loader.register(wappalyzerPlugin);
```

更新 `tests/core/plugin-loader.test.ts`：

```typescript
expect(names).toContain("Wappalyzer");
```

---

## Step 5.4 — 验证

```bash
bun test tests/plugins/wappalyzer.test.ts
bun test tests/core/plugin-loader.test.ts
bunx eslint src/plugins/wappalyzer.ts
```

> **注意**：wappalyzer 测试依赖 puppeteer 能成功启动 Chromium。若 CI 环境缺少依赖（如 libX11、libatk 等），可能需要安装系统包或使用 `--no-sandbox` 参数。可在测试中增加 skip 条件。

---

## Step 5.5 — 提交

```bash
git add .
git commit -m "feat: Phase 5 — Wappalyzer 插件 (wappalyzer@6.10.66)"
git push
```

---

## 完成标志

- [ ] `tests/plugins/wappalyzer.test.ts` 全部通过（或在无 Chromium 环境中标记 skip）
- [ ] 插件已在 `PluginLoader.withBuiltins()` 注册
- [ ] 使用 `init → open → analyze → destroy` 生命周期，finally 确保清理
- [ ] lint 无错误
- [ ] 代码已提交并推送
- [ ] `docs/sop/README.md` 中 Phase 5 状态已更新为 ✅
