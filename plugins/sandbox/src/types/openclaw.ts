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

import { StatusCondition } from './common';

export type SpaceRequestItem = {
  metadata: {
    name: string;
  };
  spec: {
    tierName: string;
  };
  status?: {
    conditions?: StatusCondition[];
    namespaceAccess?: { name: string; secretRef: string }[];
  };
};

export type OpenClawCredentialRef = {
  name: string;
  key: string;
};

export type OpenClawGcpConfig = {
  project: string;
  location: string;
};

export type OpenClawCredential = {
  name: string;
  type: string;
  secretRef: OpenClawCredentialRef[];
  provider?: string;
  domain?: string;
  gcp?: OpenClawGcpConfig;
};

export type OpenClawCustomProviderModel = {
  name: string;
  alias?: string;
};

export type OpenClawCustomProvider = {
  name: string;
  baseUrl: string;
  api?: string;
  credentialRef: string;
  models: OpenClawCustomProviderModel[];
};

export type OpenClawWebSearch = {
  provider: string;
};

export type OpenClawItem = {
  metadata: {
    name: string;
    uid?: string;
    creationTimestamp?: string;
  };
  spec: {
    credentials?: OpenClawCredential[];
    customProviders?: OpenClawCustomProvider[];
    webSearch?: OpenClawWebSearch;
    idle?: boolean;
    auth?: {
      disableDevicePairing?: boolean;
    };
  };
  status?: {
    conditions?: StatusCondition[];
    url?: string;
  };
};
