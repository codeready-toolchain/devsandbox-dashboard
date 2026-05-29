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
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  ProviderConfig,
  ProviderCredentialField,
} from '../../utils/openclaw-providers';

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
      {provider.keyUrl && (
        <Typography variant="body2" color="text.secondary">
          <Link
            href={provider.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            Get a key
            <OpenInNewIcon sx={{ fontSize: 14 }} />
          </Link>
        </Typography>
      )}

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
            <TextField
              key={field.key}
              variant="filled"
              fullWidth
              label={field.label}
              value={value}
              onChange={e => onChange(field.key, e.target.value)}
              error={hasError}
              helperText={
                hasError
                  ? 'Valid JSON with type "service_account" or "authorized_user" is required'
                  : ''
              }
              placeholder={field.placeholder}
              multiline
              minRows={4}
              maxRows={8}
              InputProps={{ disableUnderline: true }}
              size="small"
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
