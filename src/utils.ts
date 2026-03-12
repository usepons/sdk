import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

/** Sanitize a sender ID into a safe filename component. */
export function safeId(senderId: string): string {
  return senderId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

/** Extract a human-readable error message from an unknown thrown value. */
export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Resolve the Pons home directory.
 * Priority: PONS_HOME env var → ~/.pons
 */
export function getPonsHome(): string {
  const envHome = process.env['PONS_HOME'];
  if (envHome) {
    return envHome.startsWith('~')
      ? resolve(homedir(), envHome.slice(2))
      : resolve(envHome);
  }
  return join(homedir(), '.pons');
}