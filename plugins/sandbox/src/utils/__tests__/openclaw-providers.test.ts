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
  PROVIDERS,
  getProviderById,
  CATEGORY_LABELS,
} from '../openclaw-providers';

describe('openclaw-providers', () => {
  it('has no duplicate provider IDs', () => {
    const ids = PROVIDERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every provider has at least one field', () => {
    for (const provider of PROVIDERS) {
      expect(provider.fields.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every provider has a valid category', () => {
    const validCategories = Object.keys(CATEGORY_LABELS);
    for (const provider of PROVIDERS) {
      expect(validCategories).toContain(provider.category);
    }
  });

  it('getProviderById returns the correct provider', () => {
    const gemini = getProviderById('gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.name).toBe('Google Gemini');
    expect(gemini?.provider).toBe('google');
  });

  it('getProviderById returns undefined for unknown ID', () => {
    expect(getProviderById('nonexistent')).toBeUndefined();
  });

  it('lists Google Gemini first', () => {
    expect(PROVIDERS[0].id).toBe('gemini');
  });

  it('Google Vertex has sa-key.json, project-id, and region fields', () => {
    const vertex = getProviderById('google-vertex');
    expect(vertex).toBeDefined();
    expect(vertex?.fields).toHaveLength(3);
    expect(vertex?.credentialType).toBe('gcp');
    expect(vertex?.provider).toBe('google');

    const fieldKeys = (vertex?.fields ?? []).map(f => f.key);
    expect(fieldKeys).toContain('sa-key.json');
    expect(fieldKeys).toContain('project-id');
    expect(fieldKeys).toContain('region');
  });

  it('includes Anthropic via Vertex AI', () => {
    const anthropicVertex = getProviderById('anthropic-vertex');
    expect(anthropicVertex).toBeDefined();
    expect(anthropicVertex?.credentialType).toBe('gcp');
    expect(anthropicVertex?.provider).toBe('anthropic');
  });

  it('includes Custom / Self-Hosted provider', () => {
    const custom = getProviderById('custom');
    expect(custom).toBeDefined();
    expect(custom?.fields).toHaveLength(5);

    const fieldKeys = (custom?.fields ?? []).map(f => f.key);
    expect(fieldKeys).toContain('endpoint-url');
    expect(fieldKeys).toContain('api-format');
    expect(fieldKeys).toContain('api-key');
    expect(fieldKeys).toContain('model-name');
    expect(fieldKeys).toContain('display-name');
  });

  it('includes all primary providers', () => {
    const primaryIds = PROVIDERS.filter(p => p.category === 'primary').map(
      p => p.id,
    );
    expect(primaryIds).toContain('gemini');
    expect(primaryIds).toContain('anthropic');
    expect(primaryIds).toContain('openai');
    expect(primaryIds).toContain('xai');
  });

  it('includes openrouter in advanced', () => {
    const openrouter = getProviderById('openrouter');
    expect(openrouter).toBeDefined();
    expect(openrouter?.category).toBe('advanced');
  });

  it('sets correct credential types for bearer providers', () => {
    for (const id of ['openai', 'xai', 'openrouter']) {
      const provider = getProviderById(id);
      expect(provider?.credentialType).toBe('bearer');
      expect(provider?.domain).toBeDefined();
    }
  });

  it('every provider has a keyUrl except custom', () => {
    for (const provider of PROVIDERS) {
      if (provider.id !== 'custom') {
        expect(provider.keyUrl).toBeDefined();
      }
    }
  });
});
