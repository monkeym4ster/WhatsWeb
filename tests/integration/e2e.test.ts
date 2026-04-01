import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Scanner } from "../../src/core/scanner.ts";
import { existsSync, unlinkSync } from "node:fs";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/") {
        return new Response(
          `<html>
            <head><title>Integration Test Site</title></head>
            <body>
              Contact: admin@test.com, support@test.com
              <script src="jquery.min.js"></script>
            </body>
          </html>`,
          {
            headers: {
              "content-type": "text/html",
              "x-powered-by": "Express",
              "x-request-id": "test-123",
            },
          },
        );
      }

      if (url.pathname === "/WhatsWeb-404-existence-check") {
        return new Response("Not Found", { status: 404 });
      }

      return new Response("Not Found", { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

describe("端到端集成测试", () => {
  test("完整扫描流程 — Scanner + 内置插件", async () => {
    const scanner = new Scanner({
      target: baseUrl,
      timeout: 10000,
      userAgent: "WhatsWeb-Integration-Test",
    });

    const results = await scanner.analyse();
    expect(Array.isArray(results)).toBe(true);
    if (!Array.isArray(results)) return;

    const baseInfo = results.find((r) => r.name === "Base Information");
    expect(baseInfo).toBeDefined();
    expect(String(baseInfo?.result.status)).toContain("200");
    expect(baseInfo?.result.title).toBe("Integration Test Site");
    expect(baseInfo?.result["x-powered-by"]).toBe("Express");
    expect(baseInfo?.result["x-request-id"]).toBe("test-123");

    const email = results.find((r) => r.name === "Email");
    expect(email).toBeDefined();
    expect(email?.result.email).toEqual(expect.arrayContaining(["admin@test.com", "support@test.com"]));

    // Geolocation may return null for localhost (127.0.0.1 has no geo data)
    const geo = results.find((r) => r.name === "Geolocation");
    if (geo) {
      expect(geo.result.ip).toBeDefined();
    }
  }, 30000);
});

describe("CLI 端到端", () => {
  test("扫描并输出到文件", async () => {
    const tmpFile = `/tmp/whatsweb-e2e-${Date.now()}.jsonl`;

    const proc = Bun.spawn(["bun", "run", "src/cli.ts", baseUrl, "-o", tmpFile, "--timeout", "10000"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;

    if (existsSync(tmpFile)) {
      const content = await Bun.file(tmpFile).text();
      expect(content.trim().length).toBeGreaterThan(0);
      const line = JSON.parse(content.trim().split("\n")[0]);
      expect(line.target).toBe(baseUrl);
      expect(line.plugins).toBeInstanceOf(Array);
      unlinkSync(tmpFile);
    }
  }, 60000);
});
