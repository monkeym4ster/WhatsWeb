import { describe, test, expect } from "bun:test";

describe("项目骨架验证", () => {
  test("bun:test 框架可运行", () => {
    expect(1 + 1).toBe(2);
  });

  test("可导入类型定义", async () => {
    const types = await import("../src/plugins/types.ts");
    expect(types).toBeDefined();
  });
});
