import React from 'react';
import { getProviderById } from '../../../utils/openclaw-providers';
import { createTheme, ThemeProvider } from '@mui/material';
import ProviderCredentialForm from '../ProviderCredentialForm';
import { render, screen } from '@testing-library/react';

const gcpProvider = getProviderById('google-vertex')!;

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
  const saKeyField = gcpProvider.fields.find(f => f.key === 'sa-key.json')!;
  const textarea = screen.getByLabelText('Service Account Key');
  expect(textarea).toHaveAttribute('placeholder', saKeyField.placeholder);

  const label = screen.getByText('Service Account Key');
  expect(label).toHaveAttribute('data-shrink', 'true');
});
