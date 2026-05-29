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
  newOpenClawObject,
  newOpenClawSecretObject,
  OpenClawCredentialInput,
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
});
