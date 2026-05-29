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

  it('Google Vertex has service-account-json, project-id, and region fields', () => {
    const vertex = getProviderById('google-vertex');
    expect(vertex).toBeDefined();
    expect(vertex?.fields).toHaveLength(3);

    const fieldKeys = (vertex?.fields ?? []).map(f => f.key);
    expect(fieldKeys).toContain('service-account-json');
    expect(fieldKeys).toContain('project-id');
    expect(fieldKeys).toContain('region');
  });

  it('includes all cloud providers', () => {
    const cloudIds = PROVIDERS.filter(p => p.category === 'cloud').map(
      p => p.id,
    );
    expect(cloudIds).toContain('openai');
    expect(cloudIds).toContain('anthropic');
    expect(cloudIds).toContain('gemini');
    expect(cloudIds).toContain('xai');
    expect(cloudIds).toContain('google-vertex');
  });

  it('includes openrouter in gateways', () => {
    const openrouter = getProviderById('openrouter');
    expect(openrouter).toBeDefined();
    expect(openrouter?.category).toBe('gateway');
  });
});
