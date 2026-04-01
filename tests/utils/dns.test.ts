import { describe, test, expect } from "bun:test";
import { resolve4 } from "../../src/utils/dns.ts";

describe("resolve4", () => {
  test("IPv4 地址直接返回", async () => {
    expect(await resolve4("1.2.3.4")).toBe("1.2.3.4");
  });

  test("非 IPv4 字符串进行 DNS 解析", async () => {
    const ip = await resolve4("dns.google");
    expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  test("不存在的域名应抛出错误", async () => {
    await expect(resolve4("this-domain-does-not-exist-xyz123.invalid")).rejects.toThrow();
  });
});
