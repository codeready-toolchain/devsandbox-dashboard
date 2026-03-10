import { Button } from '@mui/material';
import React, { useEffect, useRef } from 'react';
import ResetButtonState from './SandboxResetButtonState';

/**
 * The expected props to be passed to the component.
 */
type SandboxResetButtonProps = {
  handleResetButtonClick:
    | React.MouseEventHandler<HTMLButtonElement>
    | undefined;
  isResetModalOpen: boolean;
  resetButtonState: ResetButtonState;
};

/**
 * Decides which label is the correct one depending on the state of the reset
 * button, that is, how many times it has been clicked by the user, and the
 * confirmation seconds.
 * @param confirmationSeconds the current confirmation seconds' count.
 * @param state the state in which the reset button is right now.
 * @returns the corresponding label for the reset button.
 */
const getResetButtonLabel = (
  confirmationSeconds: number,
  state: ResetButtonState,
): string => {
  switch (state) {
    case ResetButtonState.CLICKED:
      if (confirmationSeconds > 0) {
        return `I understand and I want to reset my workspaces (${confirmationSeconds})`;
      } else {
        return 'I understand and I want to reset my workspaces';
      }
    case ResetButtonState.SUBMITTING:
      return 'Resetting...';
    default:
      return 'Reset';
  }
};

/**
 * SandboxResetButton is just a wrapper around the standard "Button" component
 * which will deal with three different states of the button:
 *
 * - An initial one which represents the default button state, where the user
 *   has still not clicked it yet.
 * - A "clicked" state which represents the user's first click, which disables
 *   the button for a few seconds before allowing the user to click it again
 *   to prevent accidents.
 * - A "submitting" state in which it gets disabled again while the UI is
 *   sending the request to the back end.
 */
export const SandboxResetButton = ({
  handleResetButtonClick,
  isResetModalOpen,
  resetButtonState,
}: SandboxResetButtonProps) => {
  const fiveSeconds = 5;
  const [confirmationSeconds, setConfirmationSeconds] =
    React.useState(fiveSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create a countdown for a few seconds after the user has clicked the
  // button for the first time.
  useEffect(() => {
    if (isResetModalOpen && resetButtonState === ResetButtonState.CLICKED) {
      setConfirmationSeconds(fiveSeconds);

      intervalRef.current = setInterval(() => {
        setConfirmationSeconds(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            return 0;
          }

          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isResetModalOpen, resetButtonState]);

  return (
    <Button
      onClick={handleResetButtonClick}
      variant="outlined"
      color="error"
      disabled={
        (resetButtonState === ResetButtonState.CLICKED &&
          confirmationSeconds > 0) ||
        resetButtonState === ResetButtonState.SUBMITTING
      }
    >
      {getResetButtonLabel(confirmationSeconds, resetButtonState)}
    </Button>
  );
};
