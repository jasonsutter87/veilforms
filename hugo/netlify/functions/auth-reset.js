import { hashPassword, validatePassword, PASSWORD_REQUIREMENTS } from './lib/auth.js';
import { getPasswordResetToken, deletePasswordResetToken, updateUser } from './lib/storage.js';
import { checkRateLimit, getRateLimitHeaders } from './lib/rate-limit.js';
import { getCorsHeaders } from './lib/cors.js';
import * as response from './lib/responses.js';

export default async function handler(req, context) {
  const origin = req.headers.get('origin') || '';
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return response.noContent(headers);
  }

  if (req.method !== 'POST') {
    return response.methodNotAllowed(headers);
  }

  // Rate limit for password reset (5 per minute)
  const rateLimit = await checkRateLimit(req, { keyPrefix: 'reset', maxRequests: 5 });
  if (!rateLimit.allowed) {
    return response.tooManyRequests({ ...headers, ...getRateLimitHeaders(rateLimit) }, rateLimit.retryAfter);
  }

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return response.badRequest('Token and password are required', { ...headers, ...getRateLimitHeaders(rateLimit) });
    }

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return response.error(
        'Password does not meet requirements',
        { ...headers, ...getRateLimitHeaders(rateLimit) },
        400,
        { details: passwordCheck.errors, requirements: PASSWORD_REQUIREMENTS }
      );
    }

    // Validate token
    const tokenData = await getPasswordResetToken(token);
    if (!tokenData) {
      return response.badRequest('Invalid or expired reset link', { ...headers, ...getRateLimitHeaders(rateLimit) });
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user's password
    const updated = await updateUser(tokenData.email, { passwordHash });
    if (!updated) {
      return response.serverError({ ...headers, ...getRateLimitHeaders(rateLimit) }, 'Failed to update password');
    }

    // Delete the used token (one-time use)
    await deletePasswordResetToken(token);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Password reset successful for ${tokenData.email}`);
    }

    return response.success({
      success: true,
      message: 'Password has been reset successfully'
    }, { ...headers, ...getRateLimitHeaders(rateLimit) });
  } catch (err) {
    console.error('Reset password error:', err);
    return response.serverError(headers, 'An error occurred');
  }
}

export const config = {
  path: '/api/auth/reset'
};
