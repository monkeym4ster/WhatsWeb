# Phase 6：BBScan 插件

> **前置条件**：Phase 4 已完成（http 工具、p-limit 可用）
> **产出物**：`src/plugins/bbscan/` 三文件模块 + 测试 + 注册到 PluginLoader
> **TDD 顺序**：rule-parser（纯逻辑，先做）→ scanner → index（插件入口）

---

## 模块拆分

原 `plugins/bbscan.js`（210 行）拆分为三个文件：

| 文件 | 职责 | 测试文件 |
|------|------|----------|
| `src/plugins/bbscan/rule-parser.ts` | 解析 `rules/*.txt`、`white.list`、`black.list` | `tests/plugins/bbscan/rule-parser.test.ts` |
| `src/plugins/bbscan/scanner.ts` | 404 检测、路径探测、结果过滤 | `tests/plugins/bbscan/scanner.test.ts` |
| `src/plugins/bbscan/index.ts` | 插件入口，实现 `Plugin` 接口 | `tests/plugins/bbscan/index.test.ts` |

---

## Step 6.1 — 规则解析器 TDD (`rule-parser.ts`)

### 6.1.1 Zod Schema 定义

```typescript
import { z } from "zod";

/** 单条扫描规则 */
export const scanRuleSchema = z.object({
  uri: z.string().startsWith("/"),
  tag: z.string().default(""),
  status: z.number().int().min(100).max(599).nullable().default(null),
  contentType: z.string().default(""),
  contentTypeNo: z.string().default(""),
  rootOnly: z.boolean().default(false),
});

export type ScanRule = z.infer<typeof scanRuleSchema>;

/** 白名单/黑名单规则 */
export interface ListRule {
  texts: string[];
  regexes: RegExp[];
}
```

### 6.1.2 先写测试 `tests/plugins/bbscan/rule-parser.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { parseRuleLine, parseRuleFiles, parseListFile } from "../../../src/plugins/bbscan/rule-parser.ts";

describe("parseRuleLine", () => {
  test("解析完整规则行", () => {
    const line = '/admin.php    {status=200}    {tag="type=\\"password\\""}    {root_only}';
    const rule = parseRuleLine(line);
    expect(rule).not.toBeNull();
    expect(rule?.uri).toBe("/admin.php");
    expect(rule?.status).toBe(200);
    expect(rule?.rootOnly).toBe(true);
  });

  test("解析仅有 URI 和 status 的行", () => {
    const line = "/core              {status=200}     {tag=\"ELF\"}       {root_only}";
    const rule = parseRuleLine(line);
    expect(rule?.uri).toBe("/core");
    expect(rule?.status).toBe(200);
    expect(rule?.tag).toBe("ELF");
    expect(rule?.rootOnly).toBe(true);
  });

  test("解析含 content-type 的行", () => {
    const line = '/debug.txt         {status=200}     {type="text/plain"}    {root_only}';
    const rule = parseRuleLine(line);
    expect(rule?.contentType).toBe("text/plain");
    expect(rule?.contentTypeNo).toBe("");
  });

  test("解析含 type_no 的行", () => {
    const line = '/config/database.yml       {status=200}    {type_no="html"}  {tag="password"}    {root_only}';
    const rule = parseRuleLine(line);
    expect(rule?.contentTypeNo).toBe("html");
    expect(rule?.tag).toBe("password");
  });

  test("跳过注释行", () => {
    expect(parseRuleLine("# This is a comment")).toBeNull();
  });

  test("跳过非 / 开头的行", () => {
    expect(parseRuleLine("not a rule")).toBeNull();
    expect(parseRuleLine("")).toBeNull();
  });
});

describe("parseListFile", () => {
  test("解析白名单文件内容", () => {
    const content = `
# comment
{text="<title>Index of"}
{text="<title>phpMyAdmin</title>"}
{regex_text="<title>.*后台.*</title>"}
    `.trim();
    const result = parseListFile(content);
    expect(result.texts).toContain("<title>Index of");
    expect(result.texts).toContain("<title>phpMyAdmin</title>");
    expect(result.regexes.length).toBe(1);
    expect(result.regexes[0].test("<title>管理后台系统</title>")).toBe(true);
  });

  test("跳过空行和注释", () => {
    const content = "# comment\n\n{text=\"valid\"}";
    const result = parseListFile(content);
    expect(result.texts).toEqual(["valid"]);
  });
});

describe("parseRuleFiles", () => {
  test("从 rules/ 目录加载真实规则文件", async () => {
    const rules = await parseRuleFiles();
    expect(rules.length).toBeGreaterThan(0);
    // 每条规则应有 uri 字段
    for (const rule of rules) {
      expect(rule.uri).toMatch(/^\//);
    }
  });
});
```

### 6.1.3 实现 `src/plugins/bbscan/rule-parser.ts`

**功能需求**（参考原 `bbscan.js` 第 35-128 行）：

- `parseRuleLine(line: string): ScanRule | null` — 解析单行规则
  - 正则提取 `{tag="..."}`, `{status=NNN}`, `{type="..."}`, `{type_no="..."}`, `{root_only}`
  - 非 `/` 开头的行返回 `null`
  - 使用 Zod `scanRuleSchema` 验证解析结果
- `parseListFile(content: string): ListRule` — 解析白/黑名单文件内容
  - 提取 `{text="..."}` 和 `{regex_text="..."}` 条目
- `parseRuleFiles(rulesDir?: string): Promise<ScanRule[]>` — 使用 `Bun.Glob` 扫描 `rules/*.txt` 并解析
- `loadWhiteList(rulesDir?: string): Promise<ListRule>` — 加载并解析 `white.list`
- `loadBlackList(rulesDir?: string): Promise<ListRule>` — 加载并解析 `black.list`

**Bun API 使用**：
```typescript
// 使用 Bun.Glob 替代 globby
const glob = new Bun.Glob("*.txt");
for await (const file of glob.scan({ cwd: rulesDir })) {
  const content = await Bun.file(path.join(rulesDir, file)).text();
  // ...
}
```

**`import.meta.dir` 替代 `__dirname`**：
```typescript
const defaultRulesDir = path.join(import.meta.dir, "../../../rules");
```

### 6.1.4 验证

```bash
bun test tests/plugins/bbscan/rule-parser.test.ts
```

---

## Step 6.2 — 路径扫描器 TDD (`scanner.ts`)

### 6.2.1 先写测试 `tests/plugins/bbscan/scanner.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { BBScanner } from "../../../src/plugins/bbscan/scanner.ts";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);

      // 404 检测端点
      if (url.pathname === "/WhatsWeb-404-existence-check") {
        return new Response("Not Found", { status: 404 });
      }

      // 模拟敏感路径
      if (url.pathname === "/.git/config") {
        return new Response("[core]\n\trepositoryformatversion = 0", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }

      if (url.pathname === "/.svn/entries") {
        return new Response("12\n-props", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

describe("BBScanner", () => {
  test("check404 — 服务器支持 404", async () => {
    const scanner = new BBScanner({ url: baseUrl, userAgent: "test", timeout: 5000 });
    const has404 = await scanner.check404();
    expect(has404).toBe(true);
  });

  test("完整扫描流程 — 发现敏感路径", async () => {
    const scanner = new BBScanner({ url: baseUrl, userAgent: "test", timeout: 5000 });
    const results = await scanner.run();
    expect(results).toBeInstanceOf(Array);
    // 应能发现 .git/config
    if (Array.isArray(results)) {
      expect(results.some((r) => r.includes(".git"))).toBe(true);
    }
  }, 30000);
});
```

### 6.2.2 实现 `src/plugins/bbscan/scanner.ts`

**功能需求**（参考原 `bbscan.js` 第 9-193 行）：

```typescript
import pLimit from "p-limit";
import { httpHead, httpGet } from "../../utils/http.ts";
import type { ScanRule, ListRule } from "./rule-parser.ts";

export interface BBScannerOptions {
  url: string;
  userAgent: string;
  timeout: number;
}

export class BBScanner {
  private host: string;
  private protocol: string;
  private rules: ScanRule[] = [];
  private whiteList: ListRule = { texts: [], regexes: [] };
  private blackList: ListRule = { texts: [], regexes: [] };

  constructor(private opts: BBScannerOptions) {
    const parsed = new URL(opts.url);
    this.host = parsed.host;
    this.protocol = parsed.protocol;
  }

  /** 检测服务器是否正确返回 404 */
  async check404(): Promise<boolean>;

  /** 加载规则 + 白/黑名单 */
  async loadRules(): Promise<void>;

  /** 执行扫描 */
  async run(): Promise<string[] | false>;
}
```

**实现要点**：
- `check404()`：HEAD 请求 `/WhatsWeb-404-existence-check`，期望 404
- `loadRules()`：调用 rule-parser 的 `parseRuleFiles()`, `loadWhiteList()`, `loadBlackList()`
- `run()`：
  1. 先 `check404()`，不支持则返回 `false`
  2. 加载规则
  3. 使用 **p-limit** 并发 50 扫描所有路径
  4. 路径中替换 `{sub}`, `{hostname}`, `{hostname_or_folder}` 变量
  5. 对含 `{tag=...}` 的规则使用 `httpGet`（需要 body），其他用 `httpHead`
  6. 匹配白名单/黑名单文本
  7. 检查 status、content-type 等条件
  8. 返回命中的路径数组

### 6.2.3 验证

```bash
bun test tests/plugins/bbscan/scanner.test.ts
```

---

## Step 6.3 — 插件入口 (`index.ts`)

### 6.3.1 先写测试 `tests/plugins/bbscan/index.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { bbscanPlugin } from "../../../src/plugins/bbscan/index.ts";

describe("bbscanPlugin", () => {
  test("meta.name 正确", () => {
    expect(bbscanPlugin.meta.name).toBe("BBScan");
  });

  test("实现了 Plugin 接口", () => {
    expect(typeof bbscanPlugin.execute).toBe("function");
  });
});
```

### 6.3.2 实现 `src/plugins/bbscan/index.ts`

```typescript
import type { Plugin } from "../types.ts";
import { BBScanner } from "./scanner.ts";

export const bbscanPlugin: Plugin = {
  meta: { name: "BBScan", description: "路径扫描 (基于规则文件)" },
  async execute(ctx) {
    const scanner = new BBScanner({
      url: ctx.url,
      userAgent: ctx.userAgent,
      timeout: ctx.timeout,
    });
    const paths = await scanner.run();
    if (!paths || paths.length === 0) return null;
    return { paths };
  },
};
```

---

## Step 6.4 — 注册到 PluginLoader

```typescript
import { bbscanPlugin } from "../plugins/bbscan/index.ts";
loader.register(bbscanPlugin);
```

---

## 最终验证

```bash
bun test tests/plugins/bbscan/
bun test tests/core/plugin-loader.test.ts
bunx eslint src/plugins/bbscan/
```

---

## 提交

```bash
git add .
git commit -m "feat: Phase 6 — BBScan 插件 (rule-parser + scanner + p-limit + Zod)"
git push
```

---

## 完成标志

- [ ] `tests/plugins/bbscan/rule-parser.test.ts` 全部通过
- [ ] `tests/plugins/bbscan/scanner.test.ts` 全部通过
- [ ] `tests/plugins/bbscan/index.test.ts` 全部通过
- [ ] 规则解析使用 Zod schema 验证
- [ ] 并发扫描使用 p-limit
- [ ] 路径变量替换（`{sub}`, `{hostname}`, `{hostname_or_folder}`）正确
- [ ] 使用 `Bun.Glob` + `Bun.file().text()` 读取规则文件
- [ ] 插件已注册到 `PluginLoader.withBuiltins()`
- [ ] lint 无错误
- [ ] 代码已提交并推送
- [ ] `docs/2026-04-01/sop/README.md` 中 Phase 6 状态已更新为 ✅
