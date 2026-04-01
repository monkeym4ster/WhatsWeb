# Phase 2：工具层 TDD

> **前置条件**：Phase 1 已完成
> **产出物**：`src/utils/` 下 4 个工具模块 + Zod schema + p-limit 集成，及其对应测试，全部测试通过
> **开发顺序**：每个模块按 ① 写测试 → ② 写实现 → ③ 运行测试 → ④ 通过 的 TDD 流程

---

## 第三方库说明

本 Phase 会用到以下新引入的第三方库：

| 库 | 用途 | 选型理由 |
|----|------|----------|
| **es-toolkit** | 通用工具函数（`groupBy`、`uniq`、`pick` 等） | 替代 lodash — 2-3x 更快、97% 更小、原生 TypeScript、完美 tree-shaking |
| **p-limit@7** | 并发控制 | 替代自写并发池和 bluebird.Promise.map — 成熟（~100M 周下载）、ESM 原生、API 简洁 |
| **zod** | 运行时数据验证 + TypeScript 类型推断 | CLI 参数验证、插件结果验证、规则文件解析验证 |

> **es-toolkit 使用原则**：优先使用 JS 原生方法（如 `Array.prototype.flat`、`structuredClone`、`Object.groupBy`），仅在原生不支持或 es-toolkit 明显更优时引入。Bun 对现代 JS API 支持完善，可放心使用原生方法。

---

## 模块概览

| 文件 | 测试文件 | 功能 | 对应原始代码 |
|------|----------|------|-------------|
| `src/utils/url.ts` | `tests/utils/url.test.ts` | URL 规范化 + Zod schema | `utils.js: normalUrl` |
| `src/utils/dns.ts` | `tests/utils/dns.test.ts` | DNS A 记录解析 | `utils.js: resolve4` |
| `src/utils/ip.ts` | `tests/utils/ip.test.ts` | CIDR IP 展开 | `utils.js: ipGenerator` |
| `src/utils/http.ts` | `tests/utils/http.test.ts` | 基于 fetch 的 HTTP 封装 | `superagent` 调用点 |

---

## Step 2.1 — URL 工具 (`src/utils/url.ts`)

### 2.1.1 先写测试 `tests/utils/url.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { normalizeUrl, urlSchema } from "../../src/utils/url.ts";

describe("normalizeUrl", () => {
  test("为无协议的 URL 自动补全 http://", () => {
    expect(normalizeUrl("example.com")).toBe("http://example.com");
  });

  test("保留已有的 http:// 协议", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  test("保留已有的 https:// 协议", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  test("处理带端口的 URL", () => {
    expect(normalizeUrl("example.com:8080")).toBe("http://example.com:8080");
  });

  test("处理带路径的 URL", () => {
    expect(normalizeUrl("example.com/path")).toBe("http://example.com/path");
  });

  test("空字符串应抛出错误", () => {
    expect(() => normalizeUrl("")).toThrow();
  });

  test("null/undefined 应抛出错误", () => {
    expect(() => normalizeUrl(null as unknown as string)).toThrow();
    expect(() => normalizeUrl(undefined as unknown as string)).toThrow();
  });
});

describe("urlSchema (Zod)", () => {
  test("合法 URL 通过验证", () => {
    const result = urlSchema.safeParse("http://example.com");
    expect(result.success).toBe(true);
  });

  test("空字符串验证失败", () => {
    const result = urlSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  test("自动补全协议后通过验证（使用 transform）", () => {
    const result = urlSchema.safeParse("example.com");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("http://example.com");
    }
  });
});
```

### 2.1.2 实现 `src/utils/url.ts`

**功能需求**（参考原 `utils.js` 第 20-23 行）：
- `normalizeUrl(url: string): string` — 基础函数，保持简单逻辑
  - 若 `url` 为空值，抛出 `Error`
  - 若 `url` 不以 `http://` 或 `https://` 开头，自动补全 `http://` 前缀
- `urlSchema` — Zod schema，用 `z.string().min(1).transform(...)` 实现 URL 验证 + 协议补全
  - 使用 `z.string()` 作为基础
  - 通过 `.transform()` 在验证过程中自动调用 `normalizeUrl`

### 2.1.3 验证

```bash
bun test tests/utils/url.test.ts
```

---

## Step 2.2 — DNS 工具 (`src/utils/dns.ts`)

### 2.2.1 先写测试 `tests/utils/dns.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { resolve4 } from "../../src/utils/dns.ts";

describe("resolve4", () => {
  test("IPv4 地址直接返回", async () => {
    expect(await resolve4("1.2.3.4")).toBe("1.2.3.4");
  });

  test("非 IPv4 字符串进行 DNS 解析", async () => {
    const ip = await resolve4("dns.google");
    expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  test("不存在的域名应抛出错误", async () => {
    await expect(resolve4("this-domain-does-not-exist-xyz123.com")).rejects.toThrow();
  });
});
```

### 2.2.2 实现 `src/utils/dns.ts`

**功能需求**（参考原 `utils.js` 第 5-18 行）：
- 使用 `node:net` 的 `isIPv4()` 判断输入是否已经是 IPv4 地址，如果是则直接返回
- 否则使用 `node:dns/promises` 的 `resolve4()` 进行 DNS 查询，返回第一个 A 记录
- 查询失败或无结果时抛出 Error

### 2.2.3 验证

```bash
bun test tests/utils/dns.test.ts
```

---

## Step 2.3 — IP/CIDR 工具 (`src/utils/ip.ts`)

### 2.3.1 先写测试 `tests/utils/ip.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { expandCIDR, ipToLong, longToIp } from "../../src/utils/ip.ts";

describe("ipToLong / longToIp", () => {
  test("IP 与长整型互转", () => {
    expect(ipToLong("192.168.1.1")).toBe(3232235777);
    expect(longToIp(3232235777)).toBe("192.168.1.1");
  });

  test("边界值: 0.0.0.0 和 255.255.255.255", () => {
    expect(ipToLong("0.0.0.0")).toBe(0);
    expect(ipToLong("255.255.255.255")).toBe(4294967295);
    expect(longToIp(0)).toBe("0.0.0.0");
    expect(longToIp(4294967295)).toBe("255.255.255.255");
  });
});

describe("expandCIDR", () => {
  test("/30 网段应展开为 2 个可用地址", () => {
    const ips = [...expandCIDR("192.168.1.0/30")];
    expect(ips).toEqual(["192.168.1.1", "192.168.1.2"]);
  });

  test("/32 网段应展开为 1 个地址", () => {
    const ips = [...expandCIDR("192.168.1.100/32")];
    expect(ips).toEqual(["192.168.1.100"]);
  });

  test("/24 网段应展开为 254 个地址", () => {
    const ips = [...expandCIDR("10.0.0.0/24")];
    expect(ips.length).toBe(254);
    expect(ips[0]).toBe("10.0.0.1");
    expect(ips[253]).toBe("10.0.0.254");
  });

  test("非法 CIDR 应抛出错误", () => {
    expect(() => [...expandCIDR("invalid")]).toThrow();
  });
});
```

### 2.3.2 实现 `src/utils/ip.ts`

**功能需求**（替代原 `utils.js` 第 25-39 行 + `ip` 包）：
- `ipToLong(ip: string): number` — IP 字符串转 32 位无符号整数
- `longToIp(long: number): string` — 32 位无符号整数转 IP 字符串
- `expandCIDR(cidr: string): Generator<string>` — 使用 Generator 展开 CIDR 范围内所有可用 IP
  - 对于 /32，返回单个地址
  - 对于 /31 及更大范围，排除网络地址和广播地址
  - 非法输入抛出 Error

**重要**：使用 Generator（`function*`）替代原代码中的数组预分配，避免大网段内存爆炸。

### 2.3.3 验证

```bash
bun test tests/utils/ip.test.ts
```

---

## Step 2.4 — HTTP 封装 (`src/utils/http.ts`)

### 2.4.1 先写测试 `tests/utils/http.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { httpGet, httpHead } from "../../src/utils/http.ts";
import type { HttpResponse } from "../../src/utils/http.ts";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/ok") {
        return new Response("<html><title>Test Page</title></html>", {
          headers: { "content-type": "text/html", "x-powered-by": "test" },
        });
      }
      if (url.pathname === "/redirect") {
        return Response.redirect(`http://localhost:${server.port}/ok`, 302);
      }
      if (url.pathname === "/slow") {
        return new Promise((resolve) => setTimeout(() => resolve(new Response("slow")), 5000));
      }
      return new Response("Not Found", { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

describe("httpGet", () => {
  test("正常 GET 请求", async () => {
    const res = await httpGet(`${baseUrl}/ok`, { timeout: 5000, userAgent: "test" });
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Test Page</title>");
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["x-powered-by"]).toBe("test");
  });

  test("非 2xx 状态码不抛异常（对齐原 superagent .ok(() => true) 行为）", async () => {
    const res = await httpGet(`${baseUrl}/not-exist`, { timeout: 5000, userAgent: "test" });
    expect(res.status).toBe(404);
  });

  test("跟踪重定向并记录最终 URL", async () => {
    const res = await httpGet(`${baseUrl}/redirect`, { timeout: 5000, userAgent: "test" });
    expect(res.status).toBe(200);
    expect(res.url).toContain("/ok");
  });

  test("超时应抛出错误", async () => {
    await expect(httpGet(`${baseUrl}/slow`, { timeout: 500, userAgent: "test" })).rejects.toThrow();
  });
});

describe("httpHead", () => {
  test("HEAD 请求返回头信息", async () => {
    const res = await httpHead(`${baseUrl}/ok`, { timeout: 5000, userAgent: "test" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });
});
```

### 2.4.2 实现 `src/utils/http.ts`

**功能需求**（替代 `superagent` 的所有使用点）：

```typescript
import { z } from "zod";

export interface RequestOptions {
  timeout: number;
  userAgent: string;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
  url: string; // 重定向后的最终 URL
}

// 可选：使用 Zod 验证 RequestOptions
export const requestOptionsSchema = z.object({
  timeout: z.number().positive(),
  userAgent: z.string().min(1),
});

export async function httpGet(url: string, options: RequestOptions): Promise<HttpResponse>;
export async function httpHead(url: string, options: RequestOptions): Promise<HttpResponse>;
```

**实现要点**：
- 基于 Bun 原生 `fetch`
- 设置 `Accept: */*`、`Accept-Encoding: ""`（与原 superagent 配置一致）、自定义 `User-Agent`
- 超时控制使用 `AbortController` + `setTimeout`
- **不抛异常**（非 2xx 也正常返回），对齐原代码 `.ok(() => true)` 的行为
- 跟踪重定向：`fetch` 默认 `redirect: "follow"`，通过 `response.url` 获取最终 URL
- 将所有响应头转为小写 key 的 `Record<string, string>`

**注意**：`HttpResponse` 类型在此处定义后，需同步更新 `src/plugins/types.ts` 中的 `HttpResponse` 为从此文件 re-export，保持类型来源唯一。

### 2.4.3 验证

```bash
bun test tests/utils/http.test.ts
```

---

## Step 2.5 — p-limit 并发控制封装

**不再自写并发池**。改为封装 `p-limit@7`，提供项目统一的并发 map 工具。

### 2.5.1 先写测试 `tests/utils/concurrency.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { mapConcurrent } from "../../src/utils/concurrency.ts";

describe("mapConcurrent (基于 p-limit)", () => {
  test("所有任务按原始顺序返回结果", async () => {
    const input = [1, 2, 3, 4, 5];
    const results = await mapConcurrent(input, async (n) => n * 2, { concurrency: 2 });
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  test("空数组返回空数组", async () => {
    const results = await mapConcurrent([], async (n: number) => n, { concurrency: 5 });
    expect(results).toEqual([]);
  });

  test("并发度生效（不超过指定上限）", async () => {
    let running = 0;
    let maxRunning = 0;
    await mapConcurrent(
      Array.from({ length: 20 }, (_, i) => i),
      async (n) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 50));
        running--;
        return n;
      },
      { concurrency: 5 },
    );
    expect(maxRunning).toBeLessThanOrEqual(5);
  });

  test("单个任务失败不影响其他任务（传入 onError 回调时）", async () => {
    const errors: Error[] = [];
    const results = await mapConcurrent(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error("fail");
        return n;
      },
      {
        concurrency: 2,
        onError: (err) => errors.push(err as Error),
      },
    );
    expect(results).toEqual([1, undefined, 3]);
    expect(errors.length).toBe(1);
  });

  test("未提供 onError 时，错误直接抛出", async () => {
    await expect(
      mapConcurrent(
        [1, 2, 3],
        async (n) => {
          if (n === 2) throw new Error("boom");
          return n;
        },
        { concurrency: 1 },
      ),
    ).rejects.toThrow("boom");
  });
});
```

### 2.5.2 实现 `src/utils/concurrency.ts`

```typescript
import pLimit from "p-limit";

export interface MapConcurrentOptions {
  concurrency: number;
  onError?: (error: unknown, item: unknown, index: number) => void;
}

/**
 * 基于 p-limit 的并发 map 工具，替代 bluebird.Promise.map。
 * 结果数组按原始顺序排列。
 */
export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: MapConcurrentOptions,
): Promise<(R | undefined)[]> {
  const limit = pLimit(options.concurrency);

  const tasks = items.map((item, index) =>
    limit(async () => {
      try {
        return await fn(item, index);
      } catch (error) {
        if (options.onError) {
          options.onError(error, item, index);
          return undefined;
        }
        throw error;
      }
    }),
  );

  return Promise.all(tasks);
}
```

> **为什么用 p-limit 而不是自己写**：p-limit@7 经过充分测试（周下载 ~100M），支持 `activeCount`、`pendingCount`、`clearQueue()` 等高级特性，后续可直接使用。自写并发池容易在边界情况（如任务取消、错误传播）上出 bug。

### 2.5.3 验证

```bash
bun test tests/utils/concurrency.test.ts
```

---

## Step 2.6 — es-toolkit 使用指南

**es-toolkit 不需要单独的工具文件**，而是在需要的地方直接 import 使用。以下是本项目中的典型用法供后续 Phase 参考：

```typescript
// 去重（替代 lodash.uniq / Array.from(new Set(...))）
import { uniq } from "es-toolkit";
const targets = uniq(rawTargets);

// 按分类分组（替代手动 for 循环）
import { groupBy } from "es-toolkit";
const grouped = groupBy(apps, (app) => app.category);

// 选取对象部分字段
import { pick } from "es-toolkit";
const subset = pick(result, ["status", "title", "redirect"]);

// 对象深拷贝（优先用原生 structuredClone，es-toolkit 提供 cloneDeep 作为 fallback）
const copy = structuredClone(data);

// 判空
import { isEmpty } from "es-toolkit";
if (isEmpty(result)) return null;
```

> **原则**：不要 `import * from "es-toolkit"` — 始终具名导入，确保 tree-shaking 生效。

---

## 最终验证

```bash
bun test tests/utils/

bunx eslint src/utils/
bunx prettier --check src/utils/
```

---

## 提交

```bash
git add .
git commit -m "feat: Phase 2 — 工具层 TDD (url/dns/ip/http + p-limit + zod)"
git push
```

---

## 完成标志

- [ ] `tests/utils/url.test.ts` 全部通过（含 Zod schema 测试）
- [ ] `tests/utils/dns.test.ts` 全部通过
- [ ] `tests/utils/ip.test.ts` 全部通过
- [ ] `tests/utils/http.test.ts` 全部通过
- [ ] `tests/utils/concurrency.test.ts` 全部通过（基于 p-limit）
- [ ] `bunx eslint src/utils/
bunx prettier --check src/utils/` 无错误
- [ ] 代码已提交并推送
- [ ] `docs/sop/README.md` 中 Phase 2 状态已更新为 ✅
