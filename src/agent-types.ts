export interface AgentConfig {
  id: string;
  name: string;
  description?: string;
  model?: string;
  provider?: string;
  skills?: string[];
  personalSpace: string;
  soul?: string;
  identity?: string;
}

export interface SoulEvolutionProposal {
  agentId: string;
  field: "soul" | "identity";
  currentContent: string;
  proposedContent: string;
  reason: string;
  timestamp: string;
  status: "pending" | "approved" | "rejected";
}

export interface Session {
  id: string;
  agentId: string;
  senderId?: string;
  channelType: string;
  channelSessionId?: string;
  startedAt: string;
  lastActiveAt: string;
  status: "active" | "closed";
  metadata?: Record<string, unknown>;
}
