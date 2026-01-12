import { persistentCache } from "./persistent-cache";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class MarketDataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  // Extended TTL values (in milliseconds) - more aggressive caching to reduce API calls
  private readonly QUOTE_TTL = 10 * 60 * 1000; // 10 minutes for real-time quotes (increased from 5min)
  private readonly HISTORY_TTL = 2 * 60 * 60 * 1000; // 2 hours for historical data
  private readonly BATCH_TTL = 10 * 60 * 1000; // 10 minutes for batch quotes

  // Rate limiting - increased to avoid hitting Yahoo Finance limits
  private lastFetchTime: number = 0;
  private readonly MIN_FETCH_INTERVAL = 3000; // Minimum 3 seconds between fetches (increased from 2s)
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private consecutiveErrors = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private backoffUntil: number = 0;
  
  get<T>(key: string): T | null {
    // Check in-memory cache first (faster)
    const entry = this.cache.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      return entry.data as T;
    }

    // Check persistent cache (survives restarts)
    const persistent = persistentCache.get<T>(key);
    if (persistent) {
      // Copy to memory cache for faster access
      this.cache.set(key, {
        data: persistent,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.QUOTE_TTL,
      });
      return persistent;
    }

    return null;
  }
  
  set<T>(key: string, data: T, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs || this.QUOTE_TTL;

    // Store in both memory and persistent cache
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });

    // Also save to persistent cache for long-term storage
    persistentCache.set(key, data, ttl);
  }
  
  // Rate-limited fetch wrapper with proper headers and error handling
  async rateLimitedFetch(url: string, retryCount = 0): Promise<Response> {
    const now = Date.now();
    
    // Check if we're in backoff period (rate limited)
    if (now < this.backoffUntil) {
      const waitTime = this.backoffUntil - now;
      console.log(`[rate-limit] In backoff period, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const timeSinceLastFetch = now - this.lastFetchTime;
    if (timeSinceLastFetch < this.MIN_FETCH_INTERVAL) {
      await new Promise(resolve =>
        setTimeout(resolve, this.MIN_FETCH_INTERVAL - timeSinceLastFetch)
      );
    }

    this.lastFetchTime = Date.now();

    try {
      // Add browser-like headers to avoid being blocked
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://finance.yahoo.com',
          'Origin': 'https://finance.yahoo.com',
        },
      });

      // Handle rate limiting (429 Too Many Requests)
      if (response.status === 429) {
        this.consecutiveErrors++;
        const backoffTime = Math.min(60000 * Math.pow(2, retryCount), 300000); // Max 5 minutes
        this.backoffUntil = Date.now() + backoffTime;
        console.warn(`[rate-limit] Rate limited (429). Backing off for ${backoffTime}ms`);
        throw new Error(`Rate limited: ${response.status}`);
      }

      // Handle other errors
      if (!response.ok && response.status >= 500) {
        this.consecutiveErrors++;
        if (this.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
          const backoffTime = 60000; // 1 minute backoff
          this.backoffUntil = Date.now() + backoffTime;
          console.warn(`[rate-limit] Too many errors, backing off for ${backoffTime}ms`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      // Success - reset error counter
      if (response.ok) {
        this.consecutiveErrors = 0;
        this.backoffUntil = 0;
      }

      return response;
    } catch (error: any) {
      // Retry with exponential backoff for network errors
      if (retryCount < 3 && (error.message?.includes('fetch') || error.message?.includes('network'))) {
        const backoffTime = 1000 * Math.pow(2, retryCount);
        console.log(`[rate-limit] Retrying after ${backoffTime}ms (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return this.rateLimitedFetch(url, retryCount + 1);
      }
      throw error;
    }
  }
  
  // Get quote with caching
  async getQuote(symbol: string): Promise<any> {
    const cacheKey = `quote:${symbol}`;
    const cached = this.get<any>(cacheKey);
    
    if (cached) {
      console.log(`[cache] HIT for ${cacheKey}`);
      return cached;
    }
    
    console.log(`[cache] MISS for ${cacheKey}, fetching...`);
    
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const response = await this.rateLimitedFetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const result = data.chart.result[0];
      
      if (!result) {
        throw new Error("No data available");
      }
      
      const meta = result.meta;
      const price = meta.regularMarketPrice || 0;
      const previousClose = meta.previousClose || meta.chartPreviousClose || price;
      const change = price - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
      
      const quote = {
        symbol: meta.symbol,
        price,
        previousClose,
        change,
        changePercent,
        volume: meta.regularMarketVolume || 0,
        marketCap: meta.marketCap,
        name: meta.longName || meta.shortName || symbol,
      };
      
      this.set(cacheKey, quote, this.QUOTE_TTL);
      return quote;
    } catch (error) {
      console.error(`[cache] Error fetching ${symbol}:`, error);
      throw error;
    }
  }
  
  // Get multiple quotes with batching and caching
  async getMultiQuotes(symbols: string[]): Promise<any[]> {
    const results: any[] = [];
    const symbolsToFetch: string[] = [];
    
    // Check cache first
    for (const symbol of symbols) {
      const cacheKey = `quote:${symbol}`;
      const cached = this.get<any>(cacheKey);
      
      if (cached) {
        console.log(`[cache] HIT for ${cacheKey}`);
        results.push(cached);
      } else {
        symbolsToFetch.push(symbol);
      }
    }
    
    // Fetch missing symbols
    if (symbolsToFetch.length > 0) {
      console.log(`[cache] Fetching ${symbolsToFetch.length} symbols: ${symbolsToFetch.join(", ")}`);
      
      // Fetch in smaller batches with longer delays to avoid rate limits
      const batchSize = 3; // Reduced from 5 to 3
      for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
        const batch = symbolsToFetch.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (symbol) => {
            try {
              return await this.getQuote(symbol);
            } catch (error: any) {
              console.error(`[cache] Failed to fetch ${symbol}:`, error.message);
              // Return cached data if available, even if expired
              const cacheKey = `quote:${symbol}`;
              const staleCache = this.cache.get(cacheKey);
              if (staleCache) {
                console.log(`[cache] Using stale cache for ${symbol}`);
                return staleCache.data;
              }
              return null;
            }
          })
        );
        
        results.push(...batchResults.filter(r => r !== null));
        
        // Add longer delay between batches to avoid rate limits
        if (i + batchSize < symbolsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 500ms to 2s
        }
      }
    }
    
    return results;
  }
  
  // Get historical data with caching
  async getHistory(symbol: string, range: string, interval: string): Promise<any[]> {
    const cacheKey = `history:${symbol}:${range}:${interval}`;
    const cached = this.get<any[]>(cacheKey);
    
    if (cached) {
      console.log(`[cache] HIT for ${cacheKey}`);
      return cached;
    }
    
    console.log(`[cache] MISS for ${cacheKey}, fetching...`);
    
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
      const response = await this.rateLimitedFetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const result = data.chart.result[0];
      
      if (!result || !result.timestamp) {
        throw new Error("No data available");
      }
      
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      // Get the current price from meta if available (for today's incomplete data)
      const meta = result.meta;
      const currentPrice = meta?.regularMarketPrice;
      const currentTime = meta?.regularMarketTime;
      
      const history = timestamps.map((ts: number, i: number) => {
        const candleDate = new Date(ts * 1000);
        const isToday = candleDate.toDateString() === new Date().toDateString();
        
        // For today's data, use current price if close is null/undefined
        let close = quotes.close[i];
        if (isToday && (close == null || isNaN(close)) && currentPrice != null) {
          close = currentPrice;
        }
        
        return {
          date: candleDate.toISOString(),
          open: quotes.open[i] ?? close,
          high: quotes.high[i] ?? close,
          low: quotes.low[i] ?? close,
          close: close,
          volume: quotes.volume[i] ?? 0,
        };
      });
      
      // If today's data is not in the history, try to add it using current price
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const hasToday = history.some((h: any) => {
        const hDate = new Date(h.date);
        hDate.setHours(0, 0, 0, 0);
        return hDate.getTime() === today.getTime();
      });
      
      if (!hasToday && currentPrice != null && currentTime != null) {
        const todayDate = new Date(currentTime * 1000);
        history.push({
          date: todayDate.toISOString(),
          open: meta?.regularMarketPrice ?? currentPrice,
          high: meta?.regularMarketDayHigh ?? currentPrice,
          low: meta?.regularMarketDayLow ?? currentPrice,
          close: currentPrice,
          volume: meta?.regularMarketVolume ?? 0,
        });
      }
      
      this.set(cacheKey, history, this.HISTORY_TTL);
      return history;
    } catch (error) {
      console.error(`[cache] Error fetching history for ${symbol}:`, error);
      throw error;
    }
  }
  
  // Clear expired entries periodically
  cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  // Get cache stats
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  // Check if we're currently rate limited
  isRateLimited(): boolean {
    return Date.now() < this.backoffUntil;
  }

  // Get rate limit status
  getRateLimitStatus(): { 
    isLimited: boolean; 
    backoffUntil: number | null;
    consecutiveErrors: number;
  } {
    return {
      isLimited: this.isRateLimited(),
      backoffUntil: this.backoffUntil > 0 ? this.backoffUntil : null,
      consecutiveErrors: this.consecutiveErrors,
    };
  }
}

// Singleton instance
export const marketCache = new MarketDataCache();

// Cleanup expired entries every minute
setInterval(() => marketCache.cleanup(), 60 * 1000);
