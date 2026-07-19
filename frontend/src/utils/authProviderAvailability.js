const enabled = (value) => value !== false && String(value).toLowerCase() !== 'false';

export const resolveAuthProviderAvailability = (runtime = {}) => ({
  email: {
    login: enabled(runtime.auth_email_login_enabled),
    registration: enabled(runtime.auth_email_registration_enabled)
  },
  google: {
    login: enabled(runtime.auth_google_login_enabled),
    registration: enabled(runtime.auth_google_registration_enabled)
  },
  apple: {
    login: enabled(runtime.auth_apple_login_enabled),
    registration: enabled(runtime.auth_apple_registration_enabled)
  }
});
