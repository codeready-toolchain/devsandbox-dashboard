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
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ErrorIcon from '@mui/icons-material/Error';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSandboxContext } from '../../hooks/useSandboxContext';
import { OpenClawStatus } from '../../utils/openclaw-utils';

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

  const [apiKey, setApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleProvision = () => {
    if (!apiKey.trim()) {
      setApiKeyError(true);
      return;
    }
    setApiKeyError(false);
    if (userData?.defaultUserNamespace) {
      handleOpenClawInstance(userData.defaultUserNamespace, apiKey.trim());
    }
  };

  if (openclawStatus === OpenClawStatus.READY) {
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
          <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}
          >
            <CheckCircleIcon
              sx={{
                color: 'success.main',
                fontSize: 28,
              }}
            />
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
            sx={{ mr: 2, my: 0.5, fontSize: '16px', fontWeight: 420 }}
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
          sx={{ mb: 3, fontSize: '16px', fontWeight: 400 }}
        >
          Enter your API key to provision an OpenClaw instance.
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center', gap: '5px' }}>
          <InputLabel
            style={{
              width: '8rem',
              fontSize: '16px',
              fontWeight: 450,
            }}
          >
            API Key:
          </InputLabel>
          <TextField
            variant="filled"
            fullWidth
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => {
              setApiKey(e.target.value);
              if (apiKeyError) setApiKeyError(false);
            }}
            error={apiKeyError}
            helperText={apiKeyError ? 'API key is required' : ''}
            InputProps={{
              disableUnderline: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle API key visibility"
                    onClick={() => setShowApiKey(prev => !prev)}
                    edge="end"
                    size="small"
                  >
                    {showApiKey ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                fontWeight: 450,
                color: theme.palette.text.secondary,
                height: '2rem',
                width: '20rem',
                paddingY: '4px',
                '& .v5-MuiInputBase-input': {
                  paddingY: '10px',
                },
              },
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'flex-start', pl: 3, pb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleProvision}
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
