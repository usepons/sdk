/**
 * Recommended error prefixes for consistent RPC error handling (spec §16.2).
 *
 * Usage:
 *   throw new Error(`${ERROR_PREFIX.METHOD_NOT_FOUND}someMethod`);
 */
export const ERROR_PREFIX = {
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND:',
  INVALID_PARAMS: 'INVALID_PARAMS:',
  TIMEOUT: 'TIMEOUT:',
  UNAVAILABLE: 'UNAVAILABLE:',
  INTERNAL: 'INTERNAL:',
} as const;
