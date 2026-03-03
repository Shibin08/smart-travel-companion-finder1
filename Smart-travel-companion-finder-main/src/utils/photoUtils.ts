/**
 * Shared photo/URL utilities — single source of truth for API_BASE_URL
 * and photo URL resolution across the app.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://127.0.0.1:8000';

/**
 * Resolve a photo URL that may be a relative backend path (e.g. `/uploads/…`)
 * into an absolute URL by prepending API_BASE_URL.
 * External URLs (starting with `http`) are returned as-is.
 */
export function resolvePhoto(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}
