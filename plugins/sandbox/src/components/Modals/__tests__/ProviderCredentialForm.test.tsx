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

const validAuthorizedUser = JSON.stringify({
  type: 'authorized_user',
  client_id: 'my-client-id.apps.googleusercontent.com',
  client_secret: 'secret-123',
  refresh_token: '1//refresh-token',
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

    expect(screen.getByText('Please input valid JSON.')).toBeInTheDocument();
  });

  it('shows error when the "type" property is missing', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, {
      target: { value: JSON.stringify({ project_id: 'my-project' }) },
    });

    expect(
      screen.getByText(/The "type" property is required/),
    ).toBeInTheDocument();
  });

  it('shows error for invalid type value', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    invalid.type = 'wrong_type';
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    expect(
      screen.getByText(
        /The "type" property must be "authorized_user" or "service_account"/,
      ),
    ).toBeInTheDocument();
  });

  it('shows error for a single missing required property', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const { project_id: _, ...rest } = JSON.parse(validServiceAccount);
    fireEvent.change(textArea, { target: { value: JSON.stringify(rest) } });

    expect(
      screen.getByText(/The "project_id" property is required/),
    ).toBeInTheDocument();
  });

  it('shows error for multiple missing required properties', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, {
      target: { value: JSON.stringify({ type: 'service_account' }) },
    });

    expect(screen.getByText(/properties are required/)).toBeInTheDocument();
  });

  it('shows error for invalid email format', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    invalid.client_email = 'not-an-email';
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    expect(
      screen.getByText(/Invalid email format specified/),
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

  it('shows combined errors for missing properties and invalid formats', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    delete invalid.project_id;
    invalid.client_email = 'not-an-email';
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    const helperText = screen.getByText(
      /The "project_id" property is required/,
    );
    expect(helperText).toBeInTheDocument();
    expect(helperText.textContent).toContain('Invalid email format specified');
  });

  it('clears errors when valid JSON is entered after invalid input', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: '{ bad' } });
    expect(screen.getByText('Please input valid JSON.')).toBeInTheDocument();

    fireEvent.change(textArea, { target: { value: validServiceAccount } });
    expect(
      screen.queryByText('Please input valid JSON.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/property is required/)).not.toBeInTheDocument();
  });

  it('shows no error for valid service account JSON', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: validServiceAccount } });

    expect(screen.queryByText(/property is required/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Please input valid JSON.'),
    ).not.toBeInTheDocument();
  });

  it('shows no error for valid authorized_user JSON', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: validAuthorizedUser } });

    expect(screen.queryByText(/property is required/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Please input valid JSON.'),
    ).not.toBeInTheDocument();
  });

  it('validates authorized_user required fields', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, {
      target: {
        value: JSON.stringify({ type: 'authorized_user', client_id: 'id' }),
      },
    });

    expect(screen.getByText(/properties are required/)).toBeInTheDocument();
  });

  it('clears errors when field is emptied', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: '{ bad' } });
    expect(screen.getByText('Please input valid JSON.')).toBeInTheDocument();

    fireEvent.change(textArea, { target: { value: validServiceAccount } });
    expect(
      screen.queryByText('Please input valid JSON.'),
    ).not.toBeInTheDocument();

    fireEvent.change(textArea, { target: { value: '' } });
    expect(screen.queryByText(/property is required/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Please input valid JSON.'),
    ).not.toBeInTheDocument();
  });

  it('shows error when a field has the wrong type', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    invalid.project_id = 123;
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    expect(
      screen.getByText(/The "project_id" field must be of the "string" type/),
    ).toBeInTheDocument();
  });

  it('shows multiple type errors when several fields have wrong types', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    invalid.project_id = 123;
    invalid.private_key = true;
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    const helperText = screen.getByText(
      /The "project_id" field must be of the "string" type/,
    );
    expect(helperText.textContent).toContain(
      'The "private_key" field must be of the "string" type',
    );
  });

  it('shows multiple URI format errors when both auth_uri and token_uri are invalid', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const invalid = JSON.parse(validServiceAccount);
    invalid.auth_uri = 'not-a-uri';
    invalid.token_uri = 'also-not-a-uri';
    fireEvent.change(textArea, { target: { value: JSON.stringify(invalid) } });

    const helperText = screen.getByText(/Invalid URI specified in "auth_uri"/);
    expect(helperText.textContent).toContain(
      'Invalid URI specified in "token_uri"',
    );
  });

  it('accepts authorized_user with optional quota_project_id', () => {
    renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    const withQuota = JSON.stringify({
      type: 'authorized_user',
      client_id: 'my-client-id.apps.googleusercontent.com',
      client_secret: 'secret-123',
      refresh_token: '1//refresh-token',
      quota_project_id: 'my-quota-project',
    });
    fireEvent.change(textArea, { target: { value: withQuota } });

    expect(screen.queryByText(/property is required/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Please input valid JSON.'),
    ).not.toBeInTheDocument();
  });
});

describe('project-id extraction from credentials JSON', () => {
  it('sets project-id when a valid service_account JSON is entered', () => {
    const { onChange } = renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: validServiceAccount } });

    expect(onChange).toHaveBeenCalledWith('project-id', 'my-project');
  });

  it('clears project-id when an authorized_user JSON is entered', () => {
    const { onChange } = renderForm({
      values: { 'project-id': 'stale-project' },
    });

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: validAuthorizedUser } });

    expect(onChange).toHaveBeenCalledWith('project-id', '');
  });

  it('clears project-id when invalid JSON is entered', () => {
    const { onChange } = renderForm({
      values: { 'project-id': 'stale-project' },
    });

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: '{not valid' } });

    expect(onChange).toHaveBeenCalledWith('project-id', '');
  });

  it('clears stale project-id when switching from service_account to authorized_user', () => {
    const { onChange } = renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: validServiceAccount } });
    expect(onChange).toHaveBeenCalledWith('project-id', 'my-project');

    onChange.mockClear();
    fireEvent.change(textArea, { target: { value: validAuthorizedUser } });
    expect(onChange).toHaveBeenCalledWith('project-id', '');
  });
});
