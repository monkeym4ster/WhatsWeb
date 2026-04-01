import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { BBScanner } from "../../../src/plugins/bbscan/scanner.ts";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/WhatsWeb-404-existence-check") {
        return new Response("Not Found", { status: 404 });
      }

      if (url.pathname === "/.git/config") {
        return new Response("[core]\n\trepositoryformatversion = 0", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }

      if (url.pathname === "/.svn/entries") {
        return new Response("12\n-props", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

describe("BBScanner", () => {
  test("check404 — 服务器支持 404", async () => {
    const scanner = new BBScanner({ url: baseUrl, userAgent: "test", timeout: 5000 });
    const has404 = await scanner.check404();
    expect(has404).toBe(true);
  });

  test("完整扫描流程 — 发现敏感路径", async () => {
    const scanner = new BBScanner({ url: baseUrl, userAgent: "test", timeout: 5000 });
    const results = await scanner.run();
    expect(results).toBeInstanceOf(Array);
    if (Array.isArray(results)) {
      expect(results.some((r) => r.includes(".git"))).toBe(true);
    }
  }, 30000);
});
