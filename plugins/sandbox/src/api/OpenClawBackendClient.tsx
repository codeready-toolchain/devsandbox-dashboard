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
import { errorMessage } from '../utils/common';
import {
  newOpenClawObject,
  newOpenClawSecretObject,
  newSpaceRequestObject,
  OpenClawCredentialInput,
  OpenClawCustomProviderInput,
} from '../utils/openclaw-utils';
import { OpenClawItem, SpaceRequestItem } from '../types';
import { AddedCredential, ProviderConfig } from '../utils/openclaw-providers';
import { SecureFetchApi } from './SecureFetchClient';

export type OpenClawBackendClientOptions = {
  configApi: ConfigApi;
  secureFetchApi: SecureFetchApi;
};

export interface OpenClawService {
  getSpaceRequest(namespace: string): Promise<SpaceRequestItem | undefined>;
  createSpaceRequest(namespace: string): Promise<void>;
  deleteSpaceRequest(namespace: string): Promise<void>;
  getOpenClaw(namespace: string): Promise<OpenClawItem | undefined>;
  createOpenClaw(
    namespace: string,
    credentials: AddedCredential[],
    disableDevicePairing: boolean,
  ): Promise<void>;
  unIdleOpenClaw(namespace: string): Promise<void>;
  deleteOpenClawCR(namespace: string): Promise<void>;
}

export class OpenClawBackendClient implements OpenClawService {
  private static readonly CLAW_NAME = 'claw';
  private static readonly CUSTOM_LLM_NAME = 'custom-llm';

  private readonly configApi: ConfigApi;
  private readonly secureFetchApi: SecureFetchApi;

  constructor(options: OpenClawBackendClientOptions) {
    this.configApi = options.configApi;
    this.secureFetchApi = options.secureFetchApi;
  }

  private get kubeAPI(): string {
    return this.configApi.getString('sandbox.kubeAPI');
  }

  getSpaceRequest = async (
    namespace: string,
  ): Promise<SpaceRequestItem | undefined> => {
    const kubeApi = this.kubeAPI;
    const url = `/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${namespace}/spacerequests/claw`;
    const response = await this.secureFetchApi.fetch(`${kubeApi}${url}`, {
      method: 'GET',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return undefined;
      }
      const error = await response.json();
      throw new Error(errorMessage(error));
    }
    return response.json();
  };

  createSpaceRequest = async (namespace: string): Promise<void> => {
    const kubeApi = this.kubeAPI;
    const url = `/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${namespace}/spacerequests`;
    const response = await this.secureFetchApi.fetch(`${kubeApi}${url}`, {
      method: 'POST',
      body: newSpaceRequestObject(namespace),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok && response.status !== 409) {
      const error = await response.json();
      throw new Error(errorMessage(error));
    }
  };

  deleteSpaceRequest = async (namespace: string): Promise<void> => {
    const kubeApi = this.kubeAPI;
    const url = `/apis/toolchain.dev.openshift.com/v1alpha1/namespaces/${namespace}/spacerequests/claw`;
    const response = await this.secureFetchApi.fetch(`${kubeApi}${url}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(errorMessage(error));
    }
  };

  getOpenClaw = async (
    namespace: string,
  ): Promise<OpenClawItem | undefined> => {
    const kubeApi = this.kubeAPI;
    const url = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${OpenClawBackendClient.CLAW_NAME}`;
    const response = await this.secureFetchApi.fetch(`${kubeApi}${url}`, {
      method: 'GET',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return undefined;
      }
      const error = await response.json();
      throw new Error(errorMessage(error));
    }
    return response.json();
  };

  private static extractHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  private static secretKeyForProvider(config: ProviderConfig): string {
    if (config.credentialType === 'gcp') {
      return `${config.id}-sa-key.json`;
    }
    return `${config.id}-api-key`;
  }

  private static buildSecretData(
    cred: AddedCredential,
  ): Record<string, string> {
    const config = cred.provider;
    const secretKey = OpenClawBackendClient.secretKeyForProvider(config);

    if (config.credentialType === 'gcp') {
      const saKey = cred.values['sa-key.json'];
      return saKey ? { [secretKey]: saKey } : {};
    }

    const apiKey = cred.values['api-key'];
    if (apiKey) {
      return { [secretKey]: apiKey };
    }
    return {};
  }

  private static buildCredentialInput(
    cred: AddedCredential,
    secretName: string,
  ): OpenClawCredentialInput {
    const config = cred.provider;
    const secretKey = OpenClawBackendClient.secretKeyForProvider(config);

    const base: OpenClawCredentialInput = {
      name: config.id,
      type: config.credentialType,
      secretName,
      secretKeys: [secretKey],
    };

    if (config.credentialType === 'gcp') {
      return {
        ...base,
        name: config.id === 'anthropic-vertex' ? 'anthropic-vertex' : 'gemini',
        provider: config.provider,
        gcp: {
          project: cred.values['project-id'] ?? '',
          location: cred.values['region'] ?? '',
        },
      };
    }

    if (config.id === 'custom') {
      const endpointUrl = cred.values['endpoint-url'] ?? '';
      const apiKey = cred.values['api-key'];
      return {
        ...base,
        name: OpenClawBackendClient.CUSTOM_LLM_NAME,
        type: apiKey ? 'bearer' : 'none',
        domain: OpenClawBackendClient.extractHostname(endpointUrl),
        secretKeys: apiKey ? [secretKey] : [],
      };
    }

    return {
      ...base,
      provider: config.provider,
      domain: config.domain,
    };
  }

  private static buildCustomProvider(
    cred: AddedCredential,
  ): OpenClawCustomProviderInput | undefined {
    if (cred.provider.id !== 'custom') return undefined;

    const endpointUrl = cred.values['endpoint-url'] ?? '';
    const apiFormat = cred.values['api-format'];
    const modelName = cred.values['model-name'] ?? '';
    const displayName = cred.values['display-name'];

    return {
      name: OpenClawBackendClient.CUSTOM_LLM_NAME,
      baseUrl: endpointUrl,
      api: apiFormat !== 'openai-completions' ? apiFormat : undefined,
      credentialRef: OpenClawBackendClient.CUSTOM_LLM_NAME,
      models: [
        {
          name: modelName,
          alias: displayName || undefined,
        },
      ],
    };
  }

  private static resolveWebSearchProvider(
    credentials: AddedCredential[],
  ): string | undefined {
    const hasStandardProvider = credentials.some(
      c => c.provider.id !== 'custom',
    );
    if (!hasStandardProvider) return undefined;

    const hasGoogleApiKey = credentials.some(
      c =>
        c.provider.provider === 'google' && c.provider.credentialType !== 'gcp',
    );
    return hasGoogleApiKey ? 'gemini' : 'duckduckgo';
  }

  private async createOrUpdateSecret(
    basePath: string,
    name: string,
    body: string,
  ): Promise<void> {
    const response = await this.secureFetchApi.fetch(basePath, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) return;

    if (response.status === 409) {
      const updateResponse = await this.secureFetchApi.fetch(
        `${basePath}/${name}`,
        {
          method: 'PUT',
          body,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(errorMessage(error));
      }
      return;
    }

    const error = await response.json();
    throw new Error(errorMessage(error));
  }

  createOpenClaw = async (
    namespace: string,
    credentials: AddedCredential[],
    disableDevicePairing: boolean,
  ): Promise<void> => {
    const kubeApi = this.kubeAPI;
    const secretsBasePath = `${kubeApi}/api/v1/namespaces/${namespace}/secrets`;
    const secretName = 'llm-key';
    const createdSecrets: string[] = [];

    const mergedSecretData: Record<string, string> = {};
    for (const cred of credentials) {
      const data = OpenClawBackendClient.buildSecretData(cred);
      Object.assign(mergedSecretData, data);
    }

    if (Object.keys(mergedSecretData).length > 0) {
      const secretBody = newOpenClawSecretObject(
        namespace,
        secretName,
        mergedSecretData,
      );
      await this.createOrUpdateSecret(secretsBasePath, secretName, secretBody);
      createdSecrets.push(secretName);
    }

    try {
      const credentialInputs: OpenClawCredentialInput[] = credentials.map(
        cred => OpenClawBackendClient.buildCredentialInput(cred, secretName),
      );

      const customProviders: OpenClawCustomProviderInput[] = credentials
        .map(cred => OpenClawBackendClient.buildCustomProvider(cred))
        .filter((cp): cp is OpenClawCustomProviderInput => cp !== undefined);

      const webSearchProvider =
        OpenClawBackendClient.resolveWebSearchProvider(credentials);

      const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws`;
      const clawResponse = await this.secureFetchApi.fetch(
        `${kubeApi}${clawUrl}`,
        {
          method: 'POST',
          body: newOpenClawObject({
            namespace,
            name: OpenClawBackendClient.CLAW_NAME,
            credentials: credentialInputs,
            disableDevicePairing,
            customProviders:
              customProviders.length > 0 ? customProviders : undefined,
            webSearchProvider,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!clawResponse.ok && clawResponse.status !== 409) {
        const error = await clawResponse.json();
        throw new Error(errorMessage(error));
      }
    } catch (err) {
      for (const name of createdSecrets) {
        try {
          await this.secureFetchApi.fetch(`${secretsBasePath}/${name}`, {
            method: 'DELETE',
          });
        } catch {
          // Best-effort cleanup; don't shadow the original error
        }
      }
      throw err;
    }
  };

  unIdleOpenClaw = async (namespace: string): Promise<void> => {
    const kubeApi = this.kubeAPI;
    const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${OpenClawBackendClient.CLAW_NAME}`;
    const response = await this.secureFetchApi.fetch(`${kubeApi}${clawUrl}`, {
      method: 'PATCH',
      body: JSON.stringify({
        spec: {
          idle: false,
        },
      }),
      headers: {
        'Content-Type': 'application/merge-patch+json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(errorMessage(error));
    }
  };

  deleteOpenClawCR = async (namespace: string): Promise<void> => {
    const kubeApi = this.kubeAPI;

    const clawData = await this.getOpenClaw(namespace);
    const secretNames = new Set<string>();
    if (clawData?.spec?.credentials) {
      for (const cred of clawData.spec.credentials) {
        for (const ref of cred.secretRef) {
          secretNames.add(ref.name);
        }
      }
    }
    const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${OpenClawBackendClient.CLAW_NAME}`;
    const clawResponse = await this.secureFetchApi.fetch(
      `${kubeApi}${clawUrl}`,
      {
        method: 'DELETE',
      },
    );

    if (!clawResponse.ok && clawResponse.status !== 404) {
      const error = await clawResponse.json();
      throw new Error(errorMessage(error));
    }

    for (const name of secretNames) {
      const secretUrl = `/api/v1/namespaces/${namespace}/secrets/${name}`;
      const secretResponse = await this.secureFetchApi.fetch(
        `${kubeApi}${secretUrl}`,
        {
          method: 'DELETE',
        },
      );

      if (!secretResponse.ok && secretResponse.status !== 404) {
        const error = await secretResponse.json();
        throw new Error(errorMessage(error));
      }
    }
  };
}
