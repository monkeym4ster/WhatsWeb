import { describe, test, expect } from "bun:test";
import { bbscanPlugin } from "../../../src/plugins/bbscan/index.ts";

describe("bbscanPlugin", () => {
  test("meta.name 正确", () => {
    expect(bbscanPlugin.meta.name).toBe("BBScan");
  });

  test("实现了 Plugin 接口", () => {
    expect(typeof bbscanPlugin.execute).toBe("function");
  });
});
