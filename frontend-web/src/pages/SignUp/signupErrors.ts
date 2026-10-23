export type SignupMode = 'open' | 'invite' | 'closed';

/** The signup mode the API reports; anything unexpected is treated as closed rather than open. */
export function parseSignupMode(response: unknown): SignupMode {
  const mode = (response as { data?: { data?: { mode?: unknown }; mode?: unknown } })?.data;
  const value = (mode?.data?.mode ?? mode?.mode) as unknown;
  return value === 'open' || value === 'invite' || value === 'closed' ? value : 'closed';
}

/** Maps a failed signup response to an i18n key; null means "use the generic failure message". */
export function signupErrorKey(error: unknown): string | null {
  const response = (error as { response?: { status?: number; data?: { data?: unknown } } })?.response;
  const payload = response?.data?.data;
  if (response?.status === 409 && payload === 'conflict userId') return 'signup.dupId';
  if (response?.status === 409 && payload === 'conflict email') return 'signup.dupEmail';
  if (response?.status === 403 && payload && typeof payload === 'object') {
    switch ((payload as { error?: unknown }).error) {
      case 'INVITE_REQUIRED':
        return 'signup.inviteRequired';
      case 'INVITE_INVALID':
        return 'signup.inviteInvalid';
      case 'SIGNUP_CLOSED':
        return 'signup.closed';
    }
  }
  if (response?.status === 429) return 'signup.tooMany';
  return null;
}
