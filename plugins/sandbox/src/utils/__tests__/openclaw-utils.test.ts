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
    it('creates a Claw CR with a single credential', () => {
      const credentials: OpenClawCredentialInput[] = [
        {
          name: 'gemini',
          type: 'apiKey',
          provider: 'google',
          secretName: 'gemini-api-key',
          secretKeys: ['api-key'],
        },
      ];

      const result = JSON.parse(
        newOpenClawObject('test-ns', 'claw', credentials, false),
      );

      expect(result.apiVersion).toBe('claw.sandbox.redhat.com/v1alpha1');
      expect(result.kind).toBe('Claw');
      expect(result.metadata.namespace).toBe('test-ns');
      expect(result.metadata.name).toBe('claw');
      expect(result.spec.credentials).toHaveLength(1);
      expect(result.spec.credentials[0]).toEqual({
        name: 'gemini',
        type: 'apiKey',
        secretRef: [{ name: 'gemini-api-key', key: 'api-key' }],
        provider: 'google',
      });
      expect(result.spec.auth.disableDevicePairing).toBe(false);
    });

    it('creates a Claw CR with multiple credentials', () => {
      const credentials: OpenClawCredentialInput[] = [
        {
          name: 'openai',
          type: 'apiKey',
          provider: 'openai',
          secretName: 'openai-api-key',
          secretKeys: ['api-key'],
        },
        {
          name: 'google-vertex',
          type: 'composite',
          provider: 'google-vertex',
          secretName: 'google-vertex-api-key',
          secretKeys: ['service-account-json', 'project-id', 'region'],
        },
      ];

      const result = JSON.parse(
        newOpenClawObject('test-ns', 'claw', credentials, true),
      );

      expect(result.spec.credentials).toHaveLength(2);
      expect(result.spec.credentials[0].name).toBe('openai');
      expect(result.spec.credentials[0].secretRef).toHaveLength(1);

      expect(result.spec.credentials[1].name).toBe('google-vertex');
      expect(result.spec.credentials[1].secretRef).toHaveLength(3);
      expect(result.spec.credentials[1].secretRef).toEqual([
        { name: 'google-vertex-api-key', key: 'service-account-json' },
        { name: 'google-vertex-api-key', key: 'project-id' },
        { name: 'google-vertex-api-key', key: 'region' },
      ]);

      expect(result.spec.auth.disableDevicePairing).toBe(true);
    });

    it('sets disableDevicePairing correctly', () => {
      const result = JSON.parse(newOpenClawObject('ns', 'claw', [], true));
      expect(result.spec.auth.disableDevicePairing).toBe(true);
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
