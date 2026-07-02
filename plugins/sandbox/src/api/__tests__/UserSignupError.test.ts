import { createMockResponse } from '../../test-utils/mockResponse';
import UserSignupError from '../errors/UserSignupError';

describe('user signup error', () => {
  const defaultErrorMessage: string =
    'Unable to sign you up into Developer Sandbox. Please contact devsandbox@redhat.com';

  it('sets a message when using the main constructor', () => {
    const errorMsg = 'test error msg';

    // Call the function under test.
    const userSignupError = new UserSignupError(errorMsg);

    expect(userSignupError.message).toBe(errorMsg);
  });

  it('returns the default error message on internal server errors', async () => {
    const response = createMockResponse({
      ok: false,
      status: 500,
    });

    // Call the function under test.
    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(defaultErrorMessage);
  });

  it('returns the default error message when the response body is not valid JSON', async () => {
    const response = createMockResponse({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('invalid json')),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(defaultErrorMessage);
  });

  it('returns the default error message when the response body is null', async () => {
    const response = createMockResponse({
      ok: false,
      status: 400,
      json: () => Promise.resolve(null),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(defaultErrorMessage);
  });

  it('returns the default error message when the response body has no message field', async () => {
    const response = createMockResponse({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ details: 'some detail' }),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(defaultErrorMessage);
  });

  it('returns the invalid code message with details', async () => {
    const response = createMockResponse({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          message: 'invalid code provided',
          details: 'code ABC123 is not recognized',
        }),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(
      'The provided activation code is invalid: code ABC123 is not recognized',
    );
  });

  it('returns the suspended message', async () => {
    const response = createMockResponse({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          message: 'user has been suspended',
        }),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(
      'Access to the Developer Sandbox has been suspended due to suspicious activity or detected abuse',
    );
  });

  it('returns the denied message', async () => {
    const response = createMockResponse({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          message: 'user has been denied',
        }),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(
      'Access to the Developer Sandbox has been denied',
    );
  });

  it('returns the admin not allowed message', async () => {
    const response = createMockResponse({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          message: 'failed to create usersignup for admin-user',
        }),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(
      'A CRT admin is not allowed to sign up',
    );
  });

  it('returns the already signed up message', async () => {
    const response = createMockResponse({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          message: 'there is already an active UserSignup with such a username',
        }),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(
      'An account is already signed up to Developer Sandbox with your username',
    );
  });

  it('returns the default error message for an unrecognized message', async () => {
    const response = createMockResponse({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          message: 'some completely unexpected error from the backend',
        }),
    });

    const userSignupError = await UserSignupError.fromResponse(response);

    expect(userSignupError.message).toBe(defaultErrorMessage);
  });
});
