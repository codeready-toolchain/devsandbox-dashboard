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
    errors?: Record<string, string[]>;
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

describe('error display from parent errors prop', () => {
  it('shows error messages for the service account key field', () => {
    renderForm({
      errors: { 'sa-key.json': ['Please input valid JSON.'] },
    });

    expect(screen.getByText('Please input valid JSON.')).toBeInTheDocument();
  });

  it('shows joined error messages when multiple errors exist', () => {
    renderForm({
      errors: {
        'sa-key.json': [
          'The "project_id" property is required.',
          'Invalid email format specified.',
        ],
      },
    });

    const helperText = screen.getByText(
      /The "project_id" property is required/,
    );
    expect(helperText.textContent).toContain('Invalid email format specified.');
  });

  it('shows error for the region field', () => {
    renderForm({
      errors: { region: ['The "Region" field is required'] },
    });

    expect(
      screen.getByText('The "Region" field is required'),
    ).toBeInTheDocument();
  });

  it('shows no errors when errors prop is empty', () => {
    renderForm({ errors: {} });

    expect(screen.queryByText(/is required/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Please input valid JSON.'),
    ).not.toBeInTheDocument();
  });

  it('shows errors for multiple fields simultaneously', () => {
    renderForm({
      errors: {
        'sa-key.json': ['Please input valid JSON.'],
        region: ['The "Region" field is required'],
      },
    });

    expect(screen.getByText('Please input valid JSON.')).toBeInTheDocument();
    expect(
      screen.getByText('The "Region" field is required'),
    ).toBeInTheDocument();
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

describe('runtime validation guards against unexpected JSON shapes', () => {
  it.each([
    ['a JSON array', JSON.stringify([{ project_id: 'sneaky' }])],
    ['a JSON string', JSON.stringify('service_account')],
    ['a JSON number', JSON.stringify(42)],
    ['JSON null', 'null'],
    ['a boolean', 'true'],
  ])('clears project-id when parsed value is %s', (_label, jsonValue) => {
    const { onChange } = renderForm();

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: jsonValue } });

    expect(onChange).toHaveBeenCalledWith('project-id', '');
  });

  it('clears project-id when object has type service_account but no project_id', () => {
    const { onChange } = renderForm();
    const json = JSON.stringify({
      type: 'service_account',
      client_email: 'a@b.com',
    });

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: json } });

    expect(onChange).toHaveBeenCalledWith('project-id', '');
  });

  it('clears project-id when object is missing the type field entirely', () => {
    const { onChange } = renderForm();
    const json = JSON.stringify({
      project_id: 'my-project',
      client_email: 'a@b.com',
    });

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: json } });

    expect(onChange).toHaveBeenCalledWith('project-id', '');
  });

  it('clears project-id when type is not service_account even with project_id present', () => {
    const { onChange } = renderForm();
    const json = JSON.stringify({
      type: 'external_account',
      project_id: 'my-project',
    });

    const textArea = screen.getByLabelText('Service Account Key');
    fireEvent.change(textArea, { target: { value: json } });

    expect(onChange).toHaveBeenCalledWith('project-id', '');
  });
});
