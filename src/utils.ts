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
  // Use Deno APIs when available, fallback to Node compat
  try {
    const envHome = Deno.env.get('PONS_HOME');
    if (envHome) {
      if (envHome.startsWith('~')) {
        const home = Deno.env.get('HOME') ?? Deno.env.get('USERPROFILE') ?? '/root';
        return home + envHome.slice(1);
      }
      return envHome;
    }
    const home = Deno.env.get('HOME') ?? Deno.env.get('USERPROFILE') ?? '/root';
    return home + '/.pons';
  } catch {
    // Fallback for non-Deno environments (Node compat)
    // deno-lint-ignore no-explicit-any
    const proc = (globalThis as any).process as { env?: Record<string, string | undefined> } | undefined;
    const home = proc?.env?.['HOME'] ?? proc?.env?.['USERPROFILE'] ?? '/root';
    const envHome = proc?.env?.['PONS_HOME'];
    if (envHome) {
      if (envHome.startsWith('~')) return home + envHome.slice(1);
      return envHome;
    }
    return home + '/.pons';
  }
}
