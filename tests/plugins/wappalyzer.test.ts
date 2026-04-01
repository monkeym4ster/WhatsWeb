import { describe, test, expect } from "bun:test";
import { wappalyzerPlugin } from "../../src/plugins/wappalyzer.ts";

describe("wappalyzerPlugin", () => {
  test("meta.name 正确", () => {
    expect(wappalyzerPlugin.meta.name).toBe("Wappalyzer");
  });

  test("实现了 Plugin 接口", () => {
    expect(typeof wappalyzerPlugin.execute).toBe("function");
  });

  test("无法访问的 URL 应返回 null", async () => {
    const ctx = {
      url: "http://localhost:1",
      timeout: 5000,
      userAgent: "test",
      response: { status: 200, statusText: "OK", headers: {}, text: "", url: "http://localhost:1" },
    };
    const result = await wappalyzerPlugin.execute(ctx);
    expect(result === null || (result && Object.keys(result).length === 0)).toBe(true);
  }, 30000);
});
