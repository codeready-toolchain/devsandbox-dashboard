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
  buildKubeconfig,
  KUBECONFIG_SECRET_NAME,
  NETWORK_POLICY_NAME,
  newEditRoleBindingObject,
  newNetworkPolicyObject,
  newOpenClawObject,
  newOpenClawSecretObject,
  newRbacEditRoleBindingObject,
  newServiceAccountObject,
  newSpaceRequestObject,
  newTokenRequestObject,
  OpenClawCredentialInput,
  OpenClawCustomProviderInput,
  ROLEBINDING_EDIT_NAME,
  ROLEBINDING_RBAC_EDIT_NAME,
  SA_NAME,
} from '../utils/openclaw-utils';
import { OpenClawItem, OpenClawWorkspace, SpaceRequestItem } from '../types';
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
    workspace?: OpenClawWorkspace,
    skills?: Record<string, string>,
  ): Promise<void>;
  unIdleOpenClaw(namespace: string): Promise<void>;
  deleteOpenClawCR(namespace: string): Promise<void>;

  /** Set up the OpenClaw workspace environment in the -dev namespace (SA, RBAC, NetworkPolicy). */
  setupWorkspaceEnvironment(
    devNamespace: string,
    clawNamespace: string,
  ): Promise<void>;

  /** Mint a SA token and create the workspace-kubeconfig secret in the -claw namespace. */
  createWorkspaceKubeconfig(
    devNamespace: string,
    clawNamespace: string,
  ): Promise<void>;

  /** Clean up workspace environment resources from the -dev namespace. */
  cleanupWorkspaceEnvironment(devNamespace: string): Promise<void>;
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
    workspace?: OpenClawWorkspace,
    skills?: Record<string, string>,
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

      if (workspace) {
        credentialInputs.push({
          name: 'k8s-workspace',
          type: 'kubernetes',
          secretName: KUBECONFIG_SECRET_NAME,
          secretKeys: ['kubeconfig'],
        });
      }

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
            workspace,
            skills,
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

  // -----------------------------------------------------------------------
  // Workspace environment setup (Steps 4-7)
  // -----------------------------------------------------------------------

  /**
   * Idempotent POST: creates a resource and silently succeeds on 409
   * (already exists). Used for SA, RoleBinding, and NetworkPolicy.
   */
  private async createIfAbsent(url: string, body: string): Promise<void> {
    const response = await this.secureFetchApi.fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok || response.status === 409) return;

    const error = await response.json();
    throw new Error(errorMessage(error));
  }

  /**
   * Idempotent DELETE: deletes a resource and silently succeeds on 404
   * (already gone).
   */
  private async deleteIfPresent(url: string): Promise<void> {
    const response = await this.secureFetchApi.fetch(url, {
      method: 'DELETE',
    });

    if (response.ok || response.status === 404) return;

    const error = await response.json();
    throw new Error(errorMessage(error));
  }

  setupWorkspaceEnvironment = async (
    devNamespace: string,
    clawNamespace: string,
  ): Promise<void> => {
    const kubeApi = this.kubeAPI;
    const saUrl = `${kubeApi}/api/v1/namespaces/${devNamespace}/serviceaccounts`;
    const rbUrl = `${kubeApi}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings`;
    const npUrl = `${kubeApi}/apis/networking.k8s.io/v1/namespaces/${devNamespace}/networkpolicies`;

    await this.createIfAbsent(saUrl, newServiceAccountObject(devNamespace));

    await Promise.all([
      this.createIfAbsent(rbUrl, newEditRoleBindingObject(devNamespace)),
      this.createIfAbsent(rbUrl, newRbacEditRoleBindingObject(devNamespace)),
      this.createIfAbsent(
        npUrl,
        newNetworkPolicyObject(devNamespace, clawNamespace),
      ),
    ]);
  };

  createWorkspaceKubeconfig = async (
    devNamespace: string,
    clawNamespace: string,
  ): Promise<void> => {
    const kubeApi = this.kubeAPI;

    // Fetch the cluster CA from the kube-root-ca.crt ConfigMap
    let caData: string | undefined;
    try {
      const caUrl = `${kubeApi}/api/v1/namespaces/${devNamespace}/configmaps/kube-root-ca.crt`;
      const caResponse = await this.secureFetchApi.fetch(caUrl, {
        method: 'GET',
      });
      if (caResponse.ok) {
        const caConfigMap = await caResponse.json();
        const caCert: string | undefined = caConfigMap?.data?.['ca.crt'];
        if (caCert) {
          caData = btoa(caCert);
        }
      }
    } catch {
      // Non-fatal: proceed without CA data
    }

    // Mint a long-lived SA token
    const tokenUrl = `${kubeApi}/api/v1/namespaces/${devNamespace}/serviceaccounts/${SA_NAME}/token`;
    const tokenResponse = await this.secureFetchApi.fetch(tokenUrl, {
      method: 'POST',
      body: newTokenRequestObject(),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(errorMessage(error));
    }

    const tokenData = await tokenResponse.json();
    const token: string = tokenData.status?.token;
    if (!token) {
      throw new Error('TokenRequest returned no token');
    }

    // Derive the API server URL from the kubeAPI proxy config.
    // The proxy URL itself is what the SA should target.
    const server = kubeApi;

    const kubeconfigContent = buildKubeconfig({
      server,
      caData,
      token,
      namespace: devNamespace,
    });

    // Create the kubeconfig secret in the -claw namespace
    const secretsBasePath = `${kubeApi}/api/v1/namespaces/${clawNamespace}/secrets`;
    const secretBody = newOpenClawSecretObject(
      clawNamespace,
      KUBECONFIG_SECRET_NAME,
      { kubeconfig: kubeconfigContent },
    );
    await this.createOrUpdateSecret(
      secretsBasePath,
      KUBECONFIG_SECRET_NAME,
      secretBody,
    );
  };

  cleanupWorkspaceEnvironment = async (devNamespace: string): Promise<void> => {
    const kubeApi = this.kubeAPI;

    await Promise.allSettled([
      this.deleteIfPresent(
        `${kubeApi}/apis/networking.k8s.io/v1/namespaces/${devNamespace}/networkpolicies/${NETWORK_POLICY_NAME}`,
      ),
      this.deleteIfPresent(
        `${kubeApi}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings/${ROLEBINDING_RBAC_EDIT_NAME}`,
      ),
      this.deleteIfPresent(
        `${kubeApi}/apis/rbac.authorization.k8s.io/v1/namespaces/${devNamespace}/rolebindings/${ROLEBINDING_EDIT_NAME}`,
      ),
      this.deleteIfPresent(
        `${kubeApi}/api/v1/namespaces/${devNamespace}/serviceaccounts/${SA_NAME}`,
      ),
    ]);
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
