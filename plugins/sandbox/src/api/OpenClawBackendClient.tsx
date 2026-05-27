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
import { newOpenClawObject, newOpenClawAPIKeySecretObject } from '../utils/openclaw-utils';
import { OpenClawItem } from '../types';
import { SecureFetchApi } from './SecureFetchClient';

export type OpenClawBackendClientOptions = {
  configApi: ConfigApi;
  secureFetchApi: SecureFetchApi;
};

const clawName = 'claw';
export interface OpenClawService {
  getOpenClaw(namespace: string): Promise<OpenClawItem | undefined>;
  createOpenClaw(namespace: string, apiKeyValue: string): Promise<void>;
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

  private readonly kubeAPI = async (): Promise<string> => {
    const kubeAPI = this.configApi.getString('sandbox.kubeAPI');
    return kubeAPI;
  };

  getOpenClaw = async (
    namespace: string,
  ): Promise<OpenClawItem | undefined> => {
    const kubeApi = await this.kubeAPI();
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
    apiKeyValue: string,
  ): Promise<void> => {
    const kubeApi = await this.kubeAPI();
    // create secret for api key
    const secretName = `gemini-api-key`;
    const secretUrl = `/api/v1/namespaces/${namespace}/secrets`;
    const secretResponse = await this.secureFetchApi.fetch(`${kubeApi}${secretUrl}`, {
      method: 'POST',
      body: newOpenClawAPIKeySecretObject(namespace, secretName, apiKeyValue),
      headers: {
        'Content-Type': 'application/yaml',
      },
    });
    if (!secretResponse.ok && secretResponse.status !== 409) {
      console.log('failed to create secret', secretResponse.json());
      const error = await secretResponse.json();
      throw new Error(errorMessage(error));
    }
    // create claw cr
    const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws`;
    const clawResponse = await this.secureFetchApi.fetch(`${kubeApi}${clawUrl}`, {
      method: 'POST',
      body: newOpenClawObject(namespace, clawName, secretName),
      headers: {
        'Content-Type': 'application/yaml',
      },
    });

    if (!clawResponse.ok && clawResponse.status !== 409) {
      console.log('failed to create claw cr', clawResponse.json());
      const error = await clawResponse.json();
      throw new Error(errorMessage(error));
    }
  };

  unIdleOpenClaw = async (namespace: string): Promise<void> => {
    const kubeApi = await this.kubeAPI();
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
    const kubeApi = await this.kubeAPI();
    const clawUrl = `/apis/claw.sandbox.redhat.com/v1alpha1/namespaces/${namespace}/claws/${clawName}`;
    const clawResponse = await this.secureFetchApi.fetch(`${kubeApi}${clawUrl}`, {
      method: 'DELETE',
    });

    if (!clawResponse.ok && clawResponse.status !== 404) {
      const error = await clawResponse.json();
      throw new Error(errorMessage(error));
    }

    const secretUrl = `/api/v1/namespaces/${namespace}/secrets/gemini-api-key`;
    const secretResponse = await this.secureFetchApi.fetch(`${kubeApi}${secretUrl}`, {
      method: 'DELETE',
    });

    if (!secretResponse.ok && secretResponse.status !== 404) {
      const error = await secretResponse.json();
      throw new Error(errorMessage(error));
    }
  };
}
