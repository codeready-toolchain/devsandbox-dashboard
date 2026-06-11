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
import React, { useState } from 'react';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  ProviderConfig,
  ProviderCredentialField,
} from '../../utils/openclaw-providers';
import { JsonCredentialSchema } from '../../types/openclaw';

const API_FORMAT_LABELS: Record<string, string> = {
  'openai-completions': 'OpenAI Completions',
  'openai-responses': 'OpenAI Responses',
  ollama: 'Ollama',
};

type ProviderCredentialFormProps = {
  provider: ProviderConfig;
  values: Record<string, string>;
  errors: Record<string, boolean>;
  onChange: (key: string, value: string) => void;
};

const ApiKeyField: React.FC<{
  field: ProviderCredentialField;
  value: string;
  error: boolean;
  onChange: (value: string) => void;
}> = ({ field, value, error, onChange }) => {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      variant="filled"
      fullWidth
      label={field.label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={e => onChange(e.target.value)}
      error={error}
      helperText={error ? `${field.label} is required` : ''}
      placeholder={field.placeholder}
      InputProps={{
        disableUnderline: true,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={`toggle ${field.label} visibility`}
              onClick={() => setVisible(prev => !prev)}
              edge="end"
              size="small"
            >
              {visible ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
      size="small"
    />
  );
};

/**
 * Defines the expected JSON schema for the Vertex service accounts.
 */
const schema = {
  discriminator: { propertyName: 'type' },
  oneOf: [
    {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'authorized_user' },
        client_id: { type: 'string' },
        client_secret: { type: 'string' },
        refresh_token: { type: 'string' },
        quota_project_id: { type: 'string' },
      },
      required: ['type', 'client_id', 'client_secret', 'refresh_token'],
    },
    {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'service_account' },
        project_id: { type: 'string' },
        private_key_id: { type: 'string' },
        private_key: { type: 'string' },
        client_email: { type: 'string', format: 'email' },
        client_id: { type: 'string' },
        auth_uri: { type: 'string', format: 'uri' },
        token_uri: { type: 'string', format: 'uri' },
      },
      required: [
        'type',
        'project_id',
        'private_key_id',
        'private_key',
        'client_email',
        'client_id',
        'auth_uri',
        'token_uri',
      ],
    },
  ],
};

/**
 * Instantiate Ajv once, along with the schema validator so that we do not
 * recompile the schema every time a component is rendered.
 */
const ajv = new Ajv({ allErrors: true, discriminator: true, strict: false });
addFormats(ajv);
const schemaValidator = ajv.compile<JsonCredentialSchema>(schema);

/**
 * Special text field for service accounts with a placeholder always
 * visible to help users determine which credential they need to use.
 */
const ServiceAccountJsonField: React.FC<{
  field: ProviderCredentialField;
  value: string;
  error: boolean;
  onChange: (value: string) => void;
}> = ({ field, value, error, onChange }) => {
  const [errorMessages, setErrorMessages] = React.useState<string[]>([]);

  const handleValidation = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const raw = event.target.value;
    onChange(raw);

    if (raw === '') {
      setErrorMessages([]);
      return;
    }

    let data: JsonCredentialSchema;
    try {
      data = JSON.parse(raw);
    } catch {
      setErrorMessages(['Please input valid JSON.']);
      return;
    }

    if (!schemaValidator(data)) {
      if (schemaValidator.errors) {
        const errMsgs: string[] = [];
        const missingRequiredProperties: string[] = [];
        const invalidFormatErrMsgs: string[] = [];
        const invalidTypeErrMsgs: string[] = [];
        const credType = (data as Record<string, unknown>).type;

        // Short circuit for when a "type" is not found in the provided JSON
        // object. This is to prevent the UI showing all the
        // "required property" errors that otherwise show up from both the
        // "authorized user" and "service account" structures.
        if (credType === undefined) {
          setErrorMessages(['The "type" property is required']);
          return;
        } else if (
          credType !== 'authorized_user' &&
          credType !== 'service_account'
        ) {
          setErrorMessages([
            'The "type" property must be "authorized_user" or "service_account"',
          ]);
          return;
        }

        for (const err of schemaValidator.errors) {
          switch (err.keyword) {
            case 'required':
              missingRequiredProperties.push(err.params.missingProperty);
              break;
            case 'type':
              invalidTypeErrMsgs.push(
                `The "${err.instancePath.slice(1)}" field must be of the "${
                  err.params.type
                }" type.`,
              );
              break;
            case 'format':
              switch (err.params.format) {
                case 'email':
                  invalidFormatErrMsgs.push(`Invalid email format specified.`);
                  break;
                case 'uri':
                  invalidFormatErrMsgs.push(
                    `Invalid URI specified in "${err.instancePath.slice(1)}".`,
                  );
                  break;
              }
              break;
            default:
              errMsgs.push(`Invalid property "${err.instancePath.slice(1)}".`);
          }
        }

        // Prepare and format the "required properties" error.
        if (missingRequiredProperties.length == 1) {
          errMsgs.push(
            `The "${missingRequiredProperties[0]}" property is required.`,
          );
        } else if (missingRequiredProperties.length > 1) {
          const formatter = new Intl.ListFormat('en', {
            style: 'long',
            type: 'conjunction',
          });

          errMsgs.push(
            `The ${formatter.format(
              missingRequiredProperties.map(property => `"${property}"`),
            )} properties are required.`,
          );
        }

        // Prepare all the error messages and format them nicely.
        if (invalidTypeErrMsgs.length > 0) {
          errMsgs.push(invalidTypeErrMsgs.join(' '));
        }

        if (invalidFormatErrMsgs.length > 0) {
          errMsgs.push(invalidFormatErrMsgs.join(' '));
        }

        setErrorMessages(errMsgs);
        return;
      }
    }

    setErrorMessages([]);
  };

  return (
    <TextField
      variant="filled"
      fullWidth
      label={field.label}
      value={value}
      onChange={handleValidation}
      error={error || errorMessages.length > 0}
      helperText={
        errorMessages.length > 0
          ? errorMessages.join(' ')
          : error
          ? `${field.label} is required`
          : ''
      }
      placeholder={field.placeholder}
      multiline
      minRows={11}
      maxRows={11}
      InputLabelProps={{ shrink: true }}
      InputProps={{ disableUnderline: true }}
      size="small"
    />
  );
};

const ComboboxField: React.FC<{
  field: ProviderCredentialField;
  value: string;
  error: boolean;
  onChange: (value: string) => void;
}> = ({ field, value, error, onChange }) => (
  <Autocomplete
    freeSolo
    options={field.options ?? []}
    inputValue={value}
    onInputChange={(_, newValue) => onChange(newValue)}
    renderInput={params => (
      <TextField
        {...params}
        variant="filled"
        label={field.label}
        error={error}
        helperText={error ? `${field.label} is required` : ''}
        placeholder={field.placeholder}
        InputProps={{
          ...params.InputProps,
          disableUnderline: true,
        }}
        size="small"
      />
    )}
  />
);

const SelectField: React.FC<{
  field: ProviderCredentialField;
  value: string;
  error: boolean;
  onChange: (value: string) => void;
}> = ({ field, value, error, onChange }) => (
  <TextField
    variant="filled"
    fullWidth
    select
    label={field.label}
    value={value}
    onChange={e => onChange(e.target.value)}
    error={error}
    helperText={error ? `${field.label} is required` : ''}
    InputProps={{ disableUnderline: true }}
    size="small"
  >
    {(field.options ?? []).map(option => (
      <MenuItem key={option} value={option}>
        {API_FORMAT_LABELS[option] ?? option}
      </MenuItem>
    ))}
  </TextField>
);

export const ProviderCredentialForm: React.FC<ProviderCredentialFormProps> = ({
  provider,
  values,
  errors,
  onChange,
}) => {
  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {provider.fields.map(field => {
        const value = values[field.key] ?? '';
        const hasError = errors[field.key] ?? false;

        if (field.type === 'apiKey') {
          return (
            <ApiKeyField
              key={field.key}
              field={field}
              value={value}
              error={hasError}
              onChange={v => onChange(field.key, v)}
            />
          );
        }

        if (field.type === 'serviceAccountJson') {
          return (
            <ServiceAccountJsonField
              key={field.key}
              field={field}
              value={value}
              error={hasError}
              onChange={v => {
                onChange(field.key, v);
                try {
                  const parsed: JsonCredentialSchema = JSON.parse(v);
                  if (parsed.type === 'service_account') {
                    onChange('project-id', parsed.project_id);
                  } else {
                    onChange('project-id', '');
                  }
                } catch {
                  onChange('project-id', '');
                }
              }}
            />
          );
        }

        if (field.type === 'combobox') {
          return (
            <ComboboxField
              key={field.key}
              field={field}
              value={value}
              error={hasError}
              onChange={v => onChange(field.key, v)}
            />
          );
        }

        if (field.type === 'select') {
          return (
            <SelectField
              key={field.key}
              field={field}
              value={value}
              error={hasError}
              onChange={v => onChange(field.key, v)}
            />
          );
        }

        return (
          <TextField
            key={field.key}
            variant="filled"
            fullWidth
            label={field.label}
            value={value}
            onChange={e => onChange(field.key, e.target.value)}
            error={hasError}
            helperText={hasError ? `${field.label} is required` : ''}
            placeholder={field.placeholder}
            InputProps={{ disableUnderline: true }}
            size="small"
          />
        );
      })}
    </Stack>
  );
};

export default ProviderCredentialForm;
