import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from './auth-utils';
import { createErrorResponse } from './api-error';

/**
 * Middleware wrapper to enforce authentication on API routes
 */
export async function withAuth(
  handler: (req: NextRequest, user: any) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      // Get authenticated user from session
      const user = await getAuthenticatedUser(req);
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in.' },
          { status: 401 }
        );
      }

      // Call the handler with the authenticated user
      return await handler(req, user);
    } catch (error) {
      return createErrorResponse(error, 'An internal error occurred. Please try again.');
    }
  };
}

/**
 * Middleware wrapper to enforce rate limiting based on user ID
 */
export async function withRateLimit(
  handler: (req: NextRequest, user: any) => Promise<NextResponse>,
  options: { limit?: number; windowMs?: number } = {}
) {
  const { limit = 10, windowMs = 60 * 60 * 1000 } = options;

  return async (req: NextRequest) => {
    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(req);
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in.' },
          { status: 401 }
        );
      }

      // Check rate limit based on user ID
      const { checkRateLimit } = await import('./rate-limit');
      const isAllowed = checkRateLimit(user.id, limit, windowMs);

      if (!isAllowed) {
        const { getRateLimitStatus } = await import('./rate-limit');
        const status = getRateLimitStatus(user.id, limit);
        const resetDate = new Date(status.resetTime).toISOString();
        
        return NextResponse.json(
          {
            error: `Rate limit exceeded. Maximum ${limit} requests per hour. Try again after ${resetDate}`,
          },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((status.resetTime - Date.now()) / 1000)) } }
        );
      }

      // Call the handler
      return await handler(req, user);
    } catch (error) {
      return createErrorResponse(error, 'An internal error occurred. Please try again.');
    }
  };
}
