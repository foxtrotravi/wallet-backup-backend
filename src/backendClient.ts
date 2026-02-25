/**
 * @wallet/backup-backend — BackendBackupClient
 *
 * The primary entry-point for consumers of this SDK.
 *
 * Security contract:
 *   - Encrypted payloads are NEVER logged, neither here nor in the HTTP layer.
 *   - Encrypted payloads are NEVER modified before being sent.
 *   - Backend response shapes are validated with Zod before being returned.
 *   - HTTP status codes are validated; non-2xx always raises a typed error.
 */

import { z } from 'zod';
import { AxiosHttpClient, type IHttpClient } from './http/httpClient.js';
import { BackendValidationError } from './errors/index.js';
import type {
  BackendBackupConfig,
  UploadSeedParams,
  UploadEntropyParams,
  RetryConfig,
} from './types.js';

// ---------------------------------------------------------------------------
// Response schemas (Zod) — runtime shape validation
// ---------------------------------------------------------------------------

const SeedResponseSchema = z.object({
  encryptedSeed: z.string().min(1),
});

const EntropyResponseSchema = z.object({
  encryptedEntropy: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Default configuration values
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10_000;

const DEFAULT_RETRY: Partial<RetryConfig> = {
  count: 3,
  delayMs: 300,
  backoffFactor: 2,
};

// ---------------------------------------------------------------------------
// BackendBackupClient
// ---------------------------------------------------------------------------

export class BackendBackupClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly http: IHttpClient;

  /**
   * @param config  SDK configuration (baseUrl, timeoutMs, retry strategy).
   * @param http    Optional IHttpClient injection point — useful for testing or
   *                replacing the HTTP layer entirely without touching this class.
   */
  constructor(config: BackendBackupConfig, http?: IHttpClient) {
    if (!config.baseUrl) {
      throw new Error('BackendBackupConfig.baseUrl is required');
    }
    // Normalise: strip trailing slash so URL construction is predictable
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    this.http =
      http ??
      new AxiosHttpClient(
        config.retry === null ? null : { ...DEFAULT_RETRY, ...config.retry },
      );
  }

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  /**
   * Upload the encrypted seed to the backend.
   * The payload is transmitted as-is — no transformation is applied.
   */
  async uploadSeed(params: UploadSeedParams): Promise<void> {
    const { encryptedSeed, authToken, deviceId } = params;

    const body: Record<string, unknown> = { encryptedSeed };
    if (deviceId !== undefined) body['deviceId'] = deviceId;

    await this.http.request({
      url: this.url('/seed'),
      method: 'POST',
      headers: this.authHeader(authToken),
      body,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Upload the encrypted entropy to the backend.
   * The payload is transmitted as-is — no transformation is applied.
   */
  async uploadEntropy(params: UploadEntropyParams): Promise<void> {
    const { encryptedEntropy, authToken, deviceId } = params;

    const body: Record<string, unknown> = { encryptedEntropy };
    if (deviceId !== undefined) body['deviceId'] = deviceId;

    await this.http.request({
      url: this.url('/entropy'),
      method: 'POST',
      headers: this.authHeader(authToken),
      body,
      timeoutMs: this.timeoutMs,
    });
  }

  // -------------------------------------------------------------------------
  // Retrieve
  // -------------------------------------------------------------------------

  /**
   * Retrieve the encrypted seed from the backend.
   * The response shape is validated with Zod; a malformed response throws
   * BackendValidationError rather than silently returning `undefined`.
   */
  async getSeed(authToken: string): Promise<string> {
    const response = await this.http.request<unknown>({
      url: this.url('/seed'),
      method: 'GET',
      headers: this.authHeader(authToken),
      timeoutMs: this.timeoutMs,
    });

    return this.parseResponse(
      response.data,
      SeedResponseSchema,
      (parsed) => parsed.encryptedSeed,
      'GET /seed',
    );
  }

  /**
   * Retrieve the encrypted entropy from the backend.
   * The response shape is validated with Zod.
   */
  async getEntropy(authToken: string): Promise<string> {
    const response = await this.http.request<unknown>({
      url: this.url('/entropy'),
      method: 'GET',
      headers: this.authHeader(authToken),
      timeoutMs: this.timeoutMs,
    });

    return this.parseResponse(
      response.data,
      EntropyResponseSchema,
      (parsed) => parsed.encryptedEntropy,
      'GET /entropy',
    );
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  /**
   * Delete both the seed and entropy backups from the backend in parallel.
   * Both DELETE requests are fired concurrently; errors from either are
   * propagated to the caller.
   */
  async deleteBackup(authToken: string): Promise<void> {
    await Promise.all([
      this.http.request({
        url: this.url('/seed'),
        method: 'DELETE',
        headers: this.authHeader(authToken),
        timeoutMs: this.timeoutMs,
      }),
      this.http.request({
        url: this.url('/entropy'),
        method: 'DELETE',
        headers: this.authHeader(authToken),
        timeoutMs: this.timeoutMs,
      }),
    ]);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private authHeader(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Parse and validate the raw API response data with a Zod schema.
   * Throws BackendValidationError if the shape does not match.
   *
   * NOTE: `data` is intentionally typed as `unknown` — we never assume the
   * response shape without explicit validation.
   */
  private parseResponse<TSchema extends z.ZodTypeAny, TOut>(
    data: unknown,
    schema: TSchema,
    extract: (parsed: z.infer<TSchema>) => TOut,
    endpoint: string,
  ): TOut {
    const result = schema.safeParse(data);

    if (!result.success) {
      throw new BackendValidationError(
        `Unexpected response shape from ${endpoint}: ${result.error.message}`,
        { cause: result.error },
      );
    }

    return extract(result.data as z.infer<TSchema>);
  }
}
