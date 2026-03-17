import type { StorageAdapter } from './storage.ts';

export interface SkillManifest {
  // OpenClaw-compatible fields
  name: string;
  description: string;
  homepage?: string;
  "user-invocable"?: boolean;
  "disable-model-invocation"?: boolean;
  "command-dispatch"?: "tool";
  "command-tool"?: string;
  "command-arg-mode"?: "raw";
  metadata?: {
    openclaw?: {
      emoji?: string;
      requires?: {
        bins?: string[];
        anyBins?: string[];
        env?: string[];
        config?: string[];
      };
      os?: string[];
      install?: Record<string, unknown>;
    };
  };
  // Pons extensions
  version?: string;
  author?: string;
  permissions?: string[];
  permissionScopes?: PermissionScope[];
  triggers?: string[];
  handlers?: boolean;
}

export interface PermissionScope {
  scope: string;
  description: string;
  risk?: "low" | "medium" | "high";
}

export interface SkillHandlerModule {
  createTools(services: SkillServices): SkillTool[];
  start?(): Promise<void>;
  stop?(): Promise<void>;
}

export interface SkillTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  confirmBefore?: boolean;
  handler: (params: unknown, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  agentId: string;
  sessionId: string;
  senderId?: string;
  channelType?: string;
  logger: { info: (msg: string, data?: Record<string, unknown>) => void; warn: (msg: string, data?: Record<string, unknown>) => void; error: (msg: string, data?: Record<string, unknown>) => void; debug: (msg: string, data?: Record<string, unknown>) => void };
}

export interface SkillRecord {
  manifest: SkillManifest;
  source: "workspace" | "managed" | "extra" | "personal";
  sourcePath: string;
  ready: boolean;
  missingRequirements: string[];
  promptText: string;
  tools: SkillTool[];
  agentId?: string;
}

export interface SkillServices {
  logger: ToolContext["logger"];
  storage: StorageAdapter;
  events: { publish: (topic: string, payload: unknown) => void };
  config: Record<string, unknown>;
  workspace: { personalSpace: string; dataDir: string };
}
