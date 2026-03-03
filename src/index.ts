/**
 * @wallet/backup-backend — Public API Barrel
 *
 * Re-exports everything a consuming application needs.
 * Internal implementation details (AxiosHttpClient, response schemas, etc.)
 * are intentionally NOT exported to keep the public surface minimal and stable.
 */

// Public class
export { BackendBackupClient } from './backendClient.js';

// Public interfaces / types
export type {
  BackendBackupConfig,
  UploadSeedParams,
  UploadEntropyParams,
  SeedItem,
  EntropyItem,
  RetryConfig,
  DebugInterceptor,
  RequestDebugInfo,
  ResponseDebugInfo,
  ErrorDebugInfo,
} from './types.js';

// Typed errors — consumers need these for `instanceof` checks
export {
  BackendAuthError,
  BackendNetworkError,
  BackendValidationError,
} from './errors/index.js';

// IHttpClient — exported so consumers can provide a custom HTTP implementation
export type { IHttpClient } from './http/httpClient.js';
