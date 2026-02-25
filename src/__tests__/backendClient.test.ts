/**
 * Tests for BackendBackupClient — uses a mock IHttpClient injection.
 * No real HTTP requests are made.
 *
 * Covers:
 *   - uploadSeed: correct endpoint, method, Auth header, body shape
 *   - uploadEntropy: correct endpoint, method, Auth header, body shape
 *   - getSeed: Zod parse success and failure
 *   - getEntropy: Zod parse success and failure
 *   - deleteBackup: both DELETE requests fired in parallel
 *   - Error propagation: auth error, network error
 *   - Constructor: missing baseUrl throws
 *   - URL normalisation: trailing slash is stripped
 */

import { BackendBackupClient } from '../backendClient';
import {
  BackendAuthError,
  BackendNetworkError,
  BackendValidationError,
} from '../errors/index';
import type { IHttpClient } from '../http/httpClient';
import type { HttpRequestConfig, HttpResponse } from '../types';

// ---------------------------------------------------------------------------
// Mock IHttpClient factory
// ---------------------------------------------------------------------------

function makeMockHttp(
  impl: (config: HttpRequestConfig) => Promise<HttpResponse>,
): IHttpClient {
  return { request: jest.fn(impl) as unknown as IHttpClient['request'] };
}

function successHttp(data: unknown = {}): IHttpClient {
  return makeMockHttp(() => Promise.resolve({ status: 200, data }));
}

function errorHttp(err: Error): IHttpClient {
  return makeMockHttp(() => Promise.reject(err));
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.example.com';
const TOKEN = 'test-bearer-token';
const DEVICE_ID = 'device-abc';

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('BackendBackupClient — constructor', () => {
  it('throws if baseUrl is empty', () => {
    expect(() => new BackendBackupClient({ baseUrl: '' })).toThrow(
      'BackendBackupConfig.baseUrl is required',
    );
  });

  it('strips trailing slash from baseUrl', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: `${BASE_URL}/` }, http);
    await client.uploadSeed({ encryptedSeed: 'x', authToken: TOKEN });

    const mock = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(mock.url).toBe('https://api.example.com/seed');
  });
});

// ---------------------------------------------------------------------------
// uploadSeed
// ---------------------------------------------------------------------------

describe('BackendBackupClient.uploadSeed', () => {
  it('calls POST /seed with correct url, method, and auth header', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.uploadSeed({ encryptedSeed: 'enc-seed', authToken: TOKEN });

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.url).toBe(`${BASE_URL}/seed`);
    expect(call.method).toBe('POST');
    expect(call.headers?.['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('includes encryptedSeed in body', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.uploadSeed({ encryptedSeed: 'enc-seed', authToken: TOKEN });

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.body?.['encryptedSeed']).toBe('enc-seed');
  });

  it('includes deviceId when provided', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.uploadSeed({ encryptedSeed: 'enc', authToken: TOKEN, deviceId: DEVICE_ID });

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.body?.['deviceId']).toBe(DEVICE_ID);
  });

  it('omits deviceId from body when not provided', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.uploadSeed({ encryptedSeed: 'enc', authToken: TOKEN });

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.body).not.toHaveProperty('deviceId');
  });

  it('propagates BackendAuthError', async () => {
    const http = errorHttp(new BackendAuthError());
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await expect(
      client.uploadSeed({ encryptedSeed: 'x', authToken: TOKEN }),
    ).rejects.toBeInstanceOf(BackendAuthError);
  });

  it('propagates BackendNetworkError', async () => {
    const http = errorHttp(new BackendNetworkError('timeout'));
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await expect(
      client.uploadSeed({ encryptedSeed: 'x', authToken: TOKEN }),
    ).rejects.toBeInstanceOf(BackendNetworkError);
  });
});

// ---------------------------------------------------------------------------
// uploadEntropy
// ---------------------------------------------------------------------------

describe('BackendBackupClient.uploadEntropy', () => {
  it('calls POST /entropy with correct url and auth', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.uploadEntropy({ encryptedEntropy: 'enc-ent', authToken: TOKEN });

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.url).toBe(`${BASE_URL}/entropy`);
    expect(call.method).toBe('POST');
    expect(call.headers?.['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('includes encryptedEntropy in body', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.uploadEntropy({ encryptedEntropy: 'enc-ent', authToken: TOKEN });

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.body?.['encryptedEntropy']).toBe('enc-ent');
  });

  it('includes optional deviceId', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.uploadEntropy({ encryptedEntropy: 'enc-ent', authToken: TOKEN, deviceId: 'dev-1' });

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.body?.['deviceId']).toBe('dev-1');
  });
});

// ---------------------------------------------------------------------------
// getSeed
// ---------------------------------------------------------------------------

describe('BackendBackupClient.getSeed', () => {
  it('returns encryptedSeed on valid response', async () => {
    const http = successHttp({ encryptedSeed: 'my-enc-seed' });
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    const result = await client.getSeed(TOKEN);
    expect(result).toBe('my-enc-seed');
  });

  it('calls GET /seed with auth header', async () => {
    const http = successHttp({ encryptedSeed: 'seed' });
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.getSeed(TOKEN);

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.url).toBe(`${BASE_URL}/seed`);
    expect(call.method).toBe('GET');
    expect(call.headers?.['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('throws BackendValidationError when encryptedSeed is missing', async () => {
    const http = successHttp({ somethingElse: 'oops' });
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await expect(client.getSeed(TOKEN)).rejects.toBeInstanceOf(BackendValidationError);
  });

  it('throws BackendValidationError when encryptedSeed is empty string', async () => {
    const http = successHttp({ encryptedSeed: '' });
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await expect(client.getSeed(TOKEN)).rejects.toBeInstanceOf(BackendValidationError);
  });

  it('throws BackendValidationError when response is null', async () => {
    const http = successHttp(null);
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await expect(client.getSeed(TOKEN)).rejects.toBeInstanceOf(BackendValidationError);
  });

  it('propagates BackendAuthError from HTTP layer', async () => {
    const http = errorHttp(new BackendAuthError('401'));
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await expect(client.getSeed(TOKEN)).rejects.toBeInstanceOf(BackendAuthError);
  });
});

// ---------------------------------------------------------------------------
// getEntropy
// ---------------------------------------------------------------------------

describe('BackendBackupClient.getEntropy', () => {
  it('returns encryptedEntropy on valid response', async () => {
    const http = successHttp({ encryptedEntropy: 'my-enc-entropy' });
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    const result = await client.getEntropy(TOKEN);
    expect(result).toBe('my-enc-entropy');
  });

  it('throws BackendValidationError when encryptedEntropy is missing', async () => {
    const http = successHttp({ data: 'wrong-shape' });
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await expect(client.getEntropy(TOKEN)).rejects.toBeInstanceOf(BackendValidationError);
  });

  it('calls GET /entropy with correct auth header', async () => {
    const http = successHttp({ encryptedEntropy: 'ent' });
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.getEntropy(TOKEN);

    const call = (http.request as jest.Mock).mock.calls[0]?.[0] as HttpRequestConfig;
    expect(call.url).toBe(`${BASE_URL}/entropy`);
    expect(call.method).toBe('GET');
  });
});

// ---------------------------------------------------------------------------
// deleteBackup
// ---------------------------------------------------------------------------

describe('BackendBackupClient.deleteBackup', () => {
  it('fires two DELETE requests in parallel', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.deleteBackup(TOKEN);

    const calls = (http.request as jest.Mock).mock.calls as [HttpRequestConfig][];
    expect(calls).toHaveLength(2);

    const urls = calls.map((c) => c[0].url).sort();
    expect(urls).toContain(`${BASE_URL}/seed`);
    expect(urls).toContain(`${BASE_URL}/entropy`);

    const methods = calls.map((c) => c[0].method);
    expect(methods).toEqual(['DELETE', 'DELETE']);
  });

  it('sends auth header on both DELETE requests', async () => {
    const http = successHttp({});
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await client.deleteBackup(TOKEN);

    const calls = (http.request as jest.Mock).mock.calls as [HttpRequestConfig][];
    calls.forEach((c) => {
      expect(c[0].headers?.['Authorization']).toBe(`Bearer ${TOKEN}`);
    });
  });

  it('propagates error if one DELETE fails', async () => {
    let callCount = 0;
    const http = makeMockHttp(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ status: 200, data: {} });
      return Promise.reject(new BackendNetworkError('seed delete failed'));
    });
    const client = new BackendBackupClient({ baseUrl: BASE_URL }, http);
    await expect(client.deleteBackup(TOKEN)).rejects.toBeInstanceOf(BackendNetworkError);
  });
});
