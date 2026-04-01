import { describe, test, expect } from "bun:test";
import { baseInfoPlugin } from "../../src/plugins/base-info.ts";
import type { PluginContext, HttpResponse } from "../../src/plugins/types.ts";

const makeContext = (overrides: Partial<HttpResponse> & { ctxUrl?: string }): PluginContext => ({
  url: overrides.ctxUrl ?? "http://example.com",
  timeout: 5000,
  userAgent: "test",
  response: {
    status: 200,
    statusText: "OK",
    headers: {},
    text: "",
    url: overrides.ctxUrl ?? "http://example.com",
    ...overrides,
  },
});

describe("baseInfoPlugin", () => {
  test("meta.name 正确", () => {
    expect(baseInfoPlugin.meta.name).toBe("Base Information");
  });

  test("提取状态码", async () => {
    const result = await baseInfoPlugin.execute(makeContext({ status: 200, statusText: "OK" }));
    expect(result?.status).toBe("200 OK");
  });

  test("提取 <title> 标签", async () => {
    const result = await baseInfoPlugin.execute(
      makeContext({ text: "<html><title>Hello World</title></html>" }),
    );
    expect(result?.title).toBe("Hello World");
  });

  test("标题中的换行符被转义", async () => {
    const result = await baseInfoPlugin.execute(
      makeContext({ text: "<html><title>Line1\nLine2\rLine3</title></html>" }),
    );
    expect(result?.title).toBe("Line1\\nLine2\\rLine3");
  });

  test("无 title 时结果中不含 title 字段", async () => {
    const result = await baseInfoPlugin.execute(
      makeContext({ text: "<html><body>No title</body></html>" }),
    );
    expect(result?.title).toBeUndefined();
  });

  test("检测重定向", async () => {
    const ctx: PluginContext = {
      url: "http://example.com",
      timeout: 5000,
      userAgent: "test",
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        text: "<html></html>",
        url: "http://example.com/redirected",
      },
    };
    const result = await baseInfoPlugin.execute(ctx);
    expect(result?.redirect).toBe("http://example.com/redirected");
  });

  test("无重定向时不含 redirect 字段", async () => {
    const result = await baseInfoPlugin.execute(makeContext({ text: "<html></html>" }));
    expect(result?.redirect).toBeUndefined();
  });

  test("提取 x-* 响应头", async () => {
    const result = await baseInfoPlugin.execute(
      makeContext({
        text: "<html></html>",
        headers: {
          "x-powered-by": "Express",
          "x-request-id": "abc123",
          "content-type": "text/html",
        },
      }),
    );
    expect(result?.["x-powered-by"]).toBe("Express");
    expect(result?.["x-request-id"]).toBe("abc123");
    expect(result?.["content-type"]).toBeUndefined();
  });
});
