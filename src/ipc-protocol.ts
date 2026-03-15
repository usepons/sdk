/**
 * Kernel ↔ Module IPC Protocol — typed messages between kernel and module processes.
 *
 * Lives in shared so both kernel and modules can import without cross-package deps.
 *
 * Two communication patterns:
 *   1. Pub/Sub (in-memory, fire-and-forget) — events, middleware/interceptor patterns
 *   2. RPC (direct IPC routing) — request/response between modules
 */

import type { ModuleManifest } from './module-types.ts';

// ─── Kernel → Module ──────────────────────────────────────────

export type KernelMessage =
  /** Sent after fork — delivers config and workspace info */
  | { type: 'init'; config: unknown; workspacePath: string; projectRoot: string }
  /** Forward a published message to this subscriber */
  | { type: 'deliver'; id: string; topic: string; payload: unknown }
  /** Health check */
  | { type: 'ping' }
  /** Graceful shutdown request */
  | { type: 'shutdown' }
  /** Response to a module's kernel call */
  | { type: 'call:response'; id: string; result?: unknown; error?: string }
  /** Kernel calls a method on a module */
  | { type: 'call'; id: string; method: string; params?: unknown }
  /** Forward an RPC request from another module to this provider */
  | { type: 'rpc_request'; id: string; from: string; service: string; method: string; params?: unknown }
  /** Forward an RPC response from provider back to caller */
  | { type: 'rpc_response'; id: string; result?: unknown; error?: string }
  /** Hot-reload: push updated config to module */
  | { type: 'config:update'; config: unknown; changedSections: string[] }
  /** All required services are available — module can start deferred initialization */
  | { type: 'deps_ready' }
  /** An optional service declared in optionalRequires has become available */
  | { type: 'service_available'; service: string }
  /** Sent on first-ever spawn — triggers onInstall() lifecycle hook */
  | { type: 'install' };

// ─── Module → Kernel ──────────────────────────────────────────

export type ModuleMessage =
  /** Module is ready — declares its manifest */
  | { type: 'ready'; manifest: ModuleManifest }
  /** Log forwarding — kernel writes to the centralized log */
  | { type: 'log'; level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'; msg: string; data?: Record<string, unknown>; topic?: string }
  /** Grouped log — header line with sub-items rendered as a tree */
  | { type: 'log-group'; level: string; msg: string; data?: Record<string, unknown>; items: Array<{ msg: string; data?: Record<string, unknown> }> }
  /** Message processed successfully */
  | { type: 'ack'; id: string }
  /** Message processing failed (informational — kernel does not retry) */
  | { type: 'nack'; id: string; error: string }
  /** Module publishes a message to the bus (routed to subscribers) */
  | { type: 'publish'; topic: string; payload: unknown }
  /** Module calls a kernel service (config.get, service.discover, etc.) */
  | { type: 'call'; id: string; method: string; params?: unknown }
  /** Ping response */
  | { type: 'pong' }
  /** Response to a kernel's call request */
  | { type: 'call:response'; id: string; result?: unknown; error?: string }
  /** Module initiates RPC to another module's service */
  | { type: 'rpc_request'; id: string; service: string; method: string; params?: unknown }
  /** Module responds to an incoming RPC request */
  | { type: 'rpc_response'; id: string; result?: unknown; error?: string };
