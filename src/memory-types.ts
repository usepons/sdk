export interface Memory {
  id: string;
  type: "fact" | "preference" | "decision" | "project" | "reflection";
  content: string;
  source: { agentId: string; sessionId?: string; turnIndex?: number };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Transcript {
  sessionId: string;
  agentId: string;
  entries: TranscriptEntry[];
}

export interface TranscriptEntry {
  role: "user" | "assistant" | "tool_call" | "tool_result" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
