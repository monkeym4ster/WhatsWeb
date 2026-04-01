import { describe, test, expect } from "bun:test";
import { mapConcurrent } from "../../src/utils/concurrency.ts";

describe("mapConcurrent (基于 p-limit)", () => {
  test("所有任务按原始顺序返回结果", async () => {
    const input = [1, 2, 3, 4, 5];
    const results = await mapConcurrent(input, async (n) => n * 2, { concurrency: 2 });
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  test("空数组返回空数组", async () => {
    const results = await mapConcurrent([], async (n: number) => n, { concurrency: 5 });
    expect(results).toEqual([]);
  });

  test("并发度生效（不超过指定上限）", async () => {
    let running = 0;
    let maxRunning = 0;
    await mapConcurrent(
      Array.from({ length: 20 }, (_, i) => i),
      async (n) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 50));
        running--;
        return n;
      },
      { concurrency: 5 },
    );
    expect(maxRunning).toBeLessThanOrEqual(5);
  });

  test("单个任务失败不影响其他任务（传入 onError 回调时）", async () => {
    const errors: Error[] = [];
    const results = await mapConcurrent(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error("fail");
        return n;
      },
      {
        concurrency: 2,
        onError: (err) => errors.push(err as Error),
      },
    );
    expect(results).toEqual([1, undefined, 3]);
    expect(errors.length).toBe(1);
  });

  test("未提供 onError 时，错误直接抛出", async () => {
    await expect(
      mapConcurrent(
        [1, 2, 3],
        async (n) => {
          if (n === 2) throw new Error("boom");
          return n;
        },
        { concurrency: 1 },
      ),
    ).rejects.toThrow("boom");
  });
});
