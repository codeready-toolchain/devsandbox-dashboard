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

export type CredentialFieldType = 'apiKey' | 'serviceAccountJson' | 'text';

export type ProviderCredentialField = {
  key: string;
  label: string;
  type: CredentialFieldType;
  required: boolean;
  placeholder?: string;
  multiline?: boolean;
};

export type ProviderCategory = 'cloud' | 'gateway';

export type ProviderConfig = {
  id: string;
  name: string;
  provider: string;
  category: ProviderCategory;
  fields: ProviderCredentialField[];
};

const apiKeyField = (placeholder?: string): ProviderCredentialField => ({
  key: 'api-key',
  label: 'API Key',
  type: 'apiKey',
  required: true,
  placeholder: placeholder ?? 'Enter your API key',
});

export const PROVIDERS: ProviderConfig[] = [
  // Cloud providers
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    category: 'cloud',
    fields: [apiKeyField('sk-...')],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    provider: 'anthropic',
    category: 'cloud',
    fields: [apiKeyField('sk-ant-...')],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    provider: 'xai',
    category: 'cloud',
    fields: [apiKeyField()],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'google',
    category: 'cloud',
    fields: [apiKeyField()],
  },
  {
    id: 'google-vertex',
    name: 'Google Vertex',
    provider: 'google-vertex',
    category: 'cloud',
    fields: [
      {
        key: 'service-account-json',
        label: 'Service Account JSON',
        type: 'serviceAccountJson',
        required: true,
        placeholder: 'Paste your service account JSON key',
        multiline: true,
      },
      {
        key: 'project-id',
        label: 'Project ID',
        type: 'text',
        required: true,
        placeholder: 'my-gcp-project',
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        required: true,
        placeholder: 'us-central1',
      },
    ],
  },

  // Gateways & routers
  {
    id: 'openrouter',
    name: 'OpenRouter',
    provider: 'openrouter',
    category: 'gateway',
    fields: [apiKeyField()],
  },
];

export const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  cloud: 'Cloud Providers',
  gateway: 'Gateways & Routers',
};

export type AddedCredential = {
  provider: ProviderConfig;
  values: Record<string, string>;
};

export const getProviderById = (id: string): ProviderConfig | undefined =>
  PROVIDERS.find(p => p.id === id);
