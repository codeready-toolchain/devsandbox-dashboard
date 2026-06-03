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
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { OpenClawBackendClient } from '../OpenClawBackendClient';
import { SecureFetchApi } from '../SecureFetchClient';

type RequestRecord = {
  method: string;
  url: string;
  body?: Record<string, unknown>;
};

const KUBE_API = 'http://kube-api';
const DEV_NS = 'user-dev';
const CLAW_NS = 'user-claw';

const server = setupServer();

describe('OpenClawBackendClient', () => {
  let client: OpenClawBackendClient;
  let requestLog: RequestRecord[];

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());

  beforeEach(() => {
    requestLog = [];

    const mockConfigApi: jest.Mocked<ConfigApi> = {
      getString: jest.fn().mockReturnValue(KUBE_API),
      getOptionalString: jest.fn(),
    } as any;

    const secureFetchApi: SecureFetchApi = {
      fetch: (input, init) => fetch(input as RequestInfo, init),
    };

    client = new OpenClawBackendClient({
      configApi: mockConfigApi,
      secureFetchApi,
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  // -------------------------------------------------------------------
  // Handler factories
  // -------------------------------------------------------------------

  const setupHandlers = () => [
    rest.post(
      `${KUBE_API}/api/v1/namespaces/:ns/serviceaccounts`,
      async (req, res, ctx) => {
        requestLog.push({
          method: 'POST',
          url: req.url.toString(),
          body: await req.json(),
        });
        return res(ctx.json({}));
      },
    ),
    rest.post(
      `${KUBE_API}/apis/rbac.authorization.k8s.io/v1/namespaces/:ns/rolebindings`,
      async (req, res, ctx) => {
        requestLog.push({
          method: 'POST',
          url: req.url.toString(),
          body: await req.json(),
        });
        return res(ctx.json({}));
      },
    ),
    rest.post(
      `${KUBE_API}/apis/networking.k8s.io/v1/namespaces/:ns/networkpolicies`,
      async (req, res, ctx) => {
        requestLog.push({
          method: 'POST',
          url: req.url.toString(),
          body: await req.json(),
        });
        return res(ctx.json({}));
      },
    ),
  ];

  const cleanupHandlers = (status = 200) => [
    rest.delete(
      `${KUBE_API}/api/v1/namespaces/:ns/serviceaccounts/:name`,
      (req, res, ctx) => {
        requestLog.push({ method: 'DELETE', url: req.url.toString() });
        return res(ctx.status(status), ctx.json({}));
      },
    ),
    rest.delete(
      `${KUBE_API}/apis/rbac.authorization.k8s.io/v1/namespaces/:ns/rolebindings/:name`,
      (req, res, ctx) => {
        requestLog.push({ method: 'DELETE', url: req.url.toString() });
        return res(ctx.status(status), ctx.json({}));
      },
    ),
    rest.delete(
      `${KUBE_API}/apis/networking.k8s.io/v1/namespaces/:ns/networkpolicies/:name`,
      (req, res, ctx) => {
        requestLog.push({ method: 'DELETE', url: req.url.toString() });
        return res(ctx.status(status), ctx.json({}));
      },
    ),
  ];

  // -------------------------------------------------------------------
  // setupWorkspaceEnvironment
  // -------------------------------------------------------------------

  describe('setupWorkspaceEnvironment', () => {
    it('creates SA, both RoleBindings, and NetworkPolicy', async () => {
      server.use(...setupHandlers());

      await client.setupWorkspaceEnvironment(DEV_NS, CLAW_NS);

      expect(requestLog).toHaveLength(4);

      // ServiceAccount created first (sequential)
      expect(requestLog[0]).toMatchObject({
        method: 'POST',
        url: expect.stringContaining(
          `/api/v1/namespaces/${DEV_NS}/serviceaccounts`,
        ),
        body: expect.objectContaining({
          kind: 'ServiceAccount',
          metadata: expect.objectContaining({ name: 'claw-workspace' }),
        }),
      });

      // Both RoleBindings (order may vary due to Promise.all)
      const rbBodies = requestLog
        .filter(r => r.url.includes('/rolebindings'))
        .map(r => r.body);
      expect(rbBodies).toHaveLength(2);
      expect(rbBodies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              name: 'claw-workspace-edit',
            }),
          }),
          expect.objectContaining({
            metadata: expect.objectContaining({
              name: 'claw-workspace-rbac-edit',
            }),
          }),
        ]),
      );

      // NetworkPolicy
      const npReq = requestLog.find(r => r.url.includes('/networkpolicies'));
      expect(npReq).toBeDefined();
      expect(npReq!.body).toMatchObject({
        kind: 'NetworkPolicy',
        metadata: expect.objectContaining({
          name: 'allow-from-claw-namespace',
        }),
      });
    });

    it('succeeds on 409 (already exists)', async () => {
      server.use(
        ...setupHandlers().map(handler => {
          // Re-create handlers that return 409
          if (handler.info.method === 'POST') {
            return rest.post(
              handler.info.path as string,
              async (_req, res, ctx) => {
                return res(
                  ctx.status(409),
                  ctx.json({ message: 'already exists' }),
                );
              },
            );
          }
          return handler;
        }),
      );

      await expect(
        client.setupWorkspaceEnvironment(DEV_NS, CLAW_NS),
      ).resolves.not.toThrow();
    });

    it('throws on non-409 errors', async () => {
      server.use(
        rest.post(
          `${KUBE_API}/api/v1/namespaces/:ns/serviceaccounts`,
          async (_req, res, ctx) => {
            return res(ctx.status(403), ctx.json({ message: 'Forbidden' }));
          },
        ),
      );

      await expect(
        client.setupWorkspaceEnvironment(DEV_NS, CLAW_NS),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------
  // createWorkspaceKubeconfig
  // -------------------------------------------------------------------

  describe('createWorkspaceKubeconfig', () => {
    const kubeconfigHandlers = ({
      caData = { 'ca.crt': '-----BEGIN CERTIFICATE-----' },
      caStatus = 200,
      tokenPayload = { status: { token: 'sa-token-abc' } } as Record<
        string,
        unknown
      >,
      tokenStatus = 200,
    } = {}) => [
      rest.get(
        `${KUBE_API}/api/v1/namespaces/:ns/configmaps/kube-root-ca.crt`,
        (_req, res, ctx) => {
          requestLog.push({ method: 'GET', url: _req.url.toString() });
          return res(ctx.status(caStatus), ctx.json({ data: caData }));
        },
      ),
      rest.post(
        `${KUBE_API}/api/v1/namespaces/:ns/serviceaccounts/:name/token`,
        (_req, res, ctx) => {
          requestLog.push({ method: 'POST', url: _req.url.toString() });
          return res(ctx.status(tokenStatus), ctx.json(tokenPayload));
        },
      ),
      rest.post(
        `${KUBE_API}/api/v1/namespaces/:ns/secrets`,
        async (req, res, ctx) => {
          requestLog.push({
            method: 'POST',
            url: req.url.toString(),
            body: await req.json(),
          });
          return res(ctx.json({}));
        },
      ),
      rest.put(
        `${KUBE_API}/api/v1/namespaces/:ns/secrets/:name`,
        async (req, res, ctx) => {
          requestLog.push({
            method: 'PUT',
            url: req.url.toString(),
            body: await req.json(),
          });
          return res(ctx.json({}));
        },
      ),
    ];

    it('fetches CA, mints token, and creates kubeconfig secret', async () => {
      server.use(...kubeconfigHandlers());

      await client.createWorkspaceKubeconfig(DEV_NS, CLAW_NS);

      expect(requestLog).toContainEqual(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('/configmaps/kube-root-ca.crt'),
        }),
      );
      expect(requestLog).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/serviceaccounts/claw-workspace/token'),
        }),
      );
      expect(requestLog).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining(`/namespaces/${CLAW_NS}/secrets`),
        }),
      );
    });

    it('throws when TokenRequest returns no token', async () => {
      server.use(
        ...kubeconfigHandlers({
          tokenPayload: { status: {} },
        }),
      );

      await expect(
        client.createWorkspaceKubeconfig(DEV_NS, CLAW_NS),
      ).rejects.toThrow('TokenRequest returned no token');
    });

    it('proceeds without CA data when ConfigMap fetch fails', async () => {
      server.use(...kubeconfigHandlers({ caStatus: 404 }));

      await expect(
        client.createWorkspaceKubeconfig(DEV_NS, CLAW_NS),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------
  // cleanupWorkspaceEnvironment
  // -------------------------------------------------------------------

  describe('cleanupWorkspaceEnvironment', () => {
    it('deletes SA, both RoleBindings, and NetworkPolicy', async () => {
      server.use(...cleanupHandlers());

      await client.cleanupWorkspaceEnvironment(DEV_NS);

      expect(requestLog).toHaveLength(4);
      const urls = requestLog.map(r => r.url);
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
      server.use(...cleanupHandlers(404));

      await expect(
        client.cleanupWorkspaceEnvironment(DEV_NS),
      ).resolves.not.toThrow();
    });

    it('throws AggregateError when some deletions fail', async () => {
      server.use(
        rest.delete(
          `${KUBE_API}/api/v1/namespaces/:ns/serviceaccounts/:name`,
          (_req, res, ctx) => {
            requestLog.push({ method: 'DELETE', url: _req.url.toString() });
            return res(ctx.status(403), ctx.json({ message: 'Forbidden' }));
          },
        ),
        rest.delete(
          `${KUBE_API}/apis/rbac.authorization.k8s.io/v1/namespaces/:ns/rolebindings/:name`,
          (_req, res, ctx) => {
            requestLog.push({ method: 'DELETE', url: _req.url.toString() });
            return res(ctx.status(200), ctx.json({}));
          },
        ),
        rest.delete(
          `${KUBE_API}/apis/networking.k8s.io/v1/namespaces/:ns/networkpolicies/:name`,
          (_req, res, ctx) => {
            requestLog.push({ method: 'DELETE', url: _req.url.toString() });
            return res(ctx.status(200), ctx.json({}));
          },
        ),
      );

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(client.cleanupWorkspaceEnvironment(DEV_NS)).rejects.toThrow(
        /Cleanup of namespace .* had 1 failure/,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ServiceAccount'),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
