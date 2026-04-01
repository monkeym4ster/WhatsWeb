# Phase 1：基础设施搭建

> **前置条件**：无
> **产出物**：可运行 `bun test`（空测试通过）和 `bunx eslint`（无报错）的项目骨架
> **预计涉及文件**：`package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, 目录骨架, 基础类型定义

---

## 步骤

### Step 1.1 — 初始化 Bun 项目

```bash
# 在项目根目录执行（保留已有 .git）
bun init -y
```

手动编辑生成的 `package.json`，确保包含以下内容：

```jsonc
{
  "name": "whatsweb",
  "version": "1.0.0",
  "type": "module",
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
    "typecheck": "bunx tsc --noEmit"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "picocolors": "^1.0.0",
    "cli-progress": "^3.12.0",
    "es-toolkit": "^1.0.0",
    "p-limit": "^7.0.0",
    "zod": "^3.24.0",
    "geoip-lite": "^1.4.0",
    "wappalyzer": "6.10.66"
  },
  "devDependencies": {
    "eslint": "^10.1.0",
    "@eslint/js": "^10.0.0",
    "typescript-eslint": "^8.58.0",
    "eslint-config-prettier": "^10.1.0",
    "prettier": "^3.8.0",
    "@types/bun": "latest",
    "@types/cli-progress": "^3.11.0",
    "@types/geoip-lite": "^1.4.4",
    "typescript": "^5.5.0"
  }
}
```

然后安装依赖：

```bash
bun install
```

### Step 1.2 — 配置 TypeScript

创建 `tsconfig.json`：

```jsonc
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 1.3 — 配置 ESLint + Prettier

创建 `eslint.config.mjs`（ESLint 9 flat config）：

```javascript
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "rules/"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  eslintConfigPrettier, // 必须放最后，禁用与 Prettier 冲突的规则
);
```

创建 `.prettierrc`：

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

创建 `.prettierignore`：

```
node_modules
dist
rules
bun.lock
```

### Step 1.4 — 创建目录骨架

```bash
mkdir -p src/core src/plugins/bbscan src/utils
mkdir -p tests/core tests/plugins/bbscan tests/utils
```

### Step 1.5 — 创建基础类型定义

创建 `src/plugins/types.ts`：

```typescript
export interface PluginContext {
  url: string;
  timeout: number;
  userAgent: string;
  response: HttpResponse;
}

export interface PluginMeta {
  name: string;
  description?: string;
}

export interface Plugin {
  meta: PluginMeta;
  execute(context: PluginContext): Promise<Record<string, unknown> | null>;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
  url: string;
}
```

创建 `src/index.ts`（库入口占位）：

```typescript
export { Scanner } from "./core/scanner.ts";
export type { Plugin, PluginContext, PluginMeta, HttpResponse } from "./plugins/types.ts";
```

> 注意：此时 `Scanner` 尚未实现，此文件在后续 Phase 才能真正使用。可以先注释掉 Scanner 导出或创建空文件占位。

创建 `src/cli.ts`（占位）：

```typescript
#!/usr/bin/env bun
console.log("whatsweb CLI — under construction");
```

### Step 1.6 — 创建验证用的空测试

创建 `tests/smoke.test.ts`：

```typescript
import { describe, test, expect } from "bun:test";

describe("项目骨架验证", () => {
  test("bun:test 框架可运行", () => {
    expect(1 + 1).toBe(2);
  });

  test("可导入类型定义", async () => {
    const types = await import("../src/plugins/types.ts");
    expect(types).toBeDefined();
  });
});
```

### Step 1.7 — 验证

```bash
bun test                              # 预期：2 个测试通过
bunx eslint src/                      # 预期：无错误
bunx prettier --check src/            # 预期：无格式问题
bunx tsc --noEmit                     # 预期：无类型错误
```

### Step 1.8 — 提交

```bash
git add .
git commit -m "chore: Phase 1 — 初始化 Bun 项目基础设施"
git push
```

---

## 完成标志

- [ ] `bun test` 通过
- [ ] `bunx eslint src/` 无错误
- [ ] `bunx prettier --check src/` 无格式问题
- [ ] 目录结构已按规划建立
- [ ] `src/plugins/types.ts` 包含核心接口定义
- [ ] 代码已提交并推送
- [ ] `docs/sop/README.md` 中 Phase 1 状态已更新为 ✅
