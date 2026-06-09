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
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNew from '@mui/icons-material/OpenInNew';
import {
  AddedCredential,
  CATEGORY_LABELS,
  PROVIDERS,
  ProviderCategory,
  ProviderConfig,
} from '../../utils/openclaw-providers';
import { ProviderCredentialForm } from './ProviderCredentialForm';

type CredentialEntry = {
  id: string;
  provider: ProviderConfig | null;
  values: Record<string, string>;
};

export type CredentialAccordionRef = {
  getValidatedCredentials: () => AddedCredential[] | null;
};

export type CredentialAccordionProps = {
  onCredentialCountChange: (count: number) => void;
};

const getCredentialSummary = (entry: CredentialEntry): string => {
  if (!entry.provider) return '';
  const { provider, values } = entry;

  if (provider.credentialType === 'gcp') {
    const project = values['project-id'] || '';
    const region = values['region'] || '';
    return `Project: ${project} · Region: ${region}`;
  }

  if (provider.id === 'custom') {
    return values['endpoint-url'] || '';
  }

  const apiKey = values['api-key'] || '';
  if (apiKey.length > 4) {
    return `API Key: ····${apiKey.slice(-4)}`;
  }
  return apiKey ? 'API Key: ····' : '';
};

const validateFields = (
  provider: ProviderConfig,
  values: Record<string, string>,
): Record<string, boolean> => {
  const errors: Record<string, boolean> = {};
  for (const field of provider.fields) {
    const value = values[field.key]?.trim();
    if (field.required && !value) {
      errors[field.key] = true;
    } else if (field.type === 'serviceAccountJson' && value) {
      try {
        const parsed = JSON.parse(value);
        if (
          parsed.type !== 'service_account' &&
          parsed.type !== 'authorized_user'
        ) {
          errors[field.key] = true;
        }
      } catch {
        errors[field.key] = true;
      }
    }
  }
  return errors;
};

const accordionSx = {
  mb: 1,
  '&:before': { display: 'none' },
  boxShadow: 'none',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '8px !important',
  overflow: 'visible',
  '&.Mui-expanded': { margin: '0 0 8px 0' },
};

const summarySx = {
  minHeight: 48,
  px: 2,
  '& .MuiAccordionSummary-content': {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    my: 0,
    mr: 0.5,
    minHeight: 32,
  },
  '& .MuiAccordionSummary-expandIconWrapper': {
    color: 'action.active',
  },
};

export const CredentialAccordion = forwardRef<
  CredentialAccordionRef,
  CredentialAccordionProps
>(({ onCredentialCountChange }, ref) => {
  const [entries, setEntries] = useState<CredentialEntry[]>([
    { id: 'cred-1', provider: null, values: {} },
  ]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, Record<string, boolean>>>(
    {},
  );
  const nextIdRef = useRef(1);

  const credentialCount = useMemo(
    () => entries.filter(e => e.provider !== null).length,
    [entries],
  );

  useEffect(() => {
    onCredentialCountChange(credentialCount);
  }, [credentialCount, onCredentialCountChange]);

  const availableProviders = useMemo(() => {
    const usedIds = new Set(
      entries.filter(e => e.provider !== null).map(e => e.provider!.id),
    );
    return PROVIDERS.filter(p => !usedIds.has(p.id));
  }, [entries]);

  const generateId = useCallback(() => {
    nextIdRef.current += 1;
    return `cred-${nextIdRef.current}`;
  }, []);

  const handleAddEntry = useCallback(() => {
    const newId = generateId();
    setEntries(prev => [...prev, { id: newId, provider: null, values: {} }]);
    setExpandedIds(new Set([newId]));
  }, [generateId]);

  const handleDeleteEntry = useCallback(
    (entryId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setEntries(prev => {
        if (prev.length === 1) {
          return [{ id: prev[0].id, provider: null, values: {} }];
        }
        return prev.filter(entry => entry.id !== entryId);
      });
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
      setErrors(prev => {
        const { [entryId]: _, ...rest } = prev;
        return rest;
      });
    },
    [],
  );

  const handleToggleExpand = useCallback((entryId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const handleProviderSelect = useCallback(
    (entryId: string, provider: ProviderConfig | null) => {
      setEntries(prev =>
        prev.map(e => (e.id === entryId ? { ...e, provider, values: {} } : e)),
      );
      if (provider) {
        setExpandedIds(prev => new Set([...prev, entryId]));
      }
      setErrors(prev => {
        const { [entryId]: _, ...rest } = prev;
        return rest;
      });
    },
    [],
  );

  const handleFieldChange = useCallback(
    (entryId: string, key: string, value: string) => {
      setEntries(prev =>
        prev.map(e =>
          e.id === entryId
            ? { ...e, values: { ...e.values, [key]: value } }
            : e,
        ),
      );
      setErrors(prev => {
        if (!prev[entryId]?.[key]) return prev;
        const { [key]: _, ...entryErrors } = prev[entryId];
        if (Object.keys(entryErrors).length === 0) {
          const { [entryId]: __, ...rest } = prev;
          return rest;
        }
        return { ...prev, [entryId]: entryErrors };
      });
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      getValidatedCredentials: () => {
        const withProvider = entries.filter(
          (e): e is CredentialEntry & { provider: ProviderConfig } =>
            e.provider !== null,
        );
        if (withProvider.length === 0) return null;

        let hasErrors = false;
        const newErrors: Record<string, Record<string, boolean>> = {};
        const newExpandedIds = new Set(expandedIds);

        for (const entry of withProvider) {
          const entryErrors = validateFields(entry.provider, entry.values);
          if (Object.keys(entryErrors).length > 0) {
            newErrors[entry.id] = entryErrors;
            newExpandedIds.add(entry.id);
            hasErrors = true;
          }
        }

        if (hasErrors) {
          setErrors(prev => ({ ...prev, ...newErrors }));
          setExpandedIds(newExpandedIds);
          return null;
        }

        setErrors({});
        return withProvider.map(e => ({
          provider: e.provider,
          values: { ...e.values },
        }));
      },
    }),
    [entries, expandedIds],
  );

  const hasEmptyEntry = entries.some(e => e.provider === null);

  return (
    <Box>
      {entries.map(entry => {
        const hasProvider = entry.provider !== null;
        const isExpanded = hasProvider ? expandedIds.has(entry.id) : true;
        const entryErrors = errors[entry.id] ?? {};
        const summary = hasProvider ? getCredentialSummary(entry) : '';

        return (
          <Accordion
            key={entry.id}
            expanded={isExpanded}
            onChange={
              hasProvider ? () => handleToggleExpand(entry.id) : undefined
            }
            disableGutters
            sx={accordionSx}
          >
            <AccordionSummary
              expandIcon={hasProvider ? <ExpandMoreIcon /> : undefined}
              sx={{
                ...summarySx,
                ...(!hasProvider && { cursor: 'default' }),
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, flexGrow: 1, lineHeight: '24px' }}
              >
                {hasProvider ? entry.provider!.name : 'New credential'}
              </Typography>
              {hasProvider && !isExpanded && summary && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: '24px', whiteSpace: 'nowrap' }}
                >
                  {summary}
                </Typography>
              )}
              {(entries.length > 1 || hasProvider) && (
                <Tooltip title="Delete credential">
                  <IconButton
                    size="small"
                    aria-label="Delete credential"
                    onClick={e => handleDeleteEntry(entry.id, e)}
                    sx={{ p: 0.5 }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
              {!hasProvider && (
                <Autocomplete
                  options={availableProviders}
                  onChange={(_, newValue) =>
                    handleProviderSelect(entry.id, newValue)
                  }
                  getOptionLabel={option => option.name}
                  groupBy={option =>
                    CATEGORY_LABELS[option.category as ProviderCategory]
                  }
                  renderInput={params => (
                    <TextField
                      {...params}
                      variant="filled"
                      label="Search providers..."
                      InputProps={{
                        ...params.InputProps,
                        disableUnderline: true,
                      }}
                      size="small"
                    />
                  )}
                  isOptionEqualToValue={(option, value) =>
                    option.id === value.id
                  }
                />
              )}
              {hasProvider && (
                <>
                  <ProviderCredentialForm
                    provider={entry.provider!}
                    values={entry.values}
                    errors={entryErrors}
                    onChange={(key, value) =>
                      handleFieldChange(entry.id, key, value)
                    }
                  />
                  {entry.provider!.keyUrl && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 2 }}
                    >
                      <Link
                        href={entry.provider!.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        Get a key for {entry.provider!.name}
                        <OpenInNew sx={{ fontSize: 14 }} />
                      </Link>
                    </Typography>
                  )}
                </>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Button
        variant="text"
        size="small"
        startIcon={<AddIcon />}
        onClick={handleAddEntry}
        disabled={hasEmptyEntry || availableProviders.length === 0}
        sx={{ textTransform: 'none', mt: 1 }}
      >
        Add another AI provider credential
      </Button>
    </Box>
  );
});

CredentialAccordion.displayName = 'CredentialAccordion';

export default CredentialAccordion;
