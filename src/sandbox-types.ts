// ─── Sandbox Types ───────────────────────────────────────────

export type SandboxStatus = 'created' | 'running' | 'stopped' | 'destroyed';

export interface SandboxConfig {
  id: string;
  agentId: string;
  sessionId: string;
  label?: string;
  template?: string;
  timeoutMs?: number;
}

export interface SandboxState {
  id: string;
  agentId: string;
  sessionId: string;
  label?: string;
  status: SandboxStatus;
  previewUrl?: string;
  previewPort?: number;
  files: string[];
  createdAt: string;
  lastActiveAt: string;
  pid?: number;
}

export interface SandboxFile {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface SandboxEvent {
  type: string;
  sandboxId: string;
  agentId: string;
  sessionId: string;
  channelId?: string;
  data?: unknown;
}
