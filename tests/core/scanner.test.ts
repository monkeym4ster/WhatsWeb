import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Scanner } from "../../src/core/scanner.ts";
import { PluginLoader } from "../../src/core/plugin-loader.ts";
import type { Plugin, PluginContext } from "../../src/plugins/types.ts";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/") {
        return new Response(
          "<html><title>Test Site</title><body>admin@test.com info@test.com</body></html>",
          { headers: { "content-type": "text/html", "x-powered-by": "TestServer" } },
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

const successPlugin: Plugin = {
  meta: { name: "success-plugin" },
  execute: async (ctx: PluginContext) => ({ found: true, url: ctx.url }),
};

const emptyPlugin: Plugin = {
  meta: { name: "empty-plugin" },
  execute: async () => null,
};

const errorPlugin: Plugin = {
  meta: { name: "error-plugin" },
  execute: async () => {
    throw new Error("plugin crashed");
  },
};

describe("Scanner", () => {
  test("使用 mock 插件扫描", async () => {
    const loader = new PluginLoader();
    loader.register(successPlugin);
    loader.register(emptyPlugin);

    const scanner = new Scanner({
      target: baseUrl,
      timeout: 5000,
      userAgent: "test",
      pluginLoader: loader,
    });

    const results = await scanner.analyse();
    expect(Array.isArray(results)).toBe(true);
    if (!Array.isArray(results)) return;

    const successResult = results.find((r) => r.name === "success-plugin");
    expect(successResult).toBeDefined();
    expect(successResult?.result.found).toBe(true);

    const emptyResult = results.find((r) => r.name === "empty-plugin");
    expect(emptyResult).toBeUndefined();
  });

  test("单个插件失败不影响其他插件", async () => {
    const loader = new PluginLoader();
    loader.register(successPlugin);
    loader.register(errorPlugin);

    const scanner = new Scanner({
      target: baseUrl,
      timeout: 5000,
      userAgent: "test",
      pluginLoader: loader,
    });

    const results = await scanner.analyse();
    expect(Array.isArray(results)).toBe(true);
    if (!Array.isArray(results)) return;

    expect(results.find((r) => r.name === "success-plugin")).toBeDefined();
    expect(results.find((r) => r.name === "error-plugin")).toBeUndefined();
  });

  test("target 不可达时返回错误", async () => {
    const loader = new PluginLoader();
    loader.register(successPlugin);

    const scanner = new Scanner({
      target: "http://localhost:1",
      timeout: 2000,
      userAgent: "test",
      pluginLoader: loader,
    });

    const result = await scanner.analyse();
    expect(result instanceof Error).toBe(true);
  });

  test("使用 Zod 验证选项 — 空 target 应抛错", () => {
    expect(() => {
      new Scanner({ target: "", timeout: 5000, userAgent: "test" });
    }).toThrow();
  });

  test("使用内置插件扫描本地服务器", async () => {
    const scanner = new Scanner({
      target: baseUrl,
      timeout: 10000,
      userAgent: "test",
    });

    const results = await scanner.analyse();
    expect(Array.isArray(results)).toBe(true);
    if (!Array.isArray(results)) return;

    const baseInfo = results.find((r) => r.name === "Base Information");
    expect(baseInfo).toBeDefined();
    expect(String(baseInfo?.result.status)).toContain("200");
  }, 30000);
});
