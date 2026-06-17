import { openclawVertexJsonValidator } from '../openclaw-validators';

const validServiceAccount = JSON.stringify({
  type: 'service_account',
  project_id: 'my-project',
  private_key_id: 'key-id-123',
  private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
  client_email: 'sa@my-project.iam.gserviceaccount.com',
  client_id: '12345',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
});

const validAuthorizedUser = JSON.stringify({
  type: 'authorized_user',
  client_id: 'my-client-id.apps.googleusercontent.com',
  client_secret: 'secret-123',
  refresh_token: '1//refresh-token',
});

describe('openclawVertexJsonValidator', () => {
  it('returns no errors for an empty string', () => {
    expect(openclawVertexJsonValidator('')).toEqual([]);
  });

  it('returns no errors for valid service account JSON', () => {
    expect(openclawVertexJsonValidator(validServiceAccount)).toEqual([]);
  });

  it('returns no errors for valid authorized_user JSON', () => {
    expect(openclawVertexJsonValidator(validAuthorizedUser)).toEqual([]);
  });

  it('accepts authorized_user with optional quota_project_id', () => {
    const withQuota = JSON.stringify({
      type: 'authorized_user',
      client_id: 'my-client-id.apps.googleusercontent.com',
      client_secret: 'secret-123',
      refresh_token: '1//refresh-token',
      quota_project_id: 'my-quota-project',
    });
    expect(openclawVertexJsonValidator(withQuota)).toEqual([]);
  });

  it('returns error for invalid JSON syntax', () => {
    const errors = openclawVertexJsonValidator('{not valid json}');
    expect(errors).toEqual(['Please input valid JSON.']);
  });

  it.each(['null', '42', '"hello"', 'true', '[1,2]'])(
    'returns error when JSON is a non-object primitive: %s',
    (input: string) => {
      expect(openclawVertexJsonValidator(input)).toEqual([
        'Please input a valid JSON object.',
      ]);
    },
  );

  it('returns error when the "type" property is missing', () => {
    const json = JSON.stringify({ project_id: 'my-project' });
    const errors = openclawVertexJsonValidator(json);
    expect(errors).toEqual(['The "type" property is required']);
  });

  it('returns error for invalid type value', () => {
    const invalid = JSON.parse(validServiceAccount);
    invalid.type = 'wrong_type';
    const errors = openclawVertexJsonValidator(JSON.stringify(invalid));
    expect(errors).toEqual([
      'The "type" property must be "authorized_user" or "service_account"',
    ]);
  });

  it('returns error for a single missing required property', () => {
    const { project_id: _, ...rest } = JSON.parse(validServiceAccount);
    const errors = openclawVertexJsonValidator(JSON.stringify(rest));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('The "project_id" property is required'),
      ]),
    );
  });

  it('returns error for multiple missing required properties', () => {
    const json = JSON.stringify({ type: 'service_account' });
    const errors = openclawVertexJsonValidator(json);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('properties are required'),
      ]),
    );
  });

  it('returns error for invalid email format', () => {
    const invalid = JSON.parse(validServiceAccount);
    invalid.client_email = 'not-an-email';
    const errors = openclawVertexJsonValidator(JSON.stringify(invalid));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Invalid email format specified'),
      ]),
    );
  });

  it('returns error for invalid URI format', () => {
    const invalid = JSON.parse(validServiceAccount);
    invalid.auth_uri = 'not a uri';
    const errors = openclawVertexJsonValidator(JSON.stringify(invalid));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Invalid URI specified in "auth_uri"'),
      ]),
    );
  });

  it('returns combined errors for missing properties and invalid formats', () => {
    const invalid = JSON.parse(validServiceAccount);
    delete invalid.project_id;
    invalid.client_email = 'not-an-email';
    const errors = openclawVertexJsonValidator(JSON.stringify(invalid));
    const joined = errors.join(' ');
    expect(joined).toContain('The "project_id" property is required');
    expect(joined).toContain('Invalid email format specified');
  });

  it('returns error when a field has the wrong type', () => {
    const invalid = JSON.parse(validServiceAccount);
    invalid.project_id = 123;
    const errors = openclawVertexJsonValidator(JSON.stringify(invalid));
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'The "project_id" field must be of the "string" type',
        ),
      ]),
    );
  });

  it('returns multiple type errors when several fields have wrong types', () => {
    const invalid = JSON.parse(validServiceAccount);
    invalid.project_id = 123;
    invalid.private_key = true;
    const errors = openclawVertexJsonValidator(JSON.stringify(invalid));
    const joined = errors.join(' ');
    expect(joined).toContain(
      'The "project_id" field must be of the "string" type',
    );
    expect(joined).toContain(
      'The "private_key" field must be of the "string" type',
    );
  });

  it('returns multiple URI format errors when both auth_uri and token_uri are invalid', () => {
    const invalid = JSON.parse(validServiceAccount);
    invalid.auth_uri = 'not-a-uri';
    invalid.token_uri = 'also-not-a-uri';
    const errors = openclawVertexJsonValidator(JSON.stringify(invalid));
    const joined = errors.join(' ');
    expect(joined).toContain('Invalid URI specified in "auth_uri"');
    expect(joined).toContain('Invalid URI specified in "token_uri"');
  });

  it('validates authorized_user required fields', () => {
    const json = JSON.stringify({
      type: 'authorized_user',
      client_id: 'id',
    });
    const errors = openclawVertexJsonValidator(json);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('properties are required'),
      ]),
    );
  });
});
