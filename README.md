# @wallet/backup-backend

> Production-grade SDK for securely uploading and retrieving encrypted wallet seeds and entropy to/from a client backend.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Overview

`@wallet/backup-backend` handles all communication between a wallet application and a client-owned backend that stores **pre-encrypted** seed phrases and entropy. The backend **never receives plaintext** — encryption is handled separately by the crypto module before data ever reaches this SDK.

**Platform support:** React Native · Web · Node.js (no native APIs)

---

## Installation

```bash
npm install @wallet/backup-backend
# or
yarn add @wallet/backup-backend
```

**Peer requirements:** Node ≥ 16, TypeScript ≥ 5 (for consumers using TS)

---

## Quick Start

```ts
import {
  BackendBackupClient,
  BackendAuthError,
  BackendNetworkError,
  BackendValidationError,
} from '@wallet/backup-backend';

const client = new BackendBackupClient({
  baseUrl: 'https://api.mywallet.com',
  timeoutMs: 15_000,            // optional, default: 10_000 ms
  retry: {                       // optional, set to null to disable
    count: 3,
    delayMs: 300,
    backoffFactor: 2,            // exponential: 300ms → 600ms → 1200ms
  },
});
```

---

## API Reference

### `new BackendBackupClient(config, http?)`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config.baseUrl` | `string` | ✅ | Backend base URL (trailing slash is stripped automatically) |
| `config.timeoutMs` | `number` | ❌ | Request timeout in ms (default: `10_000`) |
| `config.retry` | `Partial<RetryConfig> \| null` | ❌ | Retry strategy; `null` disables retries (default: 3 retries, 300 ms, factor 2) |
| `http` | `IHttpClient` | ❌ | Inject a custom HTTP implementation (useful for testing) |

---

### Methods

#### `uploadSeed(params): Promise<void>`

Uploads the encrypted seed to `POST /seed`.

```ts
await client.uploadSeed({
  encryptedSeed: '<base64-or-hex-encrypted-seed>',
  authToken: 'bearer-token',
  deviceId: 'device-uuid',    // optional
});
```

#### `uploadEntropy(params): Promise<void>`

Uploads the encrypted entropy to `POST /entropy`.

```ts
await client.uploadEntropy({
  encryptedEntropy: '<base64-or-hex-encrypted-entropy>',
  authToken: 'bearer-token',
  deviceId: 'device-uuid',    // optional
});
```

#### `getSeed(authToken): Promise<string>`

Retrieves and validates the encrypted seed from `GET /seed`.

```ts
const encryptedSeed = await client.getSeed('bearer-token');
```

#### `getEntropy(authToken): Promise<string>`

Retrieves and validates the encrypted entropy from `GET /entropy`.

```ts
const encryptedEntropy = await client.getEntropy('bearer-token');
```

#### `deleteBackup(authToken): Promise<void>`

Deletes both the seed and entropy backups from the backend in parallel (`DELETE /seed` + `DELETE /entropy`).

```ts
await client.deleteBackup('bearer-token');
```

---

## Error Handling

All errors are typed. Use `instanceof` checks to handle each case:

```ts
try {
  const seed = await client.getSeed(authToken);
} catch (err) {
  if (err instanceof BackendAuthError) {
    // HTTP 401 / 403 — token expired or invalid
    // Action: refresh the auth token and retry
    console.error('Auth failed, status:', err.statusCode);
  } else if (err instanceof BackendNetworkError) {
    // Timeout, DNS failure, ECONNREFUSED, etc.
    // Action: show offline banner, retry later
    console.error('Network error:', err.message);
  } else if (err instanceof BackendValidationError) {
    // HTTP 4xx (non-auth) or malformed response shape
    // Action: report bug — do NOT auto-retry
    console.error('Validation error:', err.message, 'status:', err.statusCode);
  }
}
```

### Error Class Reference

| Class | Trigger | `statusCode` |
|-------|---------|--------------|
| `BackendAuthError` | 401 / 403 response | `401` or `403` |
| `BackendNetworkError` | Timeout, DNS, connection refused, 5xx (after retries) | `undefined` (or `5xx`) |
| `BackendValidationError` | 400 / 422 / unexpected response shape | `400`, `422`, etc. |

All errors expose:
- `message: string`
- `statusCode?: number`
- `cause?: unknown` — the original underlying error

---

## Security Contract

- **Encrypted payloads are never modified** — transmitted byte-for-byte as provided.
- **Encrypted payloads are never logged** — neither in this SDK nor by the HTTP retry layer.
- **Response shapes are always validated** with Zod before being returned — malformed responses throw `BackendValidationError` instead of returning `undefined` or crashing silently.
- **HTTP status codes are always validated** — non-2xx responses always raise a typed error.

---

## Backend API Contract

Your backend must implement the following endpoints:

| Method | Path | Auth | Body / Response |
|--------|------|------|-----------------|
| `POST` | `/seed` | Bearer token | Body: `{ encryptedSeed: string, deviceId?: string }` |
| `POST` | `/entropy` | Bearer token | Body: `{ encryptedEntropy: string, deviceId?: string }` |
| `GET` | `/seed` | Bearer token | Response: `{ encryptedSeed: string }` |
| `GET` | `/entropy` | Bearer token | Response: `{ encryptedEntropy: string }` |
| `DELETE` | `/seed` | Bearer token | — |
| `DELETE` | `/entropy` | Bearer token | — |

---

## Replacing the HTTP Layer

The HTTP implementation is fully abstracted behind `IHttpClient`. Provide your own implementation for custom adapters (e.g., `fetch`, React Native Networking) or for test mocking:

```ts
import type { IHttpClient, HttpRequestConfig, HttpResponse } from '@wallet/backup-backend';

class MyFetchHttpClient implements IHttpClient {
  async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const res = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json() as T;
      return { status: res.status, data };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

const client = new BackendBackupClient(config, new MyFetchHttpClient());
```

---

## Project Structure

```
src/
├── types.ts              # Public interfaces & internal HTTP types
├── errors/
│   └── index.ts          # BackendAuthError, BackendNetworkError, BackendValidationError
├── http/
│   └── httpClient.ts     # IHttpClient interface + AxiosHttpClient (Axios + axios-retry)
├── backendClient.ts      # BackendBackupClient — the main public class
└── index.ts              # Public barrel export
```

---

## Development

```bash
# Install dependencies
npm install

# Type-check (zero errors expected)
npm run typecheck

# Run tests (47 tests)
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Watch mode (development)
npm run dev

# Clean build artifacts
npm run clean
```

---

## Deployment / Publishing

1. **Build the package:**
   ```bash
   npm run build
   ```

2. **Verify the output:**
   ```bash
   ls dist/
   # index.js  index.d.ts  index.js.map  index.d.ts.map
   # backendClient.js  errors/  http/  types.js  ...
   ```

3. **Publish to npm (scoped):**
   ```bash
   # Ensure you are logged in
   npm login

   # First publish (scoped packages default to private)
   npm publish --access public

   # Subsequent releases — bump the version first
   npm version patch   # or minor / major
   npm publish --access public
   ```

4. **Using in a monorepo (local linking):**
   ```bash
   # From the wallet-app repo
   npm install ../wallet-backup-backend
   # or with workspaces / turborepo — reference the package by name
   ```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `axios` | `^1.7` | Cross-platform HTTP client (Node, Web, RN — no native APIs) |
| `axios-retry` | `^4` | Exponential-backoff retry on network errors and 5xx |
| `zod` | `^3` | Runtime response-shape validation |

---

## License

MIT
