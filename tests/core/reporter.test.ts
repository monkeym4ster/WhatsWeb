import { describe, test, expect } from "bun:test";
import { Reporter } from "../../src/core/reporter.ts";
import type { ScanResult } from "../../src/core/scanner.ts";
import { existsSync, unlinkSync } from "node:fs";

describe("Reporter", () => {
  test("formatResult 生成包含关键信息的字符串", () => {
    const reporter = new Reporter({ showError: false });
    const results: ScanResult[] = [
      { name: "Base Information", result: { status: "200 OK", title: "Test Page" } },
      { name: "Email", result: { email: ["a@b.com", "c@d.com"] } },
    ];
    const output = reporter.formatResult("http://example.com", results);
    expect(output).toContain("http://example.com");
    expect(output).toContain("Base Information");
    expect(output).toContain("200 OK");
  });

  test("formatError 包含 URL 和错误信息", () => {
    const reporter = new Reporter({ showError: true });
    const output = reporter.formatError("http://example.com", new Error("timeout"));
    expect(output).toContain("http://example.com");
    expect(output).toContain("timeout");
  });

  test("formatError 在 showError=false 时返回空", () => {
    const reporter = new Reporter({ showError: false });
    const output = reporter.formatError("http://example.com", new Error("timeout"));
    expect(output).toBe("");
  });

  test("appendJsonLine 写入文件", () => {
    const tmpFile = `/tmp/whatsweb-test-${Date.now()}.jsonl`;
    const reporter = new Reporter({ showError: false, outputFile: tmpFile });

    reporter.appendJsonLine("http://example.com", [{ name: "test", result: { key: "value" } }]);

    expect(existsSync(tmpFile)).toBe(true);
    const content = Bun.file(tmpFile);
    const text = new Blob([content]).toString();
    // Just verify file exists and is non-empty
    expect(content.size).toBeGreaterThan(0);

    unlinkSync(tmpFile);
  });

  test("数组值以逗号连接显示", () => {
    const reporter = new Reporter({ showError: false });
    const results: ScanResult[] = [{ name: "Email", result: { email: ["a@b.com", "c@d.com"] } }];
    const output = reporter.formatResult("http://example.com", results);
    expect(output).toContain("a@b.com, c@d.com");
  });
});
