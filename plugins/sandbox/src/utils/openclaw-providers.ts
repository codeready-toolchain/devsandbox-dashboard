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

export type CredentialFieldType =
  | 'apiKey'
  | 'serviceAccountJson'
  | 'text'
  | 'select'
  | 'combobox';

export type ProviderCredentialField = {
  key: string;
  label: string;
  type: CredentialFieldType;
  required: boolean;
  placeholder?: string;
  multiline?: boolean;
  options?: string[];
  defaultValue?: string;
};

export type CredentialType = 'apiKey' | 'bearer' | 'gcp' | 'none';

export type ProviderCategory = 'primary' | 'advanced' | 'custom';

export type ProviderConfig = {
  id: string;
  name: string;
  provider: string;
  category: ProviderCategory;
  credentialType: CredentialType;
  domain?: string;
  keyUrl?: string;
  fields: ProviderCredentialField[];
};

const apiKeyField = (placeholder?: string): ProviderCredentialField => ({
  key: 'api-key',
  label: 'API Key',
  type: 'apiKey',
  required: true,
  placeholder: placeholder ?? 'Enter your API key',
});

const gcpFields = (regionSuggestions: string[]): ProviderCredentialField[] => [
  {
    key: 'sa-key.json',
    label: 'Service Account Key',
    type: 'serviceAccountJson',
    required: true,
    placeholder: 'Paste your service account JSON key',
    multiline: true,
  },
  {
    key: 'project-id',
    label: 'GCP Project ID',
    type: 'text',
    required: true,
    placeholder: 'e.g., my-project-123',
  },
  {
    key: 'region',
    label: 'Region',
    type: 'combobox',
    required: true,
    placeholder: 'Select or type your region',
    options: regionSuggestions,
  },
];

export const PROVIDERS: ProviderConfig[] = [
  // Primary options.
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'google',
    category: 'primary',
    credentialType: 'apiKey',
    keyUrl: 'https://aistudio.google.com/apikey',
    fields: [apiKeyField()],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    provider: 'anthropic',
    category: 'primary',
    credentialType: 'apiKey',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    fields: [apiKeyField('sk-ant-...')],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    category: 'primary',
    credentialType: 'bearer',
    domain: 'api.openai.com',
    keyUrl: 'https://platform.openai.com/api-keys',
    fields: [apiKeyField('sk-...')],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    provider: 'xai',
    category: 'primary',
    credentialType: 'bearer',
    domain: 'api.x.ai',
    keyUrl: 'https://console.x.ai/',
    fields: [apiKeyField()],
  },

  // Advanced options.
  {
    id: 'openrouter',
    name: 'OpenRouter',
    provider: 'openrouter',
    category: 'advanced',
    credentialType: 'bearer',
    domain: 'openrouter.ai',
    keyUrl: 'https://openrouter.ai/keys',
    fields: [apiKeyField()],
  },

  // Vertex AI.
  {
    id: 'google-vertex',
    name: 'Vertex AI - Google',
    provider: 'google',
    category: 'advanced',
    credentialType: 'gcp',
    keyUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
    fields: gcpFields([
      'global',
      'us-central1',
      'us-east4',
      'europe-west1',
      'asia-northeast1',
    ]),
  },
  {
    id: 'anthropic-vertex',
    name: 'Vertex AI - Anthropic',
    provider: 'anthropic',
    category: 'advanced',
    credentialType: 'gcp',
    keyUrl: 'https://console.cloud.google.com/vertex-ai/publishers/anthropic',
    fields: gcpFields(['us-east5', 'europe-west1', 'europe-west4']),
  },

  // Custom / Self-Hosted.
  {
    id: 'custom',
    name: 'Custom / Self-Hosted',
    provider: '',
    category: 'custom',
    credentialType: 'bearer',
    fields: [
      {
        key: 'endpoint-url',
        label: 'Endpoint URL',
        type: 'text',
        required: true,
        placeholder: 'e.g., https://llm.mycompany.com/v1',
      },
      {
        key: 'api-format',
        label: 'API Format',
        type: 'select',
        required: true,
        defaultValue: 'openai-completions',
        options: ['openai-completions', 'openai-responses', 'ollama'],
      },
      {
        key: 'api-key',
        label: 'API Key',
        type: 'apiKey',
        required: false,
        placeholder: 'Leave blank if no authentication is required',
      },
      {
        key: 'model-name',
        label: 'Model Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., qwen3-14b, llama-4-scout',
      },
      {
        key: 'display-name',
        label: 'Display Name',
        type: 'text',
        required: false,
        placeholder: 'e.g., Qwen 3 14B',
      },
    ],
  },
];

export const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  primary: 'Primary',
  advanced: 'Advanced',
  custom: 'Custom',
};

export type AddedCredential = {
  provider: ProviderConfig;
  values: Record<string, string>;
};

export const getProviderById = (id: string): ProviderConfig | undefined =>
  PROVIDERS.find(p => p.id === id);
