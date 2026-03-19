import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { RestartAlt } from '@mui/icons-material';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Typography,
} from '@mui/material';
import React from 'react';
import { registerApiRef } from '../../api';
import { errorMessage } from '../../utils/common';
import ResetButtonState from './SandboxResetButtonState';
import { useSandboxContext } from '../../hooks/useSandboxContext';

/**
 * Decides which label is the correct one depending on the state of the reset
 * button, that is, how many times it has been clicked by the user.
 * @param state the state in which the reset button is right now.
 * @returns the corresponding label for the reset button.
 */
const getResetButtonLabel = (state: ResetButtonState): string => {
  switch (state) {
    case ResetButtonState.CLICKED:
      return 'I understand and I want to reset my workspaces';
    case ResetButtonState.SUBMITTING:
      return 'Resetting...';
    default:
      return 'Reset';
  }
};

/**
 * A component that is intended to be used in the "profile" dropdown of the
 * RHDH framework. Once clicked, it opens a modal to confirm the reset of the
 * user workspaces.
 */
const SandboxResetLink = () => {
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [resetButtonState, setResetButtonState] = React.useState(
    ResetButtonState.INITIAL,
  );

  const alertApi = useApi(alertApiRef);
  const signupApi = useApi(registerApiRef);

  const sandboxContext = useSandboxContext();

  // Since our custom link is wrapped in a Menu component, we want to prevent
  // the default behavior and propagation of any events, so that it works as
  // we want it to.
  const handleMenuLinkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  // Handles the "cancel" button's behavior.
  const handleCancel = (_: React.MouseEvent) => {
    setModalOpen(false);
    setResetButtonState(ResetButtonState.INITIAL);
  };

  // The reset button has three states in order to ensure that the user really
  // wants to perform the operation. Once the user confirms that they intended
  // to reset the workspaces, we submit a request to the back end.
  const handleResetButtonClick = async (_: React.MouseEvent) => {
    if (resetButtonState === ResetButtonState.INITIAL) {
      setResetButtonState(ResetButtonState.CLICKED);
      return;
    } else if (resetButtonState === ResetButtonState.CLICKED) {
      setResetButtonState(ResetButtonState.SUBMITTING);
    }

    try {
      await signupApi.resetWorkspaces();
    } catch (e) {
      alertApi.post({ message: errorMessage(e), severity: 'error' });
      setResetButtonState(ResetButtonState.INITIAL);

      return;
    }

    setModalOpen(false);
    setResetButtonState(ResetButtonState.INITIAL);
    alertApi.post({
      message:
        'The deletion of your workspaces has been scheduled. Please allow the system a few minutes for it to successfully complete the reset',
      severity: 'success',
    });
  };

  // When the user does not have any workspaces, we do not want to show the
  // link that opens the modal.
  if (!sandboxContext.userReady) {
    return null;
  }

  return (
    <React.Fragment>
      <MenuItem
        disableRipple
        disableTouchRipple
        onClick={handleMenuLinkClick}
        sx={{
          color: 'text.primary',
        }}
        style={{ minHeight: '44px' }}
      >
        <RestartAlt
          color="action"
          fontSize="small"
          sx={{ marginRight: '0.5rem', color: 'text.secondary' }}
        />
        <Typography sx={{ fontSize: '14px' }}>Reset workspaces</Typography>
      </MenuItem>
      <Dialog onClose={handleCancel} open={isModalOpen}>
        <DialogTitle>Reset your workspaces</DialogTitle>
        <DialogContent>
          <DialogContentText
            id="alert-dialog-description"
            color="textPrimary"
            style={{
              fontSize: '16px',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Restore all settings to their original defaults. This will delete
            all your data and revert the environment to its initial state. You
            cannot undo this.
          </DialogContentText>
          {resetButtonState !== ResetButtonState.INITIAL && (
            <Alert severity="warning" sx={{ marginTop: '25px' }}>
              You are about to perform a destructive operation. Please make sure
              that you want to do this.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleResetButtonClick}
            variant="outlined"
            color="error"
            disabled={resetButtonState === ResetButtonState.SUBMITTING}
          >
            {getResetButtonLabel(resetButtonState)}
          </Button>
          <Button onClick={handleCancel} variant="contained" autoFocus>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};

export default SandboxResetLink;
