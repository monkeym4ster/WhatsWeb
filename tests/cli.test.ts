import { describe, test, expect } from "bun:test";

describe("CLI", () => {
  test("无参数时显示帮助信息", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const output = stdout + stderr;
    await proc.exited;
    expect(output).toContain("Usage");
  });

  test("--version 输出版本号", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "--version"], {
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("--help 输出帮助信息", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "--help"], {
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    expect(output).toContain("-f");
    expect(output).toContain("--concurrency");
    expect(output).toContain("--network");
    expect(output).toContain("--timeout");
    expect(output).toContain("--user-agent");
    expect(output).toContain("--output");
    expect(output).toContain("--show-error");
  });
});
