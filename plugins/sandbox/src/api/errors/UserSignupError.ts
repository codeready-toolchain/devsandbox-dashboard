import { CommonResponse } from '../../types';

/**
 * Defines the error type that is useful for problems with the user's signup.
 */
export default class UserSignupError extends Error {
  constructor(readonly message: string) {
    super(message);
  }

  /**
   * Creates the error from the given response, by attempting to read and set
   * a user friendly error message.
   * @param response the response to process.
   * @returns a user friendly error message.
   */
  static async fromResponse(response: Response): Promise<UserSignupError> {
    const defaultErrorMessage: string =
      'Unable to sign you up into Developer Sandbox. Please contact devsandbox@redhat.com';

    if (response.status === 500) {
      return new UserSignupError(defaultErrorMessage);
    }

    let body: CommonResponse | undefined;
    try {
      body = await response.json();
    } catch {
      return new UserSignupError(defaultErrorMessage);
    }

    if (!body || !body.message) {
      return new UserSignupError(defaultErrorMessage);
    }

    const { message, details } = body;
    switch (true) {
      case message.includes('invalid code'): {
        const baseErrMessage = 'The provided activation code is invalid';
        if (details) {
          return new UserSignupError(`${baseErrMessage}: ${details}`);
        } else {
          return new UserSignupError(baseErrMessage);
        }
      }
      case message.includes('has been suspended'):
        return new UserSignupError(
          'Access to the Developer Sandbox has been suspended due to suspicious activity or detected abuse',
        );
      case message.includes('has been denied'):
        return new UserSignupError(
          'Access to the Developer Sandbox has been denied',
        );
      case message.includes('failed to create usersignup for'):
        return new UserSignupError('A CRT admin is not allowed to sign up');
      case message.includes(
        'there is already an active UserSignup with such a username',
      ):
        return new UserSignupError(
          'An account is already signed up to Developer Sandbox with your username',
        );
      default:
        return new UserSignupError(defaultErrorMessage);
    }
  }
}
