import { describe, test, expect } from "bun:test";
import { cliOptionsSchema } from "../../src/schemas/cli.ts";

describe("cliOptionsSchema", () => {
  test("默认值填充", () => {
    const result = cliOptionsSchema.parse({});
    expect(result.concurrency).toBe(50);
    expect(result.timeout).toBe(10000);
    expect(result.showError).toBe(false);
    expect(result.userAgent).toContain("whatsweb");
  });

  test("自定义值通过验证", () => {
    const result = cliOptionsSchema.parse({
      concurrency: 10,
      timeout: 5000,
      userAgent: "custom",
      output: "/tmp/out.json",
      showError: true,
      network: "24",
    });
    expect(result.concurrency).toBe(10);
    expect(result.output).toBe("/tmp/out.json");
    expect(result.network).toBe("24");
  });

  test("并发数必须为正整数", () => {
    const result = cliOptionsSchema.safeParse({ concurrency: -1 });
    expect(result.success).toBe(false);
  });

  test("超时必须为正数", () => {
    const result = cliOptionsSchema.safeParse({ timeout: 0 });
    expect(result.success).toBe(false);
  });
});
