import { verifyToken, getTokenFromHeader, revokeToken } from './lib/auth.js';
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

  try {
    const token = getTokenFromHeader(req.headers);

    if (!token) {
      return response.unauthorized('No token provided', headers);
    }

    // Verify token is valid before revoking
    const decoded = await verifyToken(token);
    if (!decoded) {
      return response.unauthorized('Invalid token', headers);
    }

    // Revoke the token using persistent blocklist
    const result = await revokeToken(token);

    if (!result.success) {
      console.error('Token revocation failed:', result.error);
      return response.serverError(headers, 'Logout failed');
    }

    return response.success({
      success: true,
      message: 'Logged out successfully'
    }, headers);
  } catch (err) {
    console.error('Logout error:', err);
    return response.serverError(headers, 'Logout failed');
  }
}

export const config = {
  path: '/api/auth/logout'
};
