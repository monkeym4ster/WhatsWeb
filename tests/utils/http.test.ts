import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { httpGet, httpHead } from "../../src/utils/http.ts";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/ok") {
        return new Response("<html><title>Test Page</title></html>", {
          headers: { "content-type": "text/html", "x-powered-by": "test" },
        });
      }
      if (url.pathname === "/redirect") {
        return Response.redirect(`http://localhost:${server.port}/ok`, 302);
      }
      if (url.pathname === "/slow") {
        return new Promise((resolve) => setTimeout(() => resolve(new Response("slow")), 5000));
      }
      return new Response("Not Found", { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

describe("httpGet", () => {
  test("正常 GET 请求", async () => {
    const res = await httpGet(`${baseUrl}/ok`, { timeout: 5000, userAgent: "test" });
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Test Page</title>");
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["x-powered-by"]).toBe("test");
  });

  test("非 2xx 状态码不抛异常", async () => {
    const res = await httpGet(`${baseUrl}/not-exist`, { timeout: 5000, userAgent: "test" });
    expect(res.status).toBe(404);
  });

  test("跟踪重定向并记录最终 URL", async () => {
    const res = await httpGet(`${baseUrl}/redirect`, { timeout: 5000, userAgent: "test" });
    expect(res.status).toBe(200);
    expect(res.url).toContain("/ok");
  });

  test("超时应抛出错误", async () => {
    await expect(httpGet(`${baseUrl}/slow`, { timeout: 500, userAgent: "test" })).rejects.toThrow();
  });
});

describe("httpHead", () => {
  test("HEAD 请求返回头信息", async () => {
    const res = await httpHead(`${baseUrl}/ok`, { timeout: 5000, userAgent: "test" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });
});
