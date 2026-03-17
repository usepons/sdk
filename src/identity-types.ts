export interface IdentityLink {
  canonicalId: string;
  displayName: string;
  linkedSenders: LinkedSender[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkedSender {
  senderId: string;
  channelType: string;
  displayName?: string;
  linkedAt: string;
  linkedBy: "agent" | "user" | "admin";
}
