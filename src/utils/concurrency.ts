import pLimit from "p-limit";

export interface MapConcurrentOptions {
  concurrency: number;
  onError?: (error: unknown, item: unknown, index: number) => void;
}

export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: MapConcurrentOptions,
): Promise<(R | undefined)[]> {
  const limit = pLimit(options.concurrency);

  const tasks = items.map((item, index) =>
    limit(async () => {
      try {
        return await fn(item, index);
      } catch (error) {
        if (options.onError) {
          options.onError(error, item, index);
          return undefined;
        }
        throw error;
      }
    }),
  );

  return Promise.all(tasks);
}
