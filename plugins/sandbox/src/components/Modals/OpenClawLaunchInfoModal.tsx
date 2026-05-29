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
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
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

type OpenClawLaunchInfoModalProps = {
  modalOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export const OpenClawLaunchInfoModal: React.FC<
  OpenClawLaunchInfoModalProps
> = ({ modalOpen, setOpen }) => {
  const theme = useTheme();
  const { userData, openclawError, openclawStatus, handleOpenClawInstance } =
    useSandboxContext();

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
      const value = fieldValues[field.key]?.trim();

      if (field.required && !value) {
        newErrors[field.key] = true;
        hasError = true;
      } else if (field.type === 'serviceAccountJson' && value) {
        try {
          const parsed = JSON.parse(value);
          if (
            parsed.type !== 'service_account' &&
            parsed.type !== 'authorized_user'
          ) {
            newErrors[field.key] = true;
            hasError = true;
          }
        } catch {
          newErrors[field.key] = true;
          hasError = true;
        }
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

  const availableProviders = useMemo(() => {
    const alreadyAdded = new Set(addedCredentials.map(c => c.provider.id));
    return PROVIDERS.filter(p => !alreadyAdded.has(p.id));
  }, [addedCredentials]);

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

  if (openclawStatus === OpenClawStatus.TERMINATING) {
    return (
      <Dialog
        open={modalOpen}
        onClose={handleClose}
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? '#383838'
                : theme.palette.background.paper,
          },
        }}
      >
        <DialogTitle
          variant="h3"
          sx={{ fontWeight: 700, padding: '32px 24px 0 24px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30rem' }}>
              Cleaning up previous OpenClaw instance
            </div>
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
            sx={{ mr: 2, my: 0.5, fontSize: '16px', fontWeight: 420 }}
          >
            Waiting for the previous instance to be fully removed before
            provisioning a new one.
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
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle
        variant="h3"
        sx={{ fontWeight: 700, padding: '32px 24px 0 24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '30rem' }}>Provision OpenClaw instance</div>
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

        <Autocomplete
          options={availableProviders}
          value={selectedProvider}
          onChange={(_, newValue) => {
            setSelectedProvider(newValue);
            const defaults: Record<string, string> = {};
            if (newValue) {
              for (const field of newValue.fields) {
                if (field.defaultValue) {
                  defaults[field.key] = field.defaultValue;
                }
              }
            }
            setFieldValues(defaults);
            setFieldErrors({});
          }}
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
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />

        {selectedProvider && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
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
          </Box>
        )}

        <CredentialList
          credentials={addedCredentials}
          onDelete={handleDeleteCredential}
          showEmptyState
        />

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

export default OpenClawLaunchInfoModal;
