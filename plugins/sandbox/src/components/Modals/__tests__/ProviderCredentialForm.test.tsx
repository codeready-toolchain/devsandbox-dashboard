import React from 'react';
import { ProviderConfig } from '../../../utils/openclaw-providers';
import { createTheme, ThemeProvider } from '@mui/material';
import ProviderCredentialForm from '../ProviderCredentialForm';
import { render, screen } from '@testing-library/react';

const gcpProvider: ProviderConfig = {
  id: 'test-vertex',
  name: 'Test Vertex',
  provider: 'google',
  category: 'advanced',
  credentialType: 'gcp',
  fields: [
    {
      key: 'sa-key.json',
      label: 'Service Account Key',
      type: 'serviceAccountJson',
      required: true,
      placeholder: 'Paste your service account JSON key',
      multiline: true,
    },
    {
      key: 'region',
      label: 'Region',
      type: 'text',
      required: true,
    },
  ],
};

const theme = createTheme();

const renderForm = (provider = gcpProvider) => {
  const onChange = jest.fn();
  return {
    onChange,
    ...render(
      <ThemeProvider theme={theme}>
        <ProviderCredentialForm
          provider={provider}
          values={{}}
          errors={{}}
          onChange={onChange}
        />
      </ThemeProvider>,
    ),
  };
};

it('keeps the placeholder visible when ServiceAccountJsonField is empty', () => {
  renderForm();
  const textarea = screen.getByPlaceholderText(
    'Paste your service account JSON key',
  );
  expect(textarea).toBeInTheDocument();

  const label = screen.getByText('Service Account Key');
  expect(label).toHaveAttribute('data-shrink', 'true');
});
