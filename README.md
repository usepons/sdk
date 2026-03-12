# @pons/sdk

SDK for building [Pons](https://github.com/usepons) modules — the building blocks of a Pons system.

Pons is a modular microkernel platform where each module runs as an isolated process, communicating through a central kernel via IPC. This SDK provides the base class, type definitions, and utilities you need to create a module.

## Install

```ts
// deno.json
{
  "imports": {
    "@pons/sdk": "jsr:@pons/sdk@^0.2"
  }
}
```

## Quick Start

```ts
import { ModuleRunner } from "@pons/sdk";
import type { ModuleManifest } from "@pons/sdk";

class MyModule extends ModuleRunner {
  readonly manifest: ModuleManifest = {
    id: "my-module",
    name: "My Module",
    description: "Does something useful",
    subscribes: ["some.topic"],
  };

  protected override async onInit(): Promise<void> {
    this.log("info", "Module initialized");
  }

  protected override async onMessage(topic: string, payload: unknown): Promise<void> {
    this.log("info", `Received ${topic}`);
  }
}

new MyModule().start();
```

## Module Lifecycle

1. Kernel spawns your module as a child process
2. Kernel sends `init` with config and workspace paths
3. Your `onInit()` runs, then the SDK sends `ready` back with your manifest
4. Kernel delivers messages matching your `subscribes` topics via `onMessage()`
5. On shutdown, kernel sends `shutdown` and your `onShutdown()` runs

## Communication

### Pub/Sub

Publish events to the kernel bus. The kernel routes them to all modules subscribed to that topic.

```ts
this.publish("user.created", { id: "123", name: "Alice" });
```

### RPC (Cross-Module)

Call methods on other modules by service name. The target module handles requests in `onRequest()`.

```ts
// Caller
const result = await this.request<string>("llm", "chat.complete", { prompt: "Hello" });

// Provider (in another module)
protected override async onRequest(method: string, params: unknown): Promise<unknown> {
  if (method === "chat.complete") {
    return await this.complete(params);
  }
  throw new Error(`Unknown method: ${method}`);
}
```

### Kernel Calls

Call kernel-level services directly:

```ts
const services = await this.discoverServices();
const moduleId = await this.resolveService("llm");
```

## Config Schema

Define a typed config schema so the kernel can validate and merge your module's configuration:

```ts
// config.schema.ts
import { defineConfigSchema, z } from "@pons/sdk/config";

export default defineConfigSchema(
  z.object({
    port: z.number().default(8080),
    host: z.string().default("0.0.0.0"),
  }),
  {
    description: "Gateway settings",
    labels: { port: "HTTP Port", host: "Bind Address" },
  }
);
```

Reference it in your module manifest:

```ts
const manifest: ModuleManifest = {
  id: "gateway",
  name: "Gateway",
  configKey: "gateway",
  configSchema: "./config.schema.ts",
  // ...
};
```

## Module Manifest

Key manifest fields:

| Field | Description |
|---|---|
| `id` | Unique module identifier |
| `name` | Human-readable name |
| `subscribes` | Bus topics this module listens to |
| `provides` | Service keys this module exposes for RPC |
| `requires` | Services that must exist before this module starts |
| `optionalRequires` | Services used if available, no error if missing |
| `dependencies` | Modules that must load before this one |
| `configKey` | Path in the unified config object |
| `configSchema` | Path to config schema file |
| `hooks` | Hook points this module registers (e.g. `after_response`) |
| `commands` | Slash commands for the web UI |
| `permissions` | Permission scopes this module declares |
| `runtimePermissions` | Deno permission flags (defaults to `--allow-all`) |

## Utilities

```ts
import { safeId, toErrorMessage, getPonsHome } from "@pons/sdk";

safeId("user@email.com");   // "user_email_com"
toErrorMessage(err);         // extracts .message or stringifies
getPonsHome();               // PONS_HOME env or ~/.pons
```

## Exports

| Path | Contents |
|---|---|
| `@pons/sdk` | `ModuleRunner`, types, utilities |
| `@pons/sdk/config` | `defineConfigSchema`, `z` (Zod) |

## License

MIT
