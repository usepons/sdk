/**
 * Configuration schema helpers for Pons modules.
 *
 * Modules export a config schema from a dedicated file (e.g. config.schema.ts).
 * The kernel discovers and merges these schemas into a unified AppConfig.
 */

import { z } from "zod";

export interface ConfigSchemaMeta<T extends z.ZodRawShape> {
  description?: string;
  /** Human-readable labels for top-level fields — used by CLI wizard */
  labels?: Partial<Record<keyof T, string>>;
}

export interface ConfigSchemaDefinition<T extends z.ZodRawShape = z.ZodRawShape> {
  schema: z.ZodObject<T>;
  meta?: ConfigSchemaMeta<T>;
}

/**
 * Define a config schema for a module.
 *
 * @example
 * ```typescript
 * import { defineConfigSchema, z } from "@pons/sdk/config";
 *
 * export default defineConfigSchema(
 *   z.object({
 *     port: z.number().default(8080),
 *     host: z.string().default("0.0.0.0"),
 *   }),
 *   { description: "Gateway settings", labels: { port: "HTTP Port", host: "Bind Address" } }
 * );
 * ```
 */
export function defineConfigSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  meta?: ConfigSchemaMeta<T>,
): ConfigSchemaDefinition<T> {
  return { schema, meta };
}

export { z } from "zod";
