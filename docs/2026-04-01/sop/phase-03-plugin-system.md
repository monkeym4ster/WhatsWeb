# Phase 3：插件系统 — 类型定义与加载器

> **前置条件**：Phase 2 已完成（`src/utils/http.ts` 中的 `HttpResponse` 类型可用）
> **产出物**：`src/plugins/types.ts` 完善版 + `src/core/plugin-loader.ts` + 对应测试
> **TDD 顺序**：类型定义 → Zod schema → 加载器测试 → 加载器实现

---

## Step 3.1 — 完善插件类型定义 (`src/plugins/types.ts`)

此文件在 Phase 1 已创建骨架。现在需要完善，整合 Zod 验证和 `HttpResponse` re-export。

```typescript
// src/plugins/types.ts

import { z } from "zod";
import type { HttpResponse } from "../utils/http.ts";

// 从 http 工具模块 re-export，保持类型来源唯一
export type { HttpResponse } from "../utils/http.ts";

/** 传递给每个插件的上下文对象 */
export interface PluginContext {
  url: string;
  timeout: number;
  userAgent: string;
  response: HttpResponse;
}

/** 插件元信息 */
export interface PluginMeta {
  name: string;
  description?: string;
}

/** 插件接口 — 所有插件必须实现此接口 */
export interface Plugin {
  meta: PluginMeta;
  execute(context: PluginContext): Promise<Record<string, unknown> | null>;
}

/** Zod schema：验证插件元信息 */
export const pluginMetaSchema = z.object({
  name: z.string().min(1, "插件名称不能为空"),
  description: z.string().optional(),
});

/** Zod schema：验证插件结果（非空的键值对象） */
export const pluginResultSchema = z.record(z.string(), z.unknown()).nullable();
```

---

## Step 3.2 — 插件加载器测试 (`tests/core/plugin-loader.test.ts`)

```typescript
import { describe, test, expect } from "bun:test";
import { PluginLoader } from "../../src/core/plugin-loader.ts";
import type { Plugin, PluginContext } from "../../src/plugins/types.ts";

const createMockPlugin = (name: string, result: Record<string, unknown> | null): Plugin => ({
  meta: { name },
  execute: async (_ctx: PluginContext) => result,
});

describe("PluginLoader", () => {
  test("注册并获取所有插件", () => {
    const loader = new PluginLoader();
    const p1 = createMockPlugin("plugin-a", { key: "value" });
    const p2 = createMockPlugin("plugin-b", null);
    loader.register(p1);
    loader.register(p2);
    expect(loader.getAll()).toEqual([p1, p2]);
  });

  test("不允许注册同名插件", () => {
    const loader = new PluginLoader();
    loader.register(createMockPlugin("dup", {}));
    expect(() => loader.register(createMockPlugin("dup", {}))).toThrow();
  });

  test("不允许注册空名称插件", () => {
    const loader = new PluginLoader();
    expect(() => loader.register(createMockPlugin("", {}))).toThrow();
  });

  test("按名称获取插件", () => {
    const loader = new PluginLoader();
    const p1 = createMockPlugin("find-me", {});
    loader.register(p1);
    expect(loader.get("find-me")).toBe(p1);
    expect(loader.get("not-exist")).toBeUndefined();
  });

  test("pluginCount 返回正确数量", () => {
    const loader = new PluginLoader();
    expect(loader.pluginCount).toBe(0);
    loader.register(createMockPlugin("a", {}));
    loader.register(createMockPlugin("b", {}));
    expect(loader.pluginCount).toBe(2);
  });

  test("加载所有内置插件", () => {
    const loader = PluginLoader.withBuiltins();
    const plugins = loader.getAll();
    // 初始阶段为空数组，后续 Phase 逐步补充内置插件
    expect(plugins).toBeInstanceOf(Array);
  });
});
```

---

## Step 3.3 — 插件加载器实现 (`src/core/plugin-loader.ts`)

```typescript
import { pluginMetaSchema } from "../plugins/types.ts";
import type { Plugin } from "../plugins/types.ts";

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();

  /** 注册一个插件（使用 Zod 验证 meta） */
  register(plugin: Plugin): void {
    const parsed = pluginMetaSchema.safeParse(plugin.meta);
    if (!parsed.success) {
      throw new Error(`Invalid plugin meta: ${parsed.error.message}`);
    }
    if (this.plugins.has(plugin.meta.name)) {
      throw new Error(`Plugin "${plugin.meta.name}" is already registered`);
    }
    this.plugins.set(plugin.meta.name, plugin);
  }

  /** 获取所有已注册的插件（按注册顺序） */
  getAll(): Plugin[] {
    return [...this.plugins.values()];
  }

  /** 按名称获取插件 */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /** 已注册插件数量 */
  get pluginCount(): number {
    return this.plugins.size;
  }

  /** 创建一个预加载所有内置插件的 PluginLoader */
  static withBuiltins(): PluginLoader {
    const loader = new PluginLoader();
    // 后续 Phase 实现插件后，在此处 import 并注册：
    // loader.register(baseInfoPlugin);
    // loader.register(emailPlugin);
    // loader.register(geoipPlugin);
    // loader.register(wappalyzerPlugin);
    // loader.register(bbscanPlugin);
    return loader;
  }
}
```

---

## Step 3.4 — 验证

```bash
bun test tests/core/plugin-loader.test.ts
bunx eslint src/core/ src/plugins/types.ts
```

---

## Step 3.5 — 提交

```bash
git add .
git commit -m "feat: Phase 3 — 插件类型定义与加载器 (Zod 验证)"
git push
```

---

## 完成标志

- [ ] `tests/core/plugin-loader.test.ts` 全部通过
- [ ] `src/plugins/types.ts` 包含类型定义 + Zod schema
- [ ] `src/core/plugin-loader.ts` 注册时使用 Zod 验证 meta
- [ ] lint 无错误
- [ ] 代码已提交并推送
- [ ] `docs/2026-04-01/sop/README.md` 中 Phase 3 状态已更新为 ✅
