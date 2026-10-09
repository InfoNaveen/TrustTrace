import { NextResponse } from 'next/server';

/**
 * Standardized error response handler
 * Never exposes stack traces or internal details to the client
 */
export function createErrorResponse(
  error: unknown,
  userMessage: string = 'An internal error occurred. Please try again.',
  statusCode: number = 500
) {
  // Log full error server-side only
  if (error instanceof Error) {
    console.error('[API Error]', error.message);
    console.error('[Stack Trace]', error.stack);
  } else {
    console.error('[API Error]', error);
  }

  // Return sanitized response to client
  return NextResponse.json(
    { error: userMessage },
    { status: statusCode }
  );
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('JSON parse error:', error);
    return defaultValue;
  }
}
