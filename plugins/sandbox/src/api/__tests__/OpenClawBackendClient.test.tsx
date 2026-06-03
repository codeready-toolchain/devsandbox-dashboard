/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ConfigApi } from '@backstage/core-plugin-api';
import { OpenClawBackendClient } from '../OpenClawBackendClient';
import { SecureFetchApi } from '../SecureFetchClient';

const createMockResponse = (options: {
  ok: boolean;
  status?: number;
  json?: () => Promise<any>;
}): Response => {
  const { ok, status = 200, json } = options;
  return {
    ok,
    status,
    statusText: '',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: 'http://mock',
    json: json || (() => Promise.resolve({})),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    bodyUsed: false,
    body: null,
    clone: function () {
      return this;
    },
  } as Response;
};

describe('OpenClawBackendClient', () => {
  let mockConfigApi: jest.Mocked<ConfigApi>;
  let mockSecureFetchApi: jest.Mocked<SecureFetchApi>;
  let client: OpenClawBackendClient;
  const mockKubeApi = 'http://kube-api';
  const devNs = 'user-dev';
  const clawNs = 'user-claw';

  beforeEach(() => {
    mockConfigApi = {
      getString: jest.fn(),
      getOptionalString: jest.fn(),
    } as any;

    mockSecureFetchApi = {
      fetch: jest.fn(),
    } as any;

    client = new OpenClawBackendClient({
      configApi: mockConfigApi,
      secureFetchApi: mockSecureFetchApi,
    });

    mockConfigApi.getString.mockReturnValue(mockKubeApi);
  });

  describe('setupWorkspaceEnvironment', () => {
    it('creates SA, RoleBindings, and NetworkPolicy', async () => {
      mockSecureFetchApi.fetch.mockResolvedValue(
        createMockResponse({ ok: true }),
      );

      await client.setupWorkspaceEnvironment(devNs, clawNs);

      // SA is created first (sequential), then 3 parallel calls
      expect(mockSecureFetchApi.fetch).toHaveBeenCalledTimes(4);

      const calls = mockSecureFetchApi.fetch.mock.calls;

      // First call: ServiceAccount
      expect(calls[0][0]).toContain(
        `/api/v1/namespaces/${devNs}/serviceaccounts`,
      );
      expect(calls[0][1]).toMatchObject({ method: 'POST' });

      // Subsequent calls include rolebindings and networkpolicies
      const urls = calls.slice(1).map(c => c[0] as string);
      expect(urls).toEqual(
        expect.arrayContaining([
          expect.stringContaining('/rolebindings'),
          expect.stringContaining('/networkpolicies'),
        ]),
      );
    });

    it('succeeds on 409 (already exists)', async () => {
      mockSecureFetchApi.fetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 409 }),
      );

      await expect(
        client.setupWorkspaceEnvironment(devNs, clawNs),
      ).resolves.not.toThrow();
    });

    it('throws on non-409 errors', async () => {
      mockSecureFetchApi.fetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ message: 'Forbidden' }),
        }),
      );

      await expect(
        client.setupWorkspaceEnvironment(devNs, clawNs),
      ).rejects.toThrow();
    });
  });

  describe('createWorkspaceKubeconfig', () => {
    it('fetches CA, mints token, and creates kubeconfig secret', async () => {
      const caConfigMap = { data: { 'ca.crt': '-----BEGIN CERTIFICATE-----' } };
      const tokenResponse = { status: { token: 'sa-token-abc' } };

      mockSecureFetchApi.fetch.mockImplementation(
        async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString();
          if (urlStr.includes('/configmaps/kube-root-ca.crt')) {
            return createMockResponse({
              ok: true,
              json: () => Promise.resolve(caConfigMap),
            });
          }
          if (urlStr.includes('/serviceaccounts/claw-workspace/token')) {
            return createMockResponse({
              ok: true,
              json: () => Promise.resolve(tokenResponse),
            });
          }
          // Secret creation (POST or PUT)
          return createMockResponse({ ok: true });
        },
      );

      await client.createWorkspaceKubeconfig(devNs, clawNs);

      expect(mockSecureFetchApi.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/configmaps/kube-root-ca.crt'),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(mockSecureFetchApi.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/serviceaccounts/claw-workspace/token'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockSecureFetchApi.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/namespaces/${clawNs}/secrets`),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws when TokenRequest returns no token', async () => {
      mockSecureFetchApi.fetch.mockImplementation(
        async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString();
          if (urlStr.includes('/configmaps/')) {
            return createMockResponse({
              ok: true,
              json: () => Promise.resolve({ data: {} }),
            });
          }
          if (urlStr.includes('/token')) {
            return createMockResponse({
              ok: true,
              json: () => Promise.resolve({ status: {} }),
            });
          }
          return createMockResponse({ ok: true });
        },
      );

      await expect(
        client.createWorkspaceKubeconfig(devNs, clawNs),
      ).rejects.toThrow('TokenRequest returned no token');
    });

    it('proceeds without CA data when ConfigMap fetch fails', async () => {
      const tokenResponse = { status: { token: 'sa-token-abc' } };

      mockSecureFetchApi.fetch.mockImplementation(
        async (url: string | URL | Request) => {
          const urlStr = typeof url === 'string' ? url : url.toString();
          if (urlStr.includes('/configmaps/')) {
            return createMockResponse({ ok: false, status: 404 });
          }
          if (urlStr.includes('/token')) {
            return createMockResponse({
              ok: true,
              json: () => Promise.resolve(tokenResponse),
            });
          }
          return createMockResponse({ ok: true });
        },
      );

      await expect(
        client.createWorkspaceKubeconfig(devNs, clawNs),
      ).resolves.not.toThrow();
    });
  });

  describe('cleanupWorkspaceEnvironment', () => {
    it('deletes SA, RoleBindings, and NetworkPolicy', async () => {
      mockSecureFetchApi.fetch.mockResolvedValue(
        createMockResponse({ ok: true }),
      );

      await client.cleanupWorkspaceEnvironment(devNs);

      expect(mockSecureFetchApi.fetch).toHaveBeenCalledTimes(4);
      const urls = mockSecureFetchApi.fetch.mock.calls.map(c => c[0] as string);
      expect(urls).toEqual(
        expect.arrayContaining([
          expect.stringContaining('/serviceaccounts/claw-workspace'),
          expect.stringContaining('/rolebindings/claw-workspace-edit'),
          expect.stringContaining('/rolebindings/claw-workspace-rbac-edit'),
          expect.stringContaining('/networkpolicies/allow-from-claw-namespace'),
        ]),
      );
    });

    it('succeeds on 404 (already gone)', async () => {
      mockSecureFetchApi.fetch.mockResolvedValue(
        createMockResponse({ ok: false, status: 404 }),
      );

      await expect(
        client.cleanupWorkspaceEnvironment(devNs),
      ).resolves.not.toThrow();
    });
  });
});
