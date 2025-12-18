/**
 * VeilForms - OAuth Authentication Buttons
 * Reusable OAuth provider buttons for login and registration
 */

'use client';

import { GitHubIcon, GoogleIcon } from './OAuthIcons';

interface OAuthButtonsProps {
  disabled?: boolean;
  mode?: 'login' | 'register';
}

export function OAuthButtons({ disabled = false, mode = 'login' }: OAuthButtonsProps) {
  const handleOAuth = (provider: 'github' | 'google') => {
    window.location.href = `/api/auth/${provider}`;
  };

  const buttonText = {
    github: mode === 'login' ? 'Continue with GitHub' : 'Sign up with GitHub',
    google: mode === 'login' ? 'Continue with Google' : 'Sign up with Google',
  };

  return (
    <div className="oauth-buttons">
      <button
        type="button"
        className="btn-oauth btn-github"
        onClick={() => handleOAuth('github')}
        disabled={disabled}
      >
        <GitHubIcon />
        <span>{buttonText.github}</span>
      </button>
      <button
        type="button"
        className="btn-oauth btn-google"
        onClick={() => handleOAuth('google')}
        disabled={disabled}
      >
        <GoogleIcon />
        <span>{buttonText.google}</span>
      </button>
    </div>
  );
}
