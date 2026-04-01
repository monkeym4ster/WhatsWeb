# Phase 4：基础插件 TDD — base-info、email、geoip

> **前置条件**：Phase 3 已完成（Plugin 接口、PluginLoader 可用）
> **产出物**：三个基础插件及其测试，全部通过
> **TDD 顺序**：每个插件 ① 写测试 → ② 写实现 → ③ 运行测试 → ④ 在 PluginLoader.withBuiltins() 中注册

---

## 插件概览

| 插件 | 文件 | 测试文件 | 原始代码 | 功能 |
|------|------|----------|----------|------|
| Base Info | `src/plugins/base-info.ts` | `tests/plugins/base-info.test.ts` | `plugins/base-info.js` | 状态码、标题、重定向、x-* 头 |
| Email | `src/plugins/email.ts` | `tests/plugins/email.test.ts` | `plugins/email.js` | 从 HTML 中提取邮箱 |
| GeoIP | `src/plugins/geoip.ts` | `tests/plugins/geoip.test.ts` | `plugins/geoip.js` | IP 地理位置查询 |

---

## Step 4.1 — Base Info 插件

### 4.1.1 先写测试 `tests/plugins/base-info.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { baseInfoPlugin } from "../../src/plugins/base-info.ts";
import type { PluginContext } from "../../src/plugins/types.ts";

const makeContext = (overrides: Partial<PluginContext["response"]> & { url?: string }): PluginContext => ({
  url: overrides.url ?? "http://example.com",
  timeout: 5000,
  userAgent: "test",
  response: {
    status: 200,
    statusText: "OK",
    headers: {},
    text: "",
    url: overrides.url ?? "http://example.com",
    ...overrides,
  },
});

describe("baseInfoPlugin", () => {
  test("meta.name 正确", () => {
    expect(baseInfoPlugin.meta.name).toBe("Base Information");
  });

  test("提取状态码", async () => {
    const result = await baseInfoPlugin.execute(makeContext({ status: 200, statusText: "OK" }));
    expect(result?.status).toBe("200 OK");
  });

  test("提取 <title> 标签", async () => {
    const result = await baseInfoPlugin.execute(
      makeContext({ text: "<html><title>Hello World</title></html>" }),
    );
    expect(result?.title).toBe("Hello World");
  });

  test("标题中的换行符被转义", async () => {
    const result = await baseInfoPlugin.execute(
      makeContext({ text: "<html><title>Line1\nLine2\rLine3</title></html>" }),
    );
    expect(result?.title).toBe("Line1\\nLine2\\rLine3");
  });

  test("无 title 时结果中不含 title 字段", async () => {
    const result = await baseInfoPlugin.execute(makeContext({ text: "<html><body>No title</body></html>" }));
    expect(result?.title).toBeUndefined();
  });

  test("检测重定向（最终 URL 与原始 URL 不同）", async () => {
    const result = await baseInfoPlugin.execute(
      makeContext({
        url: "http://example.com",
        status: 200,
        statusText: "OK",
        text: "<html></html>",
        headers: {},
      }),
    );
    // url 不同才有 redirect
    const ctx = makeContext({ text: "<html></html>" });
    ctx.url = "http://example.com";
    ctx.response.url = "http://example.com/redirected";
    const r2 = await baseInfoPlugin.execute(ctx);
    expect(r2?.redirect).toBe("http://example.com/redirected");
  });

  test("提取 x-* 响应头", async () => {
    const result = await baseInfoPlugin.execute(
      makeContext({
        text: "<html></html>",
        headers: {
          "x-powered-by": "Express",
          "x-request-id": "abc123",
          "content-type": "text/html",
        },
      }),
    );
    expect(result?.["x-powered-by"]).toBe("Express");
    expect(result?.["x-request-id"]).toBe("abc123");
    expect(result?.["content-type"]).toBeUndefined(); // 非 x-* 头不提取
  });
});
```

### 4.1.2 实现 `src/plugins/base-info.ts`

**功能需求**（参考原 `plugins/base-info.js`）：

```typescript
import type { Plugin } from "./types.ts";

export const baseInfoPlugin: Plugin = {
  meta: { name: "Base Information" },
  async execute(ctx) {
    const { response, url } = ctx;
    const result: Record<string, unknown> = {};

    // 1. 状态码: "200 OK"
    result.status = `${response.status} ${response.statusText}`;

    // 2. 重定向检测: response.url !== url 时记录
    if (response.url !== url) {
      result.redirect = response.url;
    }

    // 3. 标题提取: 正则 /<title>([^<]+)<\/title>/i
    //    换行符转义: \n → \\n, \r → \\r

    // 4. x-* 响应头: 遍历 headers，提取所有以 "x-" 开头的键

    // 结果为空（仅有 status）时仍返回
    return result;
  },
};
```

**es-toolkit 用法**：可使用 `pickBy` 过滤 x-* 头：
```typescript
import { pickBy } from "es-toolkit";
const xHeaders = pickBy(response.headers, (_v, k) => k.startsWith("x-"));
Object.assign(result, xHeaders);
```

### 4.1.3 验证

```bash
bun test tests/plugins/base-info.test.ts
```

---

## Step 4.2 — Email 插件

### 4.2.1 先写测试 `tests/plugins/email.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { emailPlugin } from "../../src/plugins/email.ts";
import type { PluginContext } from "../../src/plugins/types.ts";

const makeContext = (html: string): PluginContext => ({
  url: "http://example.com",
  timeout: 5000,
  userAgent: "test",
  response: { status: 200, statusText: "OK", headers: {}, text: html, url: "http://example.com" },
});

describe("emailPlugin", () => {
  test("meta.name 正确", () => {
    expect(emailPlugin.meta.name).toBe("Email");
  });

  test("从 HTML 中提取多个邮箱", async () => {
    const html = "Contact: admin@test.com and info@test.com for details";
    const result = await emailPlugin.execute(makeContext(html));
    expect(result?.email).toEqual(expect.arrayContaining(["admin@test.com", "info@test.com"]));
  });

  test("邮箱去重", async () => {
    const html = "admin@test.com admin@test.com admin@test.com info@test.com";
    const result = await emailPlugin.execute(makeContext(html));
    expect(result?.email).toEqual(["admin@test.com", "info@test.com"]);
  });

  test("少于 2 个唯一邮箱时返回 null", async () => {
    const html = "Only one: admin@test.com";
    const result = await emailPlugin.execute(makeContext(html));
    expect(result).toBeNull();
  });

  test("无邮箱时返回 null", async () => {
    const result = await emailPlugin.execute(makeContext("<html>No emails here</html>"));
    expect(result).toBeNull();
  });
});
```

### 4.2.2 实现 `src/plugins/email.ts`

**功能需求**（参考原 `plugins/email.js`）：

```typescript
import type { Plugin } from "./types.ts";
import { uniq } from "es-toolkit";

export const emailPlugin: Plugin = {
  meta: { name: "Email" },
  async execute(ctx) {
    const { response } = ctx;
    const matched = response.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}/gi);
    if (!matched) return null;

    // 使用 es-toolkit 的 uniq 去重
    const emails = uniq(matched);

    // 原逻辑：至少 2 个唯一邮箱才返回
    if (emails.length < 2) return null;
    return { email: emails };
  },
};
```

### 4.2.3 验证

```bash
bun test tests/plugins/email.test.ts
```

---

## Step 4.3 — GeoIP 插件

### 4.3.1 先写测试 `tests/plugins/geoip.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { geoipPlugin } from "../../src/plugins/geoip.ts";
import type { PluginContext } from "../../src/plugins/types.ts";

const makeContext = (url: string): PluginContext => ({
  url,
  timeout: 5000,
  userAgent: "test",
  response: { status: 200, statusText: "OK", headers: {}, text: "", url },
});

describe("geoipPlugin", () => {
  test("meta.name 正确", () => {
    expect(geoipPlugin.meta.name).toBe("Geolocation");
  });

  test("解析 IP 并返回地理信息", async () => {
    // 使用已知的公共 DNS IP
    const result = await geoipPlugin.execute(makeContext("http://8.8.8.8"));
    expect(result?.ip).toBe("8.8.8.8");
    // geoip-lite 应能查到 Google DNS 的地理信息
    expect(result?.country).toBeDefined();
  });

  test("域名会被解析为 IP", async () => {
    const result = await geoipPlugin.execute(makeContext("http://dns.google"));
    expect(result?.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  test("无法解析的域名应返回 null 或抛出错误", async () => {
    try {
      const result = await geoipPlugin.execute(
        makeContext("http://this-domain-does-not-exist-xyz123.com"),
      );
      // 如果不抛错，结果应为 null
      expect(result).toBeNull();
    } catch {
      // 抛错也是可接受的行为
    }
  });
});
```

### 4.3.2 实现 `src/plugins/geoip.ts`

**功能需求**（参考原 `plugins/geoip.js`）：

```typescript
import type { Plugin } from "./types.ts";
import { resolve4 } from "../utils/dns.ts";
import geoip from "geoip-lite";

export const geoipPlugin: Plugin = {
  meta: { name: "Geolocation" },
  async execute(ctx) {
    const { url } = ctx;
    const { host } = new URL(url); // 替代原 Url.parse()
    if (!host) return null;

    const ip = await resolve4(host);
    const result: Record<string, unknown> = { ip };

    const geo = geoip.lookup(ip);
    if (geo) {
      const { country, city } = geo;
      result.country = [city, country].filter(Boolean).join("/");
    }

    return result;
  },
};
```

### 4.3.3 验证

```bash
bun test tests/plugins/geoip.test.ts
```

---

## Step 4.4 — 注册内置插件

在 `src/core/plugin-loader.ts` 的 `withBuiltins()` 中注册三个插件：

```typescript
import { baseInfoPlugin } from "../plugins/base-info.ts";
import { emailPlugin } from "../plugins/email.ts";
import { geoipPlugin } from "../plugins/geoip.ts";

static withBuiltins(): PluginLoader {
  const loader = new PluginLoader();
  loader.register(baseInfoPlugin);
  loader.register(emailPlugin);
  loader.register(geoipPlugin);
  // wappalyzer 和 bbscan 在后续 Phase 添加
  return loader;
}
```

更新 `tests/core/plugin-loader.test.ts` 中 `withBuiltins` 的测试：

```typescript
test("加载所有内置插件", () => {
  const loader = PluginLoader.withBuiltins();
  const names = loader.getAll().map((p) => p.meta.name);
  expect(names).toContain("Base Information");
  expect(names).toContain("Email");
  expect(names).toContain("Geolocation");
});
```

---

## 最终验证

```bash
bun test tests/plugins/base-info.test.ts tests/plugins/email.test.ts tests/plugins/geoip.test.ts
bun test tests/core/plugin-loader.test.ts
bunx biome check src/plugins/ src/core/
```

---

## 提交

```bash
git add .
git commit -m "feat: Phase 4 — 基础插件 TDD (base-info/email/geoip + es-toolkit)"
git push
```

---

## 完成标志

- [ ] `tests/plugins/base-info.test.ts` 全部通过
- [ ] `tests/plugins/email.test.ts` 全部通过
- [ ] `tests/plugins/geoip.test.ts` 全部通过
- [ ] 三个插件均已在 `PluginLoader.withBuiltins()` 注册
- [ ] `tests/core/plugin-loader.test.ts` 更新后全部通过
- [ ] lint 无错误
- [ ] 代码已提交并推送
- [ ] `docs/sop/README.md` 中 Phase 4 状态已更新为 ✅
