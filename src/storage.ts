export interface StorageAdapter {
  get<T>(collection: string, key: string): Promise<T | null>;
  set<T>(collection: string, key: string, value: T): Promise<void>;
  delete(collection: string, key: string): Promise<boolean>;
  list<T>(collection: string, filter?: StorageFilter): Promise<T[]>;
  search?(collection: string, query: string, opts?: SearchOpts): Promise<SearchResult[]>;
}

export interface SearchOpts {
  limit?: number;
  threshold?: number;
  mode?: "vector" | "keyword" | "hybrid";
}

export interface SearchResult {
  key: string;
  score: number;
  data: unknown;
}

export interface StorageFilter {
  where?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  orderBy?: string;
}
