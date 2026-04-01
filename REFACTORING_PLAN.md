# WhatsWeb 重构计划：基于 Bun 的全面重构

> 本文档描述了将 WhatsWeb 从旧版 Node.js + CommonJS 项目，全面迁移至 **Bun 运行时 + TypeScript + ESM** 的重构方案。
>
> **可执行的 SOP（标准操作流程）已拆分至 [`docs/sop/`](./docs/sop/README.md)**，AI Agent 可直接按 Phase 顺序执行重构。

---

## 目录

1. [重构背景与目标](#1-重构背景与目标)
2. [技术选型](#2-技术选型)
3. [项目结构设计](#3-项目结构设计)
4. [模块重构详细方案](#4-模块重构详细方案)
   - 4.1 [入口与 CLI (`whatsweb.js` → `src/cli.ts`)](#41-入口与-cli)
   - 4.2 [核心引擎 (`index.js` → `src/core/scanner.ts`)](#42-核心引擎)
   - 4.3 [工具函数 (`utils.js` → `src/utils/`)](#43-工具函数)
   - 4.4 [插件系统 (`plugins/` → `src/plugins/`)](#44-插件系统)
   - 4.5 [BBScan 规则引擎](#45-bbscan-规则引擎)
5. [依赖替换方案](#5-依赖替换方案)
6. [类型系统设计](#6-类型系统设计)
7. [测试方案](#7-测试方案)
8. [构建与分发](#8-构建与分发)
9. [重构步骤与里程碑](#9-重构步骤与里程碑)
10. [风险与注意事项](#10-风险与注意事项)

---

## 1. 重构背景与目标

### 1.1 当前状况

WhatsWeb 是一个基于 Node.js 的网站指纹识别与安全扫描 CLI 工具，当前存在以下问题：

| 问题 | 说明 |
|------|------|
| **老旧的模块系统** | 使用 CommonJS (`require`/`module.exports`)，无法利用现代 ESM 的 tree-shaking 和静态分析优势 |
| **缺乏类型安全** | 纯 JavaScript，无 TypeScript 类型定义，插件接口全靠约定 |
| **过时的依赖** | `bluebird`（原生 Promise 已足够）、`superagent`（有更现代的替代）、`wappalyzer@5`（已弃用的旧版） |
| **无测试覆盖** | 没有任何自动化测试，无法保证重构后的正确性 |
| **插件系统过于简陋** | 依赖 `fs.readdir` 动态加载，没有类型约束、没有生命周期管理、没有错误隔离 |
| **无构建流程** | 没有 lint、format、CI/CD 配置 |

### 1.2 重构目标

- **运行时迁移**：从 Node.js 迁移到 Bun，充分利用 Bun 的原生 TypeScript 支持、内置测试框架、更快的启动速度和 HTTP 性能
- **语言升级**：全面使用 TypeScript，为插件系统和核心 API 提供严格的类型定义
- **模块现代化**：全面使用 ESM (`import`/`export`)
- **依赖精简**：利用 Bun 和现代 Web API 替换过时的第三方依赖
- **架构优化**：重新设计插件系统，引入更清晰的分层架构
- **质量保障**：引入完整的测试套件、lint 和格式化配置
- **功能保持**：确保重构后的功能与原版完全一致

---

## 2. 技术选型

| 类别 | 当前方案 | 重构方案 | 理由 |
|------|----------|----------|------|
| 运行时 | Node.js | **Bun** | 原生 TS 支持、内置测试、更快的性能 |
| 语言 | JavaScript (ES6) | **TypeScript 5.x** | 类型安全、更好的 IDE 支持 |
| 模块系统 | CommonJS | **ESM** | 现代标准、tree-shaking |
| HTTP 客户端 | superagent | **Bun 原生 fetch** | 零依赖、Web 标准 API |
| 工具函数库 | 无 | **es-toolkit** | 替代 lodash — 2-3x 更快、97% 更小、原生 TS、完美 tree-shaking |
| 并发管理 | bluebird | **p-limit@7** | 成熟（~100M 周下载）、ESM 原生、API 简洁 |
| 数据验证 | 无 | **zod** | CLI 参数验证、插件结果验证、运行时 schema + 类型推断 |
| CLI 框架 | commander@2 | **commander@12** | 成熟稳定、ESM 支持 |
| 终端着色 | chalk@2 | **picocolors** | 零依赖、极小体积 |
| 进度条 | progress | **cli-progress** | 更现代的进度条库 |
| 文件匹配 | globby@7 | **Bun.Glob (内置)** | Bun 内置的 Glob API，零依赖 |
| IP 处理 | ip@1 | **自定义实现** | ip 包存在已知安全漏洞 (CVE-2023-42282) |
| GeoIP | geoip-lite | **geoip-lite** (保留) | 无更优替代，且功能稳定 |
| 技术栈识别 | wappalyzer@5 | **wappalyzer@6.10.66** | 使用 puppeteer 内核，支持 init/open/analyze/destroy 生命周期 |
| 测试框架 | 无 | **Bun 内置测试 (`bun:test`)** | 零配置、原生支持 |
| Lint | 无 | **Biome** | 比 ESLint 更快、Bun 生态推荐 |

---

## 3. 项目结构设计

```
whatsweb/
├── src/
│   ├── cli.ts                    # CLI 入口
│   ├── index.ts                  # 库入口（对外导出）
│   ├── core/
│   │   ├── scanner.ts            # 核心扫描引擎（原 index.js 中的 WhatsWeb 类）
│   │   ├── plugin-loader.ts      # 插件加载器
│   │   └── reporter.ts           # 结果输出/报告格式化（原 whatsweb.js 中的 report 逻辑）
│   ├── plugins/
│   │   ├── types.ts              # 插件接口类型定义
│   │   ├── base-info.ts          # 基础信息插件
│   │   ├── email.ts              # 邮箱提取插件
│   │   ├── geoip.ts              # 地理位置插件
│   │   ├── wappalyzer.ts         # 技术栈识别插件
│   │   └── bbscan/
│   │       ├── index.ts          # BBScan 插件入口
│   │       ├── rule-parser.ts    # 规则解析器
│   │       └── scanner.ts        # 路径扫描器
│   └── utils/
│       ├── url.ts                # URL 规范化
│       ├── dns.ts                # DNS 解析
│       ├── ip.ts                 # IP/CIDR 处理
│       ├── http.ts               # HTTP 请求封装
│       └── concurrency.ts        # 并发控制工具
├── rules/                        # 规则文件（保持原样）
│   ├── *.txt
│   ├── white.list
│   └── black.list
├── tests/
│   ├── core/
│   │   ├── scanner.test.ts
│   │   └── plugin-loader.test.ts
│   ├── plugins/
│   │   ├── base-info.test.ts
│   │   ├── email.test.ts
│   │   ├── geoip.test.ts
│   │   └── bbscan/
│   │       └── rule-parser.test.ts
│   └── utils/
│       ├── url.test.ts
│       ├── ip.test.ts
│       └── concurrency.test.ts
├── package.json
├── tsconfig.json
├── biome.json                    # Biome lint/format 配置
├── bunfig.toml                   # Bun 配置
├── README.md
└── REFACTORING_PLAN.md           # 本文档
```

---

## 4. 模块重构详细方案

### 4.1 入口与 CLI

**原文件**: `whatsweb.js` (134 行)
**新文件**: `src/cli.ts`

#### 当前实现分析

- 使用 `commander@2` 解析 CLI 参数
- 手动从文件读取目标列表 (`fs.readFileSync`)
- 使用 `bluebird.Promise.map` 进行并发控制
- `report()` 函数直接内联了所有输出格式化逻辑
- 进度条使用 `progress` 库

#### 重构方案

```typescript
// src/cli.ts — 伪代码概要
import { Command } from "commander";
import { Scanner } from "./core/scanner";
import { Reporter } from "./core/reporter";
import { expandCIDR } from "./utils/ip";
import { version } from "../package.json";

const program = new Command()
  .name("whatsweb")
  .version(version)
  .description("网站指纹识别与安全扫描工具")
  .argument("[urls...]", "目标 URL 列表")
  .option("-f <file>", "从文件读取目标列表")
  .option("-c, --concurrency <num>", "并发数", parseInt, 50)
  .option("--network <mask>", "扫描 Target/MASK 网段内所有主机")
  .option("--timeout <ms>", "请求超时时间 (毫秒)", parseInt, 10000)
  .option("--user-agent <string>", "自定义 User-Agent")
  .option("-o, --output <path>", "输出文件路径")
  .option("--show-error", "显示错误信息")
  .action(async (urls, options) => {
    // 1. 构建目标列表（文件 + 参数 + CIDR 展开 + 去重）
    // 2. 创建 Scanner 和 Reporter 实例
    // 3. 并发扫描并报告结果
  });
```

**关键变更点**:

1. 将 `report()` 逻辑抽取到独立的 `Reporter` 类
2. 用自定义并发控制替代 `bluebird.Promise.map`
3. 文件读取使用 `Bun.file().text()` 替代 `fs.readFileSync`
4. 输出文件写入使用 `Bun.write()` 替代 `fs.appendFileSync`

### 4.2 核心引擎

**原文件**: `index.js` (54 行)
**新文件**: `src/core/scanner.ts`

#### 当前实现分析

- `WhatsWeb` 类通过 `fs.readdir` 动态发现并 `require()` 加载 `plugins/` 目录下的所有 `.js` 文件
- 使用 `superagent` 发送初始 GET 请求
- 按顺序执行所有插件，收集非空结果
- 错误处理：catch 所有异常并返回 error 对象（而非 throw）

#### 重构方案

```typescript
// src/core/scanner.ts — 伪代码概要
export class Scanner {
  private url: string;
  private timeout: number;
  private userAgent: string;
  private plugins: Plugin[];

  constructor(options: ScannerOptions) { /* ... */ }

  async analyse(): Promise<ScanResult[]> {
    const response = await this.fetchTarget();
    const context: PluginContext = { url: this.url, timeout: this.timeout, userAgent: this.userAgent, response };
    const results: ScanResult[] = [];
    for (const plugin of this.plugins) {
      try {
        const result = await plugin.execute(context);
        if (result && Object.keys(result).length > 0) {
          results.push({ name: plugin.name, result });
        }
      } catch {
        // 单个插件失败不影响其他插件
      }
    }
    return results;
  }
}
```

**关键变更点**:

1. 使用原生 `fetch` 替代 `superagent`，需要封装一层以处理重定向跟踪、响应体文本提取等
2. 插件加载从 `readdir + require` 改为显式注册（内置插件）+ 可选的动态导入（外部插件）
3. 增加单个插件的错误隔离（try/catch 包裹每个插件执行）
4. 方法返回类型化的 `ScanResult[]` 而非裸的 array/error 混合类型

### 4.3 工具函数

**原文件**: `utils.js` (39 行)
**新文件**: `src/utils/url.ts`, `src/utils/dns.ts`, `src/utils/ip.ts`, `src/utils/http.ts`, `src/utils/concurrency.ts`

#### 4.3.1 URL 工具 (`src/utils/url.ts`)

```typescript
// 替代原 normalUrl，使用标准 URL API 增强验证
export function normalizeUrl(input: string): string {
  if (!input) throw new Error(`Invalid url: ${input}`);
  const withProtocol = /^https?:\/\//i.test(input) ? input : `http://${input}`;
  new URL(withProtocol); // 验证合法性
  return withProtocol;
}
```

#### 4.3.2 DNS 工具 (`src/utils/dns.ts`)

```typescript
// 替代原 resolve4，使用 Bun 兼容的 dns 模块
import { resolve4 as dnsResolve4 } from "node:dns/promises";
import { isIPv4 } from "node:net";

export async function resolve4(domain: string): Promise<string> {
  if (isIPv4(domain)) return domain;
  const addresses = await dnsResolve4(domain);
  if (!addresses.length) throw new Error("DNS resolve failed");
  return addresses[0];
}
```

#### 4.3.3 IP/CIDR 工具 (`src/utils/ip.ts`)

替换 `ip` 包（存在已知安全漏洞），自行实现或使用更安全的 `ipaddr.js`：

```typescript
export function* expandCIDR(cidr: string): Generator<string> {
  // 解析 CIDR 表示法，生成范围内的所有 IP
  // 使用生成器避免一次性占用大量内存
}
```

**关键改进**: 使用 `Generator` 而非预分配数组，避免 `/16` 等大网段导致内存问题。

#### 4.3.4 HTTP 封装 (`src/utils/http.ts`)

```typescript
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
  url: string; // 最终 URL（经过重定向后）
}

export async function httpGet(url: string, options: RequestOptions): Promise<HttpResponse> {
  // 基于原生 fetch 封装，处理超时、UA、重定向跟踪
}

export async function httpHead(url: string, options: RequestOptions): Promise<HttpResponse> {
  // HEAD 请求封装，用于 BBScan
}
```

#### 4.3.5 并发控制 (`src/utils/concurrency.ts`)

替代 `bluebird.Promise.map`：

```typescript
export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  // 基于信号量的并发控制池
}
```

### 4.4 插件系统

**原文件**: `plugins/*.js` (5 个插件)
**新文件**: `src/plugins/types.ts` + `src/plugins/*.ts`

#### 当前实现分析

当前插件系统非常简陋：
- 约定 `exports.register` 为 async 函数
- 约定 `exports.register.attributes.name` 为插件名
- 传入参数为 `{ url, timeout, userAgent, response }`
- 无类型约束、无生命周期、无错误隔离

#### 重构方案：类型化插件接口

```typescript
// src/plugins/types.ts

export interface PluginContext {
  url: string;
  timeout: number;
  userAgent: string;
  response: HttpResponse;
}

export interface PluginMeta {
  name: string;
  description?: string;
  version?: string;
}

export interface Plugin {
  meta: PluginMeta;
  execute(context: PluginContext): Promise<Record<string, unknown> | null>;
}

export type PluginFactory = () => Plugin;
```

#### 各插件重构要点

**base-info.ts** (原 `plugins/base-info.js`)
- 状态码、标题、重定向、x-* 响应头提取
- 改用标准 `Response` API 替代 `response.res` 的 Node.js 特有结构
- 标题提取正则 `/<title>([^<]+)<\/title>/i` 保持不变

**email.ts** (原 `plugins/email.js`)
- 邮箱正则 `/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}/gi` 保持不变
- 保持 "至少 2 个唯一匹配才返回" 的逻辑

**geoip.ts** (原 `plugins/geoip.js`)
- `geoip-lite` 依赖保留
- 使用新的 `dns.ts` 工具替代原 `utils.resolve4`
- 使用 `new URL()` 替代 `Url.parse()`

**wappalyzer.ts** (原 `plugins/wappalyzer.js`)
- 需评估 wappalyzer 新版本的 API 变化
- 如果新版不兼容，考虑使用 `wappalyzer-core` 或其他替代方案（如 `webanalyze`）
- 保持按 category 分组的输出格式

**bbscan/** (原 `plugins/bbscan.js`)
- 拆分为三个文件：`index.ts`（插件入口）、`rule-parser.ts`（规则解析）、`scanner.ts`（扫描逻辑）
- `rule-parser.ts` 专注解析 `rules/*.txt`、`white.list`、`black.list`
- `scanner.ts` 处理 404 检测、路径探测、结果过滤
- 使用 `Bun.Glob` 替代 `globby` 来匹配规则文件
- 使用原生 `fetch` 替代 `superagent.head`
- 并发控制从 `bluebird.Promise.map` 改为自定义并发池

### 4.5 BBScan 规则引擎

**原文件**: `rules/` 目录 (12 个 .txt 文件 + white.list + black.list)

#### 保持不变

规则文件（`rules/*.txt`、`white.list`、`black.list`）**完全保留原样**，不做任何修改。这些是数据文件而非代码，向后兼容。

#### 规则解析器重构

将 `bbscan.js` 中的规则解析逻辑提取为独立模块 `rule-parser.ts`：

```typescript
// src/plugins/bbscan/rule-parser.ts

export interface ScanRule {
  uri: string;
  tag: string;
  status: number | null;
  contentType: string;
  contentTypeNo: string;
  rootOnly: boolean;
}

export interface ListRule {
  texts: string[];
  regexes: RegExp[];
}

export async function parseRuleFiles(rulesDir: string): Promise<ScanRule[]> { /* ... */ }
export async function parseWhiteList(filePath: string): Promise<ListRule> { /* ... */ }
export async function parseBlackList(filePath: string): Promise<ListRule> { /* ... */ }
```

---

## 5. 依赖替换方案

| 原依赖 | 状态 | 替换方案 | 说明 |
|--------|------|----------|------|
| `bluebird@^3.5.1` | **移除** | **p-limit@7** | 成熟的并发控制（~100M 周下载）、ESM 原生 |
| `superagent@^3.8.2` | **移除** | 原生 `fetch` + `src/utils/http.ts` | Bun 内置高性能 fetch |
| `chalk@^2.3.0` | **替换** | **picocolors** | 零依赖、极小体积 |
| `commander@^2.13.0` | **升级** | **commander@12** | 成熟稳定、ESM 支持 |
| `progress@^2.0.0` | **替换** | **cli-progress** | 更现代的进度条库 |
| `globby@^7.1.1` | **移除** | **Bun.Glob** (内置) | 零依赖 |
| `ip@^1.1.5` | **移除** | 自定义实现 (`src/utils/ip.ts`) | ip 包存在 SSRF 安全漏洞 (CVE-2023-42282) |
| `geoip-lite@^1.2.1` | **保留** | **geoip-lite** (最新版) | 无更优替代 |
| `wappalyzer@^5.2.2` | **升级** | **wappalyzer@6.10.66** | 最后功能版本，API: init/open/analyze/destroy |

### 新增依赖

| 依赖 | 用途 |
|------|------|
| **es-toolkit** | 通用工具函数 — 替代 lodash，2-3x 更快、97% 更小、原生 TS |
| **p-limit@7** | 并发控制 — 替代 bluebird.Promise.map |
| **zod** | 运行时数据验证 + TypeScript 类型推断（CLI 参数、插件 meta、规则文件等） |
| `picocolors` | 终端文本着色（零依赖、高性能） |
| `commander@12` | CLI 参数解析 |
| `cli-progress` | 终端进度条 |

### 新增开发依赖

| 依赖 | 用途 |
|------|------|
| `typescript` | TypeScript 编译器（Bun 内置 TS 执行，但需要 tsc 做类型检查） |
| `@biomejs/biome` | Lint + Format |
| `@types/bun` | Bun 类型定义 |
| `@types/cli-progress` | cli-progress 类型定义 |
| `@types/geoip-lite` | geoip-lite 类型定义 |

---

## 6. 类型系统设计

### 6.1 核心类型

```typescript
// src/types.ts

/** 扫描器选项 */
export interface ScannerOptions {
  target: string;
  timeout?: number;
  userAgent?: string;
  plugins?: Plugin[];
}

/** 单个插件的扫描结果 */
export interface ScanResult {
  name: string;
  result: Record<string, unknown>;
}

/** 扫描报告（成功时） */
export interface ScanReport {
  target: string;
  plugins: ScanResult[];
}

/** 扫描报告（失败时） */
export interface ScanError {
  target: string;
  error: string;
}

/** CLI 选项 */
export interface CliOptions {
  concurrency: number;
  network?: string;
  timeout: number;
  userAgent: string;
  output?: string;
  showError: boolean;
  file?: string;
}
```

### 6.2 插件类型

见 [4.4 插件系统](#44-插件系统) 中的 `Plugin`、`PluginContext`、`PluginMeta` 定义。

### 6.3 HTTP 类型

见 [4.3.4 HTTP 封装](#434-http-封装-srcutilshttpts) 中的 `HttpResponse`、`RequestOptions` 定义。

---

## 7. 测试方案

使用 **Bun 内置测试框架** (`bun:test`)，无需额外安装测试运行器。

### 7.1 单元测试

| 测试文件 | 覆盖模块 | 测试内容 |
|----------|----------|----------|
| `tests/utils/url.test.ts` | `src/utils/url.ts` | URL 规范化：无协议补全、已有协议保持、空值抛错、特殊字符处理 |
| `tests/utils/ip.test.ts` | `src/utils/ip.ts` | CIDR 展开：/24 → 254 个地址、/32 → 1 个地址、边界值、非法输入 |
| `tests/utils/concurrency.test.ts` | `src/utils/concurrency.ts` | 并发池：并发上限、错误传播、空列表、单项列表 |
| `tests/plugins/base-info.test.ts` | `src/plugins/base-info.ts` | 标题提取、状态码、重定向检测、x-* 头过滤 |
| `tests/plugins/email.test.ts` | `src/plugins/email.ts` | 邮箱正则匹配、去重、不足 2 个时返回空 |
| `tests/plugins/bbscan/rule-parser.test.ts` | `src/plugins/bbscan/rule-parser.ts` | 规则文件解析、白名单/黑名单解析、注释行跳过、各字段提取 |
| `tests/core/scanner.test.ts` | `src/core/scanner.ts` | mock HTTP + mock 插件测试完整扫描流程 |
| `tests/core/plugin-loader.test.ts` | `src/core/plugin-loader.ts` | 插件发现、加载、注册验证 |

### 7.2 集成测试

```typescript
// tests/integration/scan.test.ts
// 使用 Bun 的内置 HTTP server 创建 mock 服务器进行端到端测试
import { describe, test, expect } from "bun:test";

describe("完整扫描流程", () => {
  test("应正确识别基础信息", async () => {
    // 启动 mock HTTP server（Bun.serve）
    // 运行 Scanner
    // 验证输出包含 status、title 等
  });
});
```

### 7.3 测试命令

```bash
bun test                    # 运行所有测试
bun test --watch            # 监视模式
bun test tests/utils/       # 运行指定目录
bun test --coverage         # 覆盖率报告
```

---

## 8. 构建与分发

### 8.1 package.json 配置

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
    "lint": "biome check src/",
    "lint:fix": "biome check --write src/",
    "format": "biome format --write src/",
    "typecheck": "tsc --noEmit",
    "build": "bun build src/cli.ts --outdir dist --target node",
    "prepublishOnly": "bun run typecheck && bun run lint && bun run test"
  }
}
```

### 8.2 tsconfig.json

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
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 8.3 分发方式

1. **Bun 用户**: 直接 `bun install -g whatsweb` 运行 TypeScript 源码
2. **Node.js 兼容**: 通过 `bun build` 编译为单文件 JavaScript，兼容 Node.js 用户
3. **可选编译为可执行文件**: `bun build --compile src/cli.ts --outfile whatsweb` 生成无需运行时的独立二进制

---

## 9. 重构步骤与里程碑

> **详细的可执行 SOP 已拆分至 [`docs/sop/`](./docs/sop/README.md)**，以下为概要索引。

| Phase | SOP | 说明 | 状态 |
|-------|-----|------|------|
| 1 | [phase-01-infrastructure.md](./docs/sop/phase-01-infrastructure.md) | 基础设施：Bun 初始化、TS/Biome 配置、目录骨架、基础类型 | ⬜ |
| 2 | [phase-02-utils.md](./docs/sop/phase-02-utils.md) | 工具层 TDD：url、dns、ip、http + p-limit 封装 + Zod schema | ⬜ |
| 3 | [phase-03-plugin-system.md](./docs/sop/phase-03-plugin-system.md) | 插件系统：类型定义（Zod）、PluginLoader | ⬜ |
| 4 | [phase-04-basic-plugins.md](./docs/sop/phase-04-basic-plugins.md) | 基础插件 TDD：base-info、email、geoip + es-toolkit | ⬜ |
| 5 | [phase-05-wappalyzer.md](./docs/sop/phase-05-wappalyzer.md) | Wappalyzer 插件：wappalyzer@6.10.66 集成 | ⬜ |
| 6 | [phase-06-bbscan.md](./docs/sop/phase-06-bbscan.md) | BBScan 插件：规则解析器（Zod）+ 路径扫描器（p-limit） | ⬜ |
| 7 | [phase-07-scanner.md](./docs/sop/phase-07-scanner.md) | 核心引擎：Scanner 类、Zod 参数验证 | ⬜ |
| 8 | [phase-08-cli.md](./docs/sop/phase-08-cli.md) | CLI + Reporter：commander/picocolors/cli-progress/p-limit | ⬜ |
| 9 | [phase-09-integration.md](./docs/sop/phase-09-integration.md) | 集成测试、旧文件清理、README 更新 | ⬜ |

---

## 10. 风险与注意事项

### 10.1 Wappalyzer 兼容性

**风险**: `wappalyzer@6.10.66` 依赖 `puppeteer@~19.7.0`，需要 Chromium 运行环境。

**应对**:
- 已确定使用 `wappalyzer@6.10.66`（v6 最后功能版本），API 为 `init → open → analyze → destroy`
- v6 结果结构使用 `technologies[]`（不是 v5 的 `applications[]`），需注意字段差异
- CI/部署环境需安装 Chromium 系统依赖（libX11、libatk 等），或使用 `--no-sandbox` 参数
- 插件实现需确保 `finally` 块中调用 `wappalyzer.destroy()` 清理浏览器进程

### 10.2 Bun 的 Node.js 兼容性

**风险**: `geoip-lite` 等依赖可能使用 Node.js 特有的 API（如 `Buffer`、`fs` 原生绑定），在 Bun 中行为不一致。

**应对**:
- Bun 对 Node.js API 的兼容性已经很高，大部分包可直接使用
- 在里程碑 2 完成后尽早运行依赖兼容性测试
- 如有问题，考虑 polyfill 或替换依赖

### 10.3 fetch 与 superagent 行为差异

**风险**: 原代码大量依赖 `superagent` 的特定行为（如 `.ok(() => true)` 允许非 2xx 状态码、`response.res` 内部结构等）。

**应对**:
- 在 `src/utils/http.ts` 中封装一层，模拟原有行为
- `fetch` 默认不抛异常（非 2xx 不 throw），这一点与 `.ok(() => true)` 行为一致
- 需要注意 `fetch` 的重定向处理方式（默认 follow），需与原行为对齐

### 10.4 BBScan HEAD 请求行为

**风险**: 原 `bbscan.js` 使用 `superagent.head()` 但又检查 `response.res.text`，而 HEAD 请求通常不返回 body。

**应对**:
- 这可能是原代码的 bug（HEAD 请求不应有 body）
- 重构时需明确：哪些规则需要检查 body 内容（应改为 GET），哪些仅需状态码/头信息（可保持 HEAD）
- 建议：对含有 `{tag=...}` 的规则使用 GET 请求，其他使用 HEAD 请求

### 10.5 规则文件路径解析

**风险**: 原代码使用 `__dirname` 相对路径解析 `rules/` 目录。ESM 中 `__dirname` 不可用。

**应对**:
- 使用 `import.meta.dir`（Bun 原生支持）或 `import.meta.url` + `fileURLToPath`
- 在代码中封装为常量：`const RULES_DIR = path.join(import.meta.dir, "../../rules")`

### 10.6 向后兼容性

重构后的 CLI 应确保以下兼容性：
- 所有原有命令行选项 (`-f`, `-c`, `--network`, `--timeout`, `--user-agent`, `-o`, `--show-error`) 保持一致
- 输出格式（JSON lines 文件输出、控制台彩色输出）与原版行为一致
- 规则文件格式完全不变

---

*文档版本: 1.0 | 最后更新: 2026-04-01*
