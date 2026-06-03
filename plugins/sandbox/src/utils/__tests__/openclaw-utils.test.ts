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

import {
  buildKubeconfig,
  newEditRoleBindingObject,
  newNetworkPolicyObject,
  newOpenClawObject,
  newOpenClawSecretObject,
  newRbacEditRoleBindingObject,
  newServiceAccountObject,
  newTokenRequestObject,
  OpenClawCredentialInput,
  SA_NAME,
  TOKEN_EXPIRATION_SECONDS,
} from '../openclaw-utils';

describe('openclaw-utils', () => {
  describe('newOpenClawObject', () => {
    it('creates a Claw CR with a Gemini apiKey credential', () => {
      const credentials: OpenClawCredentialInput[] = [
        {
          name: 'gemini',
          type: 'apiKey',
          provider: 'google',
          secretName: 'llm-key',
          secretKeys: ['api-key'],
        },
      ];

      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'test-ns',
          name: 'claw',
          credentials,
          disableDevicePairing: false,
        }),
      );

      expect(result.apiVersion).toBe('claw.sandbox.redhat.com/v1alpha1');
      expect(result.kind).toBe('Claw');
      expect(result.metadata.namespace).toBe('test-ns');
      expect(result.metadata.name).toBe('claw');
      expect(result.spec.credentials).toHaveLength(1);
      expect(result.spec.credentials[0]).toEqual({
        name: 'gemini',
        type: 'apiKey',
        secretRef: [{ name: 'llm-key', key: 'api-key' }],
        provider: 'google',
      });
      expect(result.spec.auth.disableDevicePairing).toBe(false);
    });

    it('creates a Claw CR with bearer credential including domain', () => {
      const credentials: OpenClawCredentialInput[] = [
        {
          name: 'openai',
          type: 'bearer',
          provider: 'openai',
          domain: 'api.openai.com',
          secretName: 'llm-key',
          secretKeys: ['api-key'],
        },
      ];

      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'test-ns',
          name: 'claw',
          credentials,
          disableDevicePairing: false,
        }),
      );

      expect(result.spec.credentials[0]).toEqual({
        name: 'openai',
        type: 'bearer',
        secretRef: [{ name: 'llm-key', key: 'api-key' }],
        provider: 'openai',
        domain: 'api.openai.com',
      });
    });

    it('creates a Claw CR with gcp credential including gcp block', () => {
      const credentials: OpenClawCredentialInput[] = [
        {
          name: 'gemini',
          type: 'gcp',
          provider: 'google',
          secretName: 'llm-key',
          secretKeys: ['sa-key.json'],
          gcp: { project: 'my-project-123', location: 'us-central1' },
        },
      ];

      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'test-ns',
          name: 'claw',
          credentials,
          disableDevicePairing: false,
        }),
      );

      expect(result.spec.credentials[0].type).toBe('gcp');
      expect(result.spec.credentials[0].gcp).toEqual({
        project: 'my-project-123',
        location: 'us-central1',
      });
      expect(result.spec.credentials[0].secretRef).toEqual([
        { name: 'llm-key', key: 'sa-key.json' },
      ]);
    });

    it('includes customProviders when provided', () => {
      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'ns',
          name: 'claw',
          credentials: [],
          disableDevicePairing: false,
          customProviders: [
            {
              name: 'custom-llm',
              baseUrl: 'https://llm.mycompany.com/v1',
              credentialRef: 'custom-llm',
              models: [{ name: 'qwen3-14b', alias: 'Qwen 3 14B' }],
            },
          ],
        }),
      );

      expect(result.spec.customProviders).toHaveLength(1);
      expect(result.spec.customProviders[0].baseUrl).toBe(
        'https://llm.mycompany.com/v1',
      );
    });

    it('includes webSearch provider when provided', () => {
      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'ns',
          name: 'claw',
          credentials: [],
          disableDevicePairing: false,
          webSearchProvider: 'duckduckgo',
        }),
      );

      expect(result.spec.webSearch).toEqual({ provider: 'duckduckgo' });
    });

    it('sets disableDevicePairing correctly', () => {
      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'ns',
          name: 'claw',
          credentials: [],
          disableDevicePairing: true,
        }),
      );
      expect(result.spec.auth.disableDevicePairing).toBe(true);
    });

    it('omits domain and gcp when not provided', () => {
      const credentials: OpenClawCredentialInput[] = [
        {
          name: 'gemini',
          type: 'apiKey',
          provider: 'google',
          secretName: 'llm-key',
          secretKeys: ['api-key'],
        },
      ];

      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'ns',
          name: 'claw',
          credentials,
          disableDevicePairing: false,
        }),
      );

      expect(result.spec.credentials[0]).not.toHaveProperty('domain');
      expect(result.spec.credentials[0]).not.toHaveProperty('gcp');
    });
  });

  describe('newOpenClawSecretObject', () => {
    it('creates a secret with a single key', () => {
      const result = JSON.parse(
        newOpenClawSecretObject('test-ns', 'my-secret', {
          'api-key': 'sk-test-123',
        }),
      );

      expect(result.apiVersion).toBe('v1');
      expect(result.kind).toBe('Secret');
      expect(result.metadata.namespace).toBe('test-ns');
      expect(result.metadata.name).toBe('my-secret');
      expect(result.stringData).toEqual({ 'api-key': 'sk-test-123' });
    });

    it('creates a secret with multiple keys', () => {
      const result = JSON.parse(
        newOpenClawSecretObject('test-ns', 'vertex-secret', {
          'service-account-json': '{"type":"service_account"}',
          'project-id': 'my-project',
          region: 'us-central1',
        }),
      );

      expect(result.stringData).toEqual({
        'service-account-json': '{"type":"service_account"}',
        'project-id': 'my-project',
        region: 'us-central1',
      });
    });

    it('includes claw labels with default instance name', () => {
      const result = JSON.parse(
        newOpenClawSecretObject('ns', 'secret', { key: 'val' }),
      );

      expect(result.metadata.labels['app.kubernetes.io/name']).toBe('claw');
      expect(result.metadata.labels['claw.sandbox.redhat.com/instance']).toBe(
        'claw',
      );
    });

    it('includes claw labels with custom instance name', () => {
      const result = JSON.parse(
        newOpenClawSecretObject('ns', 'secret', { key: 'val' }, 'my-claw'),
      );

      expect(result.metadata.labels['claw.sandbox.redhat.com/instance']).toBe(
        'my-claw',
      );
    });
  });

  describe('newOpenClawObject with workspace and skills', () => {
    it('includes workspace when provided', () => {
      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'ns',
          name: 'claw',
          credentials: [],
          disableDevicePairing: false,
          workspace: {
            skipBootstrap: true,
            files: { 'SOUL.md': 'soul content' },
          },
        }),
      );

      expect(result.spec.workspace).toEqual({
        skipBootstrap: true,
        files: { 'SOUL.md': 'soul content' },
      });
    });

    it('includes skills when provided', () => {
      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'ns',
          name: 'claw',
          credentials: [],
          disableDevicePairing: false,
          skills: { 'dev-sandbox': 'skill content' },
        }),
      );

      expect(result.spec.skills).toEqual({
        'dev-sandbox': 'skill content',
      });
    });

    it('omits workspace and skills when not provided', () => {
      const result = JSON.parse(
        newOpenClawObject({
          namespace: 'ns',
          name: 'claw',
          credentials: [],
          disableDevicePairing: false,
        }),
      );

      expect(result.spec).not.toHaveProperty('workspace');
      expect(result.spec).not.toHaveProperty('skills');
    });
  });

  describe('newServiceAccountObject', () => {
    it('creates a ServiceAccount with the correct name and labels', () => {
      const result = JSON.parse(newServiceAccountObject('user-dev'));

      expect(result.apiVersion).toBe('v1');
      expect(result.kind).toBe('ServiceAccount');
      expect(result.metadata.namespace).toBe('user-dev');
      expect(result.metadata.name).toBe(SA_NAME);
      expect(result.metadata.labels['app.kubernetes.io/managed-by']).toBe(
        'devsandbox-dashboard',
      );
    });
  });

  describe('newEditRoleBindingObject', () => {
    it('binds the SA to the edit ClusterRole', () => {
      const result = JSON.parse(newEditRoleBindingObject('user-dev'));

      expect(result.kind).toBe('RoleBinding');
      expect(result.metadata.name).toBe('claw-workspace-edit');
      expect(result.roleRef).toEqual({
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'edit',
      });
      expect(result.subjects[0]).toEqual({
        kind: 'ServiceAccount',
        name: SA_NAME,
        namespace: 'user-dev',
      });
    });
  });

  describe('newRbacEditRoleBindingObject', () => {
    it('binds the SA to the rbac-edit Role', () => {
      const result = JSON.parse(newRbacEditRoleBindingObject('user-dev'));

      expect(result.kind).toBe('RoleBinding');
      expect(result.metadata.name).toBe('claw-workspace-rbac-edit');
      expect(result.roleRef).toEqual({
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'rbac-edit',
      });
    });
  });

  describe('newNetworkPolicyObject', () => {
    it('allows ingress from the claw namespace', () => {
      const result = JSON.parse(
        newNetworkPolicyObject('user-dev', 'user-claw'),
      );

      expect(result.kind).toBe('NetworkPolicy');
      expect(result.metadata.namespace).toBe('user-dev');
      expect(result.metadata.name).toBe('allow-from-claw-namespace');
      expect(result.spec.ingress[0].from[0].namespaceSelector).toEqual({
        matchLabels: { 'kubernetes.io/metadata.name': 'user-claw' },
      });
      expect(result.spec.podSelector).toEqual({});
      expect(result.spec.policyTypes).toEqual(['Ingress']);
    });
  });

  describe('newTokenRequestObject', () => {
    it('creates a TokenRequest with the correct expiration', () => {
      const result = JSON.parse(newTokenRequestObject());

      expect(result.apiVersion).toBe('authentication.k8s.io/v1');
      expect(result.kind).toBe('TokenRequest');
      expect(result.spec.expirationSeconds).toBe(TOKEN_EXPIRATION_SECONDS);
    });
  });

  describe('buildKubeconfig', () => {
    it('builds a kubeconfig with CA data', () => {
      const result = JSON.parse(
        buildKubeconfig({
          server: 'https://api.cluster.example.com:6443',
          caData: 'base64-ca-cert',
          token: 'my-token',
          namespace: 'user-dev',
        }),
      );

      expect(result.apiVersion).toBe('v1');
      expect(result.kind).toBe('Config');
      expect(result['current-context']).toBe('workspace');
      expect(result.clusters[0].name).toBe('sandbox');
      expect(result.clusters[0].cluster.server).toBe(
        'https://api.cluster.example.com:6443',
      );
      expect(result.clusters[0].cluster['certificate-authority-data']).toBe(
        'base64-ca-cert',
      );
      expect(result.users[0].user.token).toBe('my-token');
      expect(result.contexts[0].context.namespace).toBe('user-dev');
    });

    it('omits CA data when not provided', () => {
      const result = JSON.parse(
        buildKubeconfig({
          server: 'https://api.cluster.example.com:6443',
          token: 'my-token',
          namespace: 'user-dev',
        }),
      );

      expect(result.clusters[0].cluster).not.toHaveProperty(
        'certificate-authority-data',
      );
    });
  });
});
