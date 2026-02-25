/**
 * @wallet/backup-backend — Public Types
 *
 * All interfaces here are part of the public API surface. Do NOT export
 * implementation-internal types from this file.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3). */
  count: number;
  /** Base delay in milliseconds before the first retry (default: 300). */
  delayMs: number;
  /**
   * Exponential backoff factor applied to delayMs on each retry.
   * e.g. factor=2 → delays of 300ms, 600ms, 1200ms… (default: 2).
   */
  backoffFactor: number;
}

export interface BackendBackupConfig {
  /** Base URL of the client backend, e.g. "https://api.example.com". */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 10_000). */
  timeoutMs?: number;
  /**
   * Optional retry strategy. Set to `null` / omit to disable retries.
   * Network errors and 5xx responses are retried; 4xx errors are NOT.
   */
  retry?: Partial<RetryConfig> | null;
}

// ---------------------------------------------------------------------------
// Method parameter shapes
// ---------------------------------------------------------------------------

export interface UploadSeedParams {
  /** The encrypted seed — never modify or log this value. */
  encryptedSeed: string;
  /** Bearer token used for backend authentication. */
  authToken: string;
  /** Optional device identifier to associate with the backup. */
  deviceId?: string;
}

export interface UploadEntropyParams {
  /** The encrypted entropy — never modify or log this value. */
  encryptedEntropy: string;
  /** Bearer token used for backend authentication. */
  authToken: string;
  /** Optional device identifier to associate with the backup. */
  deviceId?: string;
}

// ---------------------------------------------------------------------------
// Internal HTTP types (exported for IHttpClient implementors)
// ---------------------------------------------------------------------------

export interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'DELETE';
  headers?: Record<string, string>;
  /** JSON-serialisable body. Only used with POST. */
  body?: Record<string, unknown>;
  timeoutMs: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
}
