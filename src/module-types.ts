/**
 * Module System — type definitions.
 *
 * Modules extend ModuleRunner and communicate via the kernel bus (RPC + pub/sub).
 * Modules import from '@pons/sdk' instead of gateway internals.
 */

export type PermissionRisk = 'low' | 'medium' | 'high';

// ─── Module Manifest ─────────────────────────────────────────

export interface ModulePermissionDeclaration {
  scope: string;
  description: string;
  risk?: PermissionRisk;
}

export interface ModuleCommandDeclaration {
  name: string;
  description: string;
  args?: { name: string; description: string; required: boolean; choices?: string[] }[];
  category?: string;
}

export interface ModuleCliDeclaration {
  /** Entry point file for CLI commands, relative to module dir. Default: "cli.ts" */
  entrypoint?: string;
}

export interface ModuleManifest {
  id: string;
  /** Entry point file relative to module directory. Default: 'runner.ts' */
  entrypoint?: string;
  name: string;
  /** Resolved at load time from deno.json — not specified in module.json. */
  version?: string;
  description?: string;
  /** Config key path in AppConfig. Module disabled if resolved value has enabled === false. */
  configKey?: string;
  /** Path to config schema file relative to module directory (e.g. "./src/config.schema.ts"). */
  configSchema?: string;
  /** Hard dependencies — must be loaded first. */
  dependencies?: string[];
  /** Soft dependencies — loaded first if present, but absence is fine. */
  optionalDependencies?: string[];
  /** Ordering priority within same dependency tier (lower = earlier). Default: 100. */
  priority?: number;
  /** Hook points this module registers (e.g. ['after_response']). Used by loadHooksOnly(). */
  hooks?: string[];
  /** Bus topics this module subscribes to (kernel routes matching published messages) */
  subscribes?: string[];
  /** Permission scopes this module registers. */
  permissions?: ModulePermissionDeclaration[];
  /** Slash commands this module provides for the web UI. */
  commands?: ModuleCommandDeclaration[];
  /** Service keys this module provides (validated after register()). */
  provides?: string[];
  /** Service keys this module requires (fatal if missing before register()). */
  requires?: string[];
  /** Service keys this module uses if available (no error if missing). */
  optionalRequires?: string[];
  /** Top-level config sections this module depends on. When these sections change, the module is restarted. */
  configDependencies?: string[];
  /** Deno runtime permission flags (e.g. ['--allow-net=0.0.0.0:18790', '--allow-read', '--allow-env']). Defaults to ['--allow-all'] if omitted. */
  runtimePermissions?: string[];
  /** CLI command extension — registers subcommands under an existing CLI command group. */
  cli?: ModuleCliDeclaration;
}
