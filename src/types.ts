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
  /**
   * Optional debug interceptor for inspecting requests and responses.
   * Only use in development — callbacks may receive sensitive data.
   */
  debug?: DebugInterceptor | null;
}

// ---------------------------------------------------------------------------
// Method parameter shapes
// ---------------------------------------------------------------------------

export interface UploadSeedParams {
  /** The encrypted seed — never modify or log this value. */
  seed: string;
  /** Auth token used for backend authentication (sent as x-authtoken). */
  authToken: string;
  /** Optional metadata to associate with the backup. */
  metadata?: Record<string, unknown>;
}

export interface UploadEntropyParams {
  /** The encrypted entropy — never modify or log this value. */
  entropy: string;
  /** Auth token used for backend authentication (sent as x-authtoken). */
  authToken: string;
  /** Optional metadata to associate with the backup. */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Response item shapes (GET seed / GET entropy)
// ---------------------------------------------------------------------------

export interface SeedItem {
  seed: string;
  metadata?: Record<string, unknown>;
}

export interface EntropyItem {
  entropy: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Debug interceptor
// ---------------------------------------------------------------------------

export interface RequestDebugInfo {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface ResponseDebugInfo {
  url: string;
  method: string;
  status: number;
  data: unknown;
  durationMs: number;
}

export interface ErrorDebugInfo {
  url: string;
  method: string;
  error: Error;
  durationMs: number;
}

/**
 * Optional interceptor for debugging API traffic.
 *
 * **WARNING**: Callbacks may receive encrypted payloads and auth tokens.
 * Only enable in development builds — never ship to production with
 * interceptors that persist or transmit the received data.
 */
export interface DebugInterceptor {
  onRequest?: (info: RequestDebugInfo) => void;
  onResponse?: (info: ResponseDebugInfo) => void;
  onError?: (info: ErrorDebugInfo) => void;
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
