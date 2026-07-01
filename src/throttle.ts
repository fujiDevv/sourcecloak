export function throttle<T extends (...args: any[]) => void>(fn: T, waitMs: number): T {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const invoke = () => {
    lastCall = Date.now();
    if (lastArgs) fn(...lastArgs);
    lastArgs = null;
  };

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = waitMs - (now - lastCall);
    lastArgs = args;

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke();
      return;
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        invoke();
      }, remaining);
    }
  }) as T;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), waitMs);
  }) as T;
}