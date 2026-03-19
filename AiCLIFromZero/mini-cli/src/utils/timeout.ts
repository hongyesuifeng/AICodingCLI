export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export interface TimeoutOptions {
  ms: number;
  message?: string;
  onTimeout?: () => void;
}

export function withTimeout<T>(
  promise: Promise<T>,
  options: number | TimeoutOptions
): Promise<T> {
  const resolvedOptions = typeof options === 'number'
    ? { ms: options }
    : options;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolvedOptions.onTimeout?.();
      reject(
        new TimeoutError(
          resolvedOptions.message ?? `Timeout after ${resolvedOptions.ms}ms`,
          resolvedOptions.ms
        )
      );
    }, resolvedOptions.ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
