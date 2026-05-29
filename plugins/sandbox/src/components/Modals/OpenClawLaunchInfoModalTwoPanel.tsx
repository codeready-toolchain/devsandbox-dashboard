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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import SearchIcon from '@mui/icons-material/Search';
import { useSandboxContext } from '../../hooks/useSandboxContext';
import { OpenClawStatus } from '../../utils/openclaw-utils';
import {
  PROVIDERS,
  CATEGORY_LABELS,
  ProviderConfig,
  ProviderCategory,
} from '../../utils/openclaw-providers';
import { ProviderCredentialForm } from './ProviderCredentialForm';
import { CredentialList, AddedCredential } from './CredentialList';

type OpenClawLaunchInfoModalTwoPanelProps = {
  modalOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const OpenClawLaunchInfoModalTwoPanel: React.FC<
  OpenClawLaunchInfoModalTwoPanelProps
> = ({ modalOpen, setOpen }) => {
  const theme = useTheme();
  const { userData, openclawError, openclawStatus, handleOpenClawInstance } =
    useSandboxContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderConfig | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [addedCredentials, setAddedCredentials] = useState<AddedCredential[]>(
    [],
  );
  const [devicePairingEnabled, setDevicePairingEnabled] = useState(true);

  useEffect(() => {
    if (modalOpen) {
      setDevicePairingEnabled(true);
    }
  }, [modalOpen]);

  const resetForm = () => {
    setSearchQuery('');
    setSelectedProvider(null);
    setFieldValues({});
    setFieldErrors({});
    setAddedCredentials([]);
  };

  const handleClose = () => {
    resetForm();
    setOpen(false);
  };

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: false } : prev));
  }, []);

  const handleAddCredential = () => {
    if (!selectedProvider) return;

    const newErrors: Record<string, boolean> = {};
    let hasError = false;
    for (const field of selectedProvider.fields) {
      if (field.required && !fieldValues[field.key]?.trim()) {
        newErrors[field.key] = true;
        hasError = true;
      }
    }

    if (hasError) {
      setFieldErrors(newErrors);
      return;
    }

    setAddedCredentials(prev => [
      ...prev.filter(c => c.provider.id !== selectedProvider.id),
      { provider: selectedProvider, values: { ...fieldValues } },
    ]);
    setSelectedProvider(null);
    setFieldValues({});
    setFieldErrors({});
  };

  const handleDeleteCredential = (providerId: string) => {
    setAddedCredentials(prev => prev.filter(c => c.provider.id !== providerId));
  };

  const handleProvision = async () => {
    if (addedCredentials.length === 0) return;

    if (userData?.defaultUserNamespace) {
      const success = await handleOpenClawInstance(
        userData.defaultUserNamespace,
        addedCredentials,
        !devicePairingEnabled,
      );
      if (success) {
        resetForm();
      }
    }
  };

  const filteredProviders = useMemo(() => {
    const alreadyAdded = new Set(addedCredentials.map(c => c.provider.id));
    const query = searchQuery.toLowerCase();
    return PROVIDERS.filter(
      p => !alreadyAdded.has(p.id) && p.name.toLowerCase().includes(query),
    );
  }, [searchQuery, addedCredentials]);

  const groupedProviders = useMemo(() => {
    const groups: Partial<Record<ProviderCategory, ProviderConfig[]>> = {};
    for (const p of filteredProviders) {
      if (!groups[p.category]) {
        groups[p.category] = [];
      }
      groups[p.category]!.push(p);
    }
    return groups;
  }, [filteredProviders]);

  const dialogPaperSx = {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? '#383838'
        : theme.palette.background.paper,
  };

  if (openclawStatus === OpenClawStatus.READY) {
    return (
      <Dialog
        open={modalOpen}
        onClose={handleClose}
        fullWidth
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle
          variant="h3"
          sx={{ fontWeight: 700, padding: '32px 24px 0 24px' }}
        >
          <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
          >
            <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
            <div style={{ width: '30rem' }}>OpenClaw instance provisioned</div>
          </div>
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 16,
            top: 24,
            color: theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent
          sx={{ padding: '24px', backgroundColor: 'transparent !important' }}
        >
          <Typography
            variant="body1"
            sx={{ fontSize: '16px', fontWeight: 400 }}
          >
            Your OpenClaw instance is ready to use.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', pl: 3, pb: 3 }}>
          <Button
            variant="outlined"
            onClick={handleClose}
            sx={{
              textTransform: 'none',
              border: `1px solid ${theme.palette.primary.main}`,
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.04)',
                borderColor: '#1976d2',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (openclawStatus === OpenClawStatus.PROVISIONING) {
    return (
      <Dialog
        open={modalOpen}
        onClose={handleClose}
        fullWidth
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle
          variant="h3"
          sx={{ fontWeight: 700, padding: '32px 24px 0 24px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30rem' }}>Provisioning OpenClaw instance</div>
          </div>
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 16,
            top: 24,
            color: theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent
          sx={{
            padding: '6px 24px',
            backgroundColor: 'transparent !important',
          }}
        >
          <Typography
            variant="body1"
            sx={{ mr: 2, my: 0.5, fontSize: '16px', fontWeight: 400 }}
          >
            Provisioning is in progress. When ready, your instance will be
            available for use.
          </Typography>
          <div style={{ backgroundColor: 'transparent' }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: 4,
                mb: 4,
                backgroundColor: 'transparent',
              }}
            >
              <CircularProgress size="5rem" />
            </Box>
            <Alert variant="outlined" severity="info">
              <Typography
                variant="body1"
                sx={{ fontSize: '16px', fontWeight: 500 }}
              >
                You can close this modal. Follow the status of your instance on
                the OpenClaw sandbox card.
              </Typography>
            </Alert>
          </div>
          {openclawError && (
            <Typography
              color="error"
              style={{
                fontSize: '16px',
                fontWeight: 400,
                marginTop: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <ErrorIcon color="error" style={{ fontSize: '16px' }} />
                {openclawError}
              </div>
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', pl: 3 }}>
          <Button
            variant="outlined"
            onClick={handleClose}
            sx={{
              width: '15%',
              textTransform: 'none',
              marginTop: theme.spacing(2),
              marginBottom: theme.spacing(2),
              border: `1px solid ${theme.palette.primary.main}`,
              '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.04)',
                borderColor: '#1976d2',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={modalOpen}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle
        variant="h3"
        sx={{ fontWeight: 700, padding: '32px 24px 0 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div>Provision OpenClaw instance</div>
        </div>
      </DialogTitle>
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: 'absolute',
          right: 16,
          top: 24,
          color: theme.palette.grey[500],
        }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent
        sx={{ padding: '24px', backgroundColor: 'transparent !important' }}
      >
        <Typography
          variant="body1"
          sx={{ mb: 2, fontSize: '16px', fontWeight: 400 }}
        >
          Configure your AI provider credentials to provision an OpenClaw
          instance.
        </Typography>

        <Stack direction="row" spacing={2} sx={{ minHeight: 350 }}>
          {/* Left panel: provider list */}
          <Box
            sx={{
              width: 240,
              flexShrink: 0,
              borderRight: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TextField
              variant="filled"
              size="small"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              InputProps={{
                disableUnderline: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1, mr: 2 }}
            />
            <List
              sx={{
                overflow: 'auto',
                flex: 1,
                mr: 2,
                '& .v5-MuiListSubheader-root': {
                  lineHeight: '28px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                },
              }}
              dense
            >
              {(Object.keys(groupedProviders) as ProviderCategory[]).map(
                category => (
                  <React.Fragment key={category}>
                    <ListSubheader disableSticky>
                      {CATEGORY_LABELS[category]}
                    </ListSubheader>
                    {groupedProviders[category]!.map(provider => (
                      <ListItemButton
                        key={provider.id}
                        selected={selectedProvider?.id === provider.id}
                        onClick={() => {
                          setSelectedProvider(provider);
                          setFieldValues({});
                          setFieldErrors({});
                        }}
                        sx={{ borderRadius: 1, py: 0.5 }}
                      >
                        <ListItemText
                          primary={provider.name}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItemButton>
                    ))}
                  </React.Fragment>
                ),
              )}
              {filteredProviders.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2 }}
                >
                  No providers found.
                </Typography>
              )}
            </List>
          </Box>

          {/* Right panel: form + credential list */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {selectedProvider ? (
              <>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {selectedProvider.name}
                </Typography>
                <ProviderCredentialForm
                  provider={selectedProvider}
                  values={fieldValues}
                  errors={fieldErrors}
                  onChange={handleFieldChange}
                />
                <Stack direction="row" sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleAddCredential}
                    sx={{ textTransform: 'none' }}
                  >
                    Add Credential
                  </Button>
                </Stack>
              </>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Select a provider from the list to configure credentials.
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <CredentialList
              credentials={addedCredentials}
              onDelete={handleDeleteCredential}
              showEmptyState
            />
          </Box>
        </Stack>

        <FormControlLabel
          control={
            <Switch
              checked={devicePairingEnabled}
              onChange={e => setDevicePairingEnabled(e.target.checked)}
            />
          }
          label="Enable device pairing"
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'flex-start', pl: 3, pb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleProvision}
          disabled={addedCredentials.length === 0}
          sx={{
            textTransform: 'none',
            marginRight: theme.spacing(2),
            backgroundColor: '#1976d2',
            '&:hover': {
              backgroundColor: '#1565c0',
            },
          }}
        >
          Provision
        </Button>
        <Button
          variant="outlined"
          onClick={handleClose}
          sx={{
            textTransform: 'none',
            border: `1px solid ${theme.palette.primary.main}`,
            '&:hover': {
              backgroundColor: 'rgba(25, 118, 210, 0.04)',
              borderColor: '#1976d2',
            },
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OpenClawLaunchInfoModalTwoPanel;
