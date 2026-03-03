/**
 * Development-only logger.
 * In production builds, all calls are no-ops so nothing leaks to the console.
 */

const isDev = import.meta.env.DEV;

export const devLog = isDev
  ? (...args: unknown[]) => console.log(...args)
  : (..._args: unknown[]) => {};

export const devWarn = isDev
  ? (...args: unknown[]) => console.warn(...args)
  : (..._args: unknown[]) => {};

export const devError = isDev
  ? (...args: unknown[]) => console.error(...args)
  : (..._args: unknown[]) => {};
