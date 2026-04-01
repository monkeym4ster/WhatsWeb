# WhatsWeb Bun 重构 — SOP 总览

> 本目录包含将 WhatsWeb 从 Node.js + CommonJS 全面迁移至 **Bun + TypeScript + ESM** 的标准操作流程 (SOP)。
> 每个 Phase 是一个**独立可执行的任务单元**，AI Agent 可直接按顺序执行。

---

## 执行原则

1. **测试驱动 (TDD)**：每个模块的开发顺序为 ① 写类型/接口 → ② 写测试 → ③ 写实现 → ④ 测试通过
2. **渐进式交付**：每个 Phase 完成后提交代码、运行测试、更新本文档进度
3. **向后兼容**：`rules/` 目录的数据文件不做任何修改
4. **单一职责**：每个 SOP 文件对应一个可独立完成和验证的功能区块

---

## 技术栈

| 类别 | 选型 | 说明 |
|------|------|------|
| 运行时 | Bun | 原生 TS、内置测试、高性能 |
| 语言 | TypeScript (strict mode) | 全面类型安全 |
| 模块系统 | ESM (`import`/`export`) | 现代标准 |
| HTTP 客户端 | Bun 原生 `fetch` | 零依赖、Web 标准 |
| CLI 框架 | commander@12 | 成熟稳定、ESM 支持 |
| 终端着色 | picocolors | 零依赖、极小体积 |
| 进度条 | cli-progress | 现代终端进度条 |
| 文件匹配 | Bun.Glob (内置) | 零依赖 |
| 工具函数库 | **es-toolkit** | 替代 lodash — 2-3x 更快、97% 更小、原生 TS |
| 并发管理 | **p-limit@7** | 成熟的并发控制、~100M 周下载、ESM 原生 |
| 数据验证 | **zod** | 运行时 schema 验证 + 类型推断 |
| IP/DNS | 自定义实现 | 替换有漏洞的 ip 包 |
| GeoIP | geoip-lite | 保留，无更优替代 |
| 技术栈识别 | **wappalyzer@6.10.66** | 依赖 puppeteer@~19.7.0 |
| 测试 | bun:test (内置) | 零配置 |
| Lint/Format | Biome | 比 ESLint 更快 |

---

## Phase 进度

| Phase | SOP 文件 | 说明 | 状态 |
|-------|----------|------|------|
| 1 | [phase-01-infrastructure.md](./phase-01-infrastructure.md) | 基础设施搭建：初始化 Bun 项目、配置 TS/Biome、建目录骨架 | ✅ 已完成 (2026-04-01) |
| 2 | [phase-02-utils.md](./phase-02-utils.md) | 工具层 TDD：url、dns、ip、http 四个工具模块 + p-limit 封装 | ✅ 已完成 (2026-04-01) |
| 3 | [phase-03-plugin-system.md](./phase-03-plugin-system.md) | 插件系统：类型定义、插件加载器 | ✅ 已完成 (2026-04-01) |
| 4 | [phase-04-basic-plugins.md](./phase-04-basic-plugins.md) | 基础插件 TDD：base-info、email、geoip 三个插件 | ✅ 已完成 (2026-04-01) |
| 5 | [phase-05-wappalyzer.md](./phase-05-wappalyzer.md) | Wappalyzer 插件：基于 wappalyzer@6.10.66 的技术栈识别 | ✅ 已完成 (2026-04-01) |
| 6 | [phase-06-bbscan.md](./phase-06-bbscan.md) | BBScan 插件：规则解析器 + 路径扫描器 | ✅ 已完成 (2026-04-01) |
| 7 | [phase-07-scanner.md](./phase-07-scanner.md) | 核心引擎：Scanner 类（调度插件、聚合结果） | ✅ 已完成 (2026-04-01) |
| 8 | [phase-08-cli.md](./phase-08-cli.md) | CLI 与 Reporter：命令行入口、结果格式化与输出 | ✅ 已完成 (2026-04-01) |
| 9 | [phase-09-integration.md](./phase-09-integration.md) | 集成测试、旧文件清理、README 更新、发布 | ✅ 已完成 (2026-04-01) |

---

## 目标目录结构

```
whatsweb/
├── src/
│   ├── cli.ts
│   ├── index.ts
│   ├── core/
│   │   ├── scanner.ts
│   │   ├── plugin-loader.ts
│   │   └── reporter.ts
│   ├── plugins/
│   │   ├── types.ts
│   │   ├── base-info.ts
│   │   ├── email.ts
│   │   ├── geoip.ts
│   │   ├── wappalyzer.ts
│   │   └── bbscan/
│   │       ├── index.ts
│   │       ├── rule-parser.ts
│   │       └── scanner.ts
│   ├── schemas/
│   │   └── cli.ts               # Zod CLI 参数 schema
│   └── utils/
│       ├── url.ts
│       ├── dns.ts
│       ├── ip.ts
│       └── http.ts
├── rules/                  # 保持原样不动
├── tests/
│   ├── utils/
│   ├── plugins/
│   └── core/
├── docs/sop/               # 本 SOP 文档
├── package.json
├── tsconfig.json
├── biome.json
└── bunfig.toml
```

---

## 进度更新规范

每个 Phase 完成后，执行 Agent 必须：

1. 运行 `bun test` 确认所有测试通过
2. 运行 `bunx biome check src/` 确认无 lint 错误
3. 将上方表格中对应 Phase 的状态从 `⬜ 未开始` 更新为 `✅ 已完成`
4. 在表格状态列追加完成时间，格式：`✅ 已完成 (YYYY-MM-DD)`
5. `git add . && git commit && git push`
