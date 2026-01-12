import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Persistent cache that stores data to disk to survive server restarts
 * This dramatically reduces API calls by preserving cached data across deployments
 */
export class PersistentCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheDir: string;
  private cacheFile: string;
  private saveInterval: NodeJS.Timeout | null = null;
  private isDirty: boolean = false;

  constructor(cacheDir = ".cache") {
    this.cacheDir = path.resolve(process.cwd(), cacheDir);
    this.cacheFile = path.join(this.cacheDir, "market-data.json");
  }

  /**
   * Initialize cache - load from disk if available
   */
  async init(): Promise<void> {
    try {
      // Create cache directory if it doesn't exist
      if (!existsSync(this.cacheDir)) {
        await mkdir(this.cacheDir, { recursive: true });
      }

      // Load cache from disk if file exists
      if (existsSync(this.cacheFile)) {
        const data = await readFile(this.cacheFile, "utf-8");
        const entries: Array<[string, CacheEntry<any>]> = JSON.parse(data);

        const now = Date.now();
        let loadedCount = 0;
        let expiredCount = 0;

        // Only load non-expired entries
        for (const [key, entry] of entries) {
          if (now < entry.expiresAt) {
            this.cache.set(key, entry);
            loadedCount++;
          } else {
            expiredCount++;
          }
        }

        console.log(`[persistent-cache] Loaded ${loadedCount} entries from disk (${expiredCount} expired entries discarded)`);
      } else {
        console.log("[persistent-cache] No cache file found, starting fresh");
      }

      // Auto-save every 5 minutes if cache is dirty
      this.saveInterval = setInterval(() => {
        if (this.isDirty) {
          this.saveToDisk().catch(err =>
            console.error("[persistent-cache] Auto-save failed:", err)
          );
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error("[persistent-cache] Failed to initialize:", error);
      // Continue without cached data
    }
  }

  /**
   * Save cache to disk
   */
  private async saveToDisk(): Promise<void> {
    try {
      const entries = Array.from(this.cache.entries());
      await writeFile(this.cacheFile, JSON.stringify(entries, null, 2));
      this.isDirty = false;
      console.log(`[persistent-cache] Saved ${entries.length} entries to disk`);
    } catch (error) {
      console.error("[persistent-cache] Failed to save to disk:", error);
    }
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.isDirty = true;
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached value
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlMs,
    });
    this.isDirty = true;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.isDirty = true;
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    let removed = 0;

    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.isDirty = true;
      console.log(`[persistent-cache] Cleaned up ${removed} expired entries`);
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: string[]; oldestEntry: number | null } {
    const entries = Array.from(this.cache.entries());
    const oldestEntry = entries.length > 0
      ? Math.min(...entries.map(([_, e]) => e.timestamp))
      : null;

    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      oldestEntry,
    };
  }

  /**
   * Gracefully shutdown - save cache to disk
   */
  async shutdown(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    if (this.isDirty) {
      await this.saveToDisk();
    }

    console.log("[persistent-cache] Shutdown complete");
  }
}

// Singleton instance
export const persistentCache = new PersistentCache();

// Initialize cache on startup
persistentCache.init().catch(err =>
  console.error("[persistent-cache] Initialization failed:", err)
);

// Cleanup expired entries every 30 minutes
setInterval(() => persistentCache.cleanup(), 30 * 60 * 1000);

// Save cache on process exit
process.on("SIGINT", async () => {
  await persistentCache.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await persistentCache.shutdown();
  process.exit(0);
});
