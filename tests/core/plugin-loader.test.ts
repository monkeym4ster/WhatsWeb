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
    expect(plugins).toBeInstanceOf(Array);
  });
});
