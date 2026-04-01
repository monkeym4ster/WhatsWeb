import { describe, test, expect } from "bun:test";
import { normalizeUrl, urlSchema } from "../../src/utils/url.ts";

describe("normalizeUrl", () => {
  test("为无协议的 URL 自动补全 http://", () => {
    expect(normalizeUrl("example.com")).toBe("http://example.com");
  });

  test("保留已有的 http:// 协议", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  test("保留已有的 https:// 协议", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  test("处理带端口的 URL", () => {
    expect(normalizeUrl("example.com:8080")).toBe("http://example.com:8080");
  });

  test("处理带路径的 URL", () => {
    expect(normalizeUrl("example.com/path")).toBe("http://example.com/path");
  });

  test("空字符串应抛出错误", () => {
    expect(() => normalizeUrl("")).toThrow();
  });

  test("null/undefined 应抛出错误", () => {
    expect(() => normalizeUrl(null as unknown as string)).toThrow();
    expect(() => normalizeUrl(undefined as unknown as string)).toThrow();
  });
});

describe("urlSchema (Zod)", () => {
  test("合法 URL 通过验证", () => {
    const result = urlSchema.safeParse("http://example.com");
    expect(result.success).toBe(true);
  });

  test("空字符串验证失败", () => {
    const result = urlSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  test("自动补全协议后通过验证（使用 transform）", () => {
    const result = urlSchema.safeParse("example.com");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("http://example.com");
    }
  });
});
