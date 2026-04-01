import { describe, test, expect } from "bun:test";
import { emailPlugin } from "../../src/plugins/email.ts";
import type { PluginContext } from "../../src/plugins/types.ts";

const makeContext = (html: string): PluginContext => ({
  url: "http://example.com",
  timeout: 5000,
  userAgent: "test",
  response: { status: 200, statusText: "OK", headers: {}, text: html, url: "http://example.com" },
});

describe("emailPlugin", () => {
  test("meta.name 正确", () => {
    expect(emailPlugin.meta.name).toBe("Email");
  });

  test("从 HTML 中提取多个邮箱", async () => {
    const html = "Contact: admin@test.com and info@test.com for details";
    const result = await emailPlugin.execute(makeContext(html));
    expect(result?.email).toEqual(expect.arrayContaining(["admin@test.com", "info@test.com"]));
  });

  test("邮箱去重", async () => {
    const html = "admin@test.com admin@test.com admin@test.com info@test.com";
    const result = await emailPlugin.execute(makeContext(html));
    expect(result?.email).toEqual(["admin@test.com", "info@test.com"]);
  });

  test("少于 2 个唯一邮箱时返回 null", async () => {
    const html = "Only one: admin@test.com";
    const result = await emailPlugin.execute(makeContext(html));
    expect(result).toBeNull();
  });

  test("无邮箱时返回 null", async () => {
    const result = await emailPlugin.execute(makeContext("<html>No emails here</html>"));
    expect(result).toBeNull();
  });
});
