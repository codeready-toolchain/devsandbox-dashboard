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
} from '../utils/openclaw-utils';
import { OpenClawItem, SpaceRequestItem } from '../types';
import { AddedCredential } from '../utils/openclaw-providers';
import { SecureFetchApi } from './SecureFetchClient';

export type OpenClawBackendClientOptions = {
  configApi: ConfigApi;
  secureFetchApi: SecureFetchApi;
};

const clawName = 'claw';
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
    const url = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${clawName}`;
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

  createOpenClaw = async (
    namespace: string,
    credentials: AddedCredential[],
    disableDevicePairing: boolean,
  ): Promise<void> => {
    const kubeApi = this.kubeAPI;
    const secretsBasePath = `/api/v1/namespaces/${namespace}/secrets`;
    const createdSecrets: string[] = [];

    for (const cred of credentials) {
      const secretName = `${cred.provider.id}-api-key`;
      const secretData: Record<string, string> = {};

      for (const field of cred.provider.fields) {
        const value = cred.values[field.key];
        if (value) {
          secretData[field.key] = value;
        }
      }

      const secretBody = newOpenClawSecretObject(
        namespace,
        secretName,
        secretData,
      );

      const secretResponse = await this.secureFetchApi.fetch(
        `${kubeApi}${secretsBasePath}`,
        {
          method: 'POST',
          body: secretBody,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (secretResponse.ok) {
        createdSecrets.push(secretName);
      } else if (secretResponse.status === 409) {
        const updateResponse = await this.secureFetchApi.fetch(
          `${kubeApi}${secretsBasePath}/${secretName}`,
          {
            method: 'PUT',
            body: secretBody,
            headers: { 'Content-Type': 'application/json' },
          },
        );
        if (!updateResponse.ok) {
          const error = await updateResponse.json();
          throw new Error(errorMessage(error));
        }
        createdSecrets.push(secretName);
      } else {
        const error = await secretResponse.json();
        throw new Error(errorMessage(error));
      }
    }

    try {
      const credentialInputs: OpenClawCredentialInput[] = credentials.map(
        cred => {
          const secretKeys = cred.provider.fields
            .filter(field => cred.values[field.key])
            .map(field => field.key);
          return {
            name: cred.provider.id,
            type: cred.provider.fields.length === 1 ? 'apiKey' : 'composite',
            provider: cred.provider.provider,
            secretName: `${cred.provider.id}-api-key`,
            secretKeys,
          };
        },
      );

      const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws`;
      const clawResponse = await this.secureFetchApi.fetch(
        `${kubeApi}${clawUrl}`,
        {
          method: 'POST',
          body: newOpenClawObject(
            namespace,
            clawName,
            credentialInputs,
            disableDevicePairing,
          ),
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
      for (const secretName of createdSecrets) {
        await this.secureFetchApi.fetch(
          `${kubeApi}${secretsBasePath}/${secretName}`,
          { method: 'DELETE' },
        );
      }
      throw err;
    }
  };

  unIdleOpenClaw = async (namespace: string): Promise<void> => {
    const kubeApi = this.kubeAPI;
    const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${clawName}`;
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
    const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${clawName}`;
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
