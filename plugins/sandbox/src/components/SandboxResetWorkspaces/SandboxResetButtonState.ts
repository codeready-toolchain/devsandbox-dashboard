/**
 * Represents the reset button's state. The initial state is the one in which
 * the user has not clicked the button yet. "Clicked" represents the state in
 * which the user has clicked the button for the first time, and "Submitting"
 * represents a second click which gives permission to the UI to send the
 * corresponding request to the backend.
 */
enum ResetButtonState {
  INITIAL,
  CLICKED,
  SUBMITTING,
}

export default ResetButtonState;
