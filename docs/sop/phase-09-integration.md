# Phase 9：集成测试、清理与发布

> **前置条件**：Phase 8 已完成（所有模块就绪）
> **产出物**：集成测试通过、旧文件清理、README 更新、可发布状态

---

## Step 9.1 — 端到端集成测试

### 9.1.1 编写集成测试 `tests/integration/e2e.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Scanner } from "../../src/core/scanner.ts";
import { existsSync, unlinkSync } from "node:fs";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/") {
        return new Response(
          `<html>
            <head><title>Integration Test Site</title></head>
            <body>
              Contact: admin@test.com, support@test.com
              <script src="jquery.min.js"></script>
            </body>
          </html>`,
          {
            headers: {
              "content-type": "text/html",
              "x-powered-by": "Express",
              "x-request-id": "test-123",
            },
          },
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

describe("端到端集成测试", () => {
  test("完整扫描流程 — Scanner + 内置插件", async () => {
    const scanner = new Scanner({
      target: baseUrl,
      timeout: 10000,
      userAgent: "WhatsWeb-Integration-Test",
    });

    const results = await scanner.analyse();

    // 应成功返回数组
    expect(Array.isArray(results)).toBe(true);
    if (!Array.isArray(results)) return;

    // Base Information 应存在
    const baseInfo = results.find((r) => r.name === "Base Information");
    expect(baseInfo).toBeDefined();
    expect(baseInfo?.result.status).toContain("200");
    expect(baseInfo?.result.title).toBe("Integration Test Site");
    expect(baseInfo?.result["x-powered-by"]).toBe("Express");
    expect(baseInfo?.result["x-request-id"]).toBe("test-123");

    // Email 应存在
    const email = results.find((r) => r.name === "Email");
    expect(email).toBeDefined();
    expect(email?.result.email).toEqual(
      expect.arrayContaining(["admin@test.com", "support@test.com"]),
    );

    // Geolocation — 本地地址可能无 geo 数据，但 ip 应存在
    const geo = results.find((r) => r.name === "Geolocation");
    expect(geo).toBeDefined();
    expect(geo?.result.ip).toBeDefined();
  }, 30000);
});

describe("CLI 端到端", () => {
  test("扫描真实 URL 并输出到文件", async () => {
    const tmpFile = `/tmp/whatsweb-e2e-${Date.now()}.jsonl`;

    const proc = Bun.spawn(
      ["bun", "run", "src/cli.ts", baseUrl, "-o", tmpFile, "--timeout", "10000"],
      { stdout: "pipe", stderr: "pipe" },
    );

    await proc.exited;

    // 检查输出文件
    if (existsSync(tmpFile)) {
      const content = await Bun.file(tmpFile).text();
      expect(content.trim().length).toBeGreaterThan(0);
      const line = JSON.parse(content.trim().split("\n")[0]);
      expect(line.target).toBe(baseUrl);
      expect(line.plugins).toBeInstanceOf(Array);
      unlinkSync(tmpFile);
    }
  }, 60000);
});
```

### 9.1.2 运行全部测试

```bash
bun test
```

确保所有模块的测试全部通过。

---

## Step 9.2 — 全面 Lint 检查

```bash
bunx eslint src/ tests/
bunx prettier --check src/ tests/
bunx tsc --noEmit
```

修复所有 lint 错误、格式问题和类型错误。

---

## Step 9.3 — 清理旧文件

确认所有新代码可运行后，删除原始的 CJS 源文件：

```bash
# 旧的入口文件
git rm index.js
git rm whatsweb.js
git rm utils.js

# 旧的插件目录
git rm -r plugins/

# 保留 rules/ 目录（数据文件不变）
```

> **重要**：`rules/` 目录**不删除**，保持原样。

---

## Step 9.4 — 更新 `.gitignore`

```gitignore
node_modules/
dist/
.DS_Store
.vscode/
*.log
```

---

## Step 9.5 — 更新 README.md

用中英双语更新 README，保持原有使用方式兼容：

```markdown
# WhatsWeb

网站指纹识别与安全扫描工具。 / Identifies websites.

## Installation

```bash
# 使用 Bun (推荐)
bun install -g whatsweb

# 使用 npm
npm install -g whatsweb
```

## Usage

```bash
whatsweb [options] URLs
```

### Options

```
-V, --version            输出版本号
-f <file>                从文件读取目标列表
-c, --concurrency <num>  并发数 (默认: 50)
--network <mask>          扫描 Target/MASK 网段内所有主机
--timeout <ms>            请求超时毫秒数 (默认: 10000)
--user-agent <string>    自定义 User-Agent
-o, --output <path>      输出文件路径 (JSONL 格式)
--show-error             显示错误信息
-h, --help               显示帮助
```

### Example

```bash
# 扫描单个目标
whatsweb http://example.com

# 扫描多个目标
whatsweb http://a.com http://b.com http://c.com

# 从文件读取 + 并发 20 + 输出到文件
whatsweb -f targets.txt -c 20 -o results.jsonl

# 扫描整个 /24 网段
whatsweb http://192.168.1.1 --network 24
```

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **HTTP**: Bun native fetch
- **Utilities**: es-toolkit, p-limit, zod
- **Fingerprinting**: wappalyzer@6.10.66
- **GeoIP**: geoip-lite

## Architecture

插件化架构：核心引擎 + 可扩展的插件系统。

内置插件：
- **Base Information** — HTTP 状态、标题、重定向、x-* 头
- **Email** — HTML 中的邮箱地址提取
- **Geolocation** — IP 地理位置
- **Wappalyzer** — 技术栈识别
- **BBScan** — 敏感路径扫描

## Development

```bash
bun install          # 安装依赖
bun test             # 运行测试
bun run lint         # Lint 检查
bun run dev          # 开发运行
```

## License

MIT
```

---

## Step 9.6 — 更新 package.json 最终版

确认 `package.json` 的最终状态：

```jsonc
{
  "name": "whatsweb",
  "version": "1.0.0",
  "type": "module",
  "description": "网站指纹识别与安全扫描工具 / Identifies websites",
  "main": "src/index.ts",
  "bin": {
    "whatsweb": "src/cli.ts"
  },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "test": "bun test",
    "lint": "bunx eslint src/ tests/",
    "lint:fix": "bunx eslint src/ tests/ --fix",
    "format": "bunx prettier --write src/ tests/",
    "format:check": "bunx prettier --check src/ tests/",
    "typecheck": "bunx tsc --noEmit",
    "build": "bun build src/cli.ts --outdir dist --target node",
    "prepublishOnly": "bun run typecheck && bun run lint && bun run test"
  },
  "dependencies": {
    "cli-progress": "^3.12.0",
    "commander": "^12.0.0",
    "es-toolkit": "^1.0.0",
    "geoip-lite": "^1.4.0",
    "p-limit": "^7.0.0",
    "picocolors": "^1.0.0",
    "wappalyzer": "6.10.66",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "@types/bun": "latest",
    "@types/cli-progress": "^3.11.0",
    "@types/geoip-lite": "^1.4.4",
    "eslint": "^10.1.0",
    "eslint-config-prettier": "^10.1.0",
    "prettier": "^3.8.0",
    "typescript": "^5.5.0",
    "typescript-eslint": "^8.58.0"
  },
  "author": "M4ster <GeniusM4ster@gmail.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/monkeym4ster/WhatsWeb.git"
  },
  "license": "MIT",
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

---

## Step 9.7 — 更新 SOP 进度

更新 `docs/sop/README.md` 中所有 Phase 的状态为 ✅。

---

## Step 9.8 — 最终验证清单

```bash
# 1. 全部测试通过
bun test

# 2. lint 无错误
bunx eslint src/ tests/

# 2.5 格式一致
bunx prettier --check src/ tests/

# 3. 类型检查通过
bunx tsc --noEmit

# 4. CLI 可运行
bun run src/cli.ts --help
bun run src/cli.ts --version

# 5. 旧文件已删除
ls index.js 2>/dev/null && echo "ERROR: old file exists" || echo "OK: cleaned"
ls whatsweb.js 2>/dev/null && echo "ERROR: old file exists" || echo "OK: cleaned"
ls utils.js 2>/dev/null && echo "ERROR: old file exists" || echo "OK: cleaned"
ls plugins/ 2>/dev/null && echo "ERROR: old dir exists" || echo "OK: cleaned"

# 6. rules/ 目录完好
ls rules/*.txt | wc -l  # 应大于 0
```

---

## 提交

```bash
git add .
git commit -m "feat: Phase 9 — 集成测试、清理旧文件、更新文档"
git push
```

---

## 完成标志

- [ ] `tests/integration/e2e.test.ts` 全部通过
- [ ] `bun test` 全部测试通过（所有 Phase 的测试）
- [ ] `bunx eslint src/ tests/` 无错误
- [ ] `bunx prettier --check src/ tests/` 格式一致
- [ ] `bunx tsc --noEmit` 无类型错误
- [ ] 旧文件（`index.js`, `whatsweb.js`, `utils.js`, `plugins/`）已删除
- [ ] `rules/` 目录完好
- [ ] `README.md` 已更新
- [ ] `package.json` 已更新为最终版
- [ ] `.gitignore` 已更新
- [ ] `docs/sop/README.md` 中所有 Phase 状态已更新为 ✅
- [ ] 代码已提交并推送
