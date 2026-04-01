import { describe, test, expect } from "bun:test";
import { geoipPlugin } from "../../src/plugins/geoip.ts";
import type { PluginContext } from "../../src/plugins/types.ts";

const makeContext = (url: string): PluginContext => ({
  url,
  timeout: 5000,
  userAgent: "test",
  response: { status: 200, statusText: "OK", headers: {}, text: "", url },
});

describe("geoipPlugin", () => {
  test("meta.name 正确", () => {
    expect(geoipPlugin.meta.name).toBe("Geolocation");
  });

  test("解析 IP 并返回地理信息", async () => {
    const result = await geoipPlugin.execute(makeContext("http://8.8.8.8"));
    expect(result?.ip).toBe("8.8.8.8");
    expect(result?.country).toBeDefined();
  });

  test("域名会被解析为 IP", async () => {
    const result = await geoipPlugin.execute(makeContext("http://dns.google"));
    expect(result?.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  test("无法解析的域名应返回 null", async () => {
    const result = await geoipPlugin.execute(makeContext("http://this-domain-does-not-exist-xyz123.invalid"));
    expect(result).toBeNull();
  });
});
