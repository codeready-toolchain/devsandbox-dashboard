import React from 'react';
import { getProviderById } from '../../../utils/openclaw-providers';
import { createTheme, ThemeProvider } from '@mui/material';
import ProviderCredentialForm from '../ProviderCredentialForm';
import { fireEvent, render, screen } from '@testing-library/react';

const gcpProvider = getProviderById('google-vertex')!;

const theme = createTheme();

const validServiceAccount = JSON.stringify({
  type: 'service_account',
  project_id: 'my-project',
  private_key_id: 'key-id-123',
  private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
  client_email: 'sa@my-project.iam.gserviceaccount.com',
  client_id: '12345',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
});

const renderForm = (
  overrides: {
    values?: Record<string, string>;
    errors?: Record<string, boolean>;
  } = {},
) => {
  const onChange = jest.fn();
  return {
    onChange,
    ...render(
      <ThemeProvider theme={theme}>
        <ProviderCredentialForm
          provider={gcpProvider}
          values={overrides.values ?? {}}
          errors={overrides.errors ?? {}}
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

describe('ServiceAccountJsonField validation', () => {
  it('shows error for invalid JSON syntax', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: '{not valid json}' } });

    expect(screen.getByText('Please input valid JSON')).toBeInTheDocument();
  });

  it('shows error when required properties are missing', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, {
      target: { value: JSON.stringify({ type: 'service_account' }) },
    });

    expect(
      screen.getByText(/Property "project_id" missing in the JSON/),
    ).toBeInTheDocument();
  });

  it('shows error for invalid type enum value', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    invalid.type = 'wrong_type';
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    expect(
      screen.getByText(
        /must have the "authorized_user" or "service_account" values/,
      ),
    ).toBeInTheDocument();
  });

  it('shows error for invalid email format', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    invalid.client_email = 'not-an-email';
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    expect(
      screen.getByText('Invalid email format specified'),
    ).toBeInTheDocument();
  });

  it('shows error for invalid URI format', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    invalid.auth_uri = 'not a uri';
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    expect(
      screen.getByText(/Invalid URI specified in "auth_uri"/),
    ).toBeInTheDocument();
  });

  it('clears errors when valid JSON is entered after invalid input', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: '{ bad' } });
    expect(screen.getByText('Please input valid JSON')).toBeInTheDocument();

    fireEvent.change(textArea, { target: { value: validServiceAccount } });
    expect(
      screen.queryByText('Please input valid JSON'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/missing in the JSON/)).not.toBeInTheDocument();
  });

  it('shows no error for valid service account JSON', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: validServiceAccount } });

    expect(screen.queryByText(/missing in the JSON/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Please input valid JSON'),
    ).not.toBeInTheDocument();
  });
});
