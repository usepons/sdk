import type { StorageAdapter, StorageFilter } from './storage.ts';

export class FileStorageAdapter implements StorageAdapter {
  constructor(private readonly baseDir: string) {}

  private collectionPath(collection: string): string {
    return `${this.baseDir}/${collection}`;
  }

  private keyPath(collection: string, key: string): string {
    return `${this.collectionPath(collection)}/${key}.json`;
  }

  async get<T>(collection: string, key: string): Promise<T | null> {
    try {
      const text = await Deno.readTextFile(this.keyPath(collection, key));
      return JSON.parse(text) as T;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return null;
      throw e;
    }
  }

  async set<T>(collection: string, key: string, value: T): Promise<void> {
    const dir = this.collectionPath(collection);
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(this.keyPath(collection, key), JSON.stringify(value, null, 2));
  }

  async delete(collection: string, key: string): Promise<boolean> {
    try {
      await Deno.remove(this.keyPath(collection, key));
      return true;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return false;
      throw e;
    }
  }

  async list<T>(collection: string, filter?: StorageFilter): Promise<T[]> {
    const dir = this.collectionPath(collection);
    const results: T[] = [];
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (!entry.isFile || !entry.name.endsWith('.json')) continue;
        const text = await Deno.readTextFile(`${dir}/${entry.name}`);
        const item = JSON.parse(text) as T;
        if (filter?.where) {
          const matches = Object.entries(filter.where).every(
            ([k, v]) => (item as Record<string, unknown>)[k] === v
          );
          if (!matches) continue;
        }
        results.push(item);
      }
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return [];
      throw e;
    }
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }
}
