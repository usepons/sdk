/**
 * Pure Logger interface — pino-compatible shape.
 *
 * Any pino.Logger structurally satisfies this interface,
 * so no consumer changes are needed.
 */
export interface Logger {
  level: string;

  trace(obj: unknown, msg?: string, ...args: unknown[]): void;
  trace(msg: string, ...args: unknown[]): void;

  debug(obj: unknown, msg?: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;

  info(obj: unknown, msg?: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;

  warn(obj: unknown, msg?: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;

  error(obj: unknown, msg?: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;

  fatal(obj: unknown, msg?: string, ...args: unknown[]): void;
  fatal(msg: string, ...args: unknown[]): void;

  child(bindings: Record<string, unknown>): Logger;

  isLevelEnabled?(level: string): boolean;
}
