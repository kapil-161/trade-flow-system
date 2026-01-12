interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class MarketDataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  
  // Default TTL values (in milliseconds)
  private readonly QUOTE_TTL = 30 * 1000; // 30 seconds for price data
  private readonly HISTORY_TTL = 2 * 60 * 1000; // 2 minutes for historical data (reduced to get today's data faster)
  private readonly BATCH_TTL = 30 * 1000; // 30 seconds for batch quotes
  
  // Rate limiting
  private lastFetchTime: number = 0;
  private readonly MIN_FETCH_INTERVAL = 1000; // Minimum 1 second between fetches
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, ttlMs?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttlMs || this.QUOTE_TTL),
    });
  }
  
  // Rate-limited fetch wrapper
  async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    
    if (timeSinceLastFetch < this.MIN_FETCH_INTERVAL) {
      await new Promise(resolve => 
        setTimeout(resolve, this.MIN_FETCH_INTERVAL - timeSinceLastFetch)
      );
    }
    
    this.lastFetchTime = Date.now();
    return fetch(url);
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
      
      // Fetch in small batches with delays
      const batchSize = 5;
      for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
        const batch = symbolsToFetch.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(async (symbol) => {
            try {
              return await this.getQuote(symbol);
            } catch {
              return null;
            }
          })
        );
        
        results.push(...batchResults.filter(r => r !== null));
        
        // Add delay between batches
        if (i + batchSize < symbolsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
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
      const hasToday = history.some(h => {
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
}

// Singleton instance
export const marketCache = new MarketDataCache();

// Cleanup expired entries every minute
setInterval(() => marketCache.cleanup(), 60 * 1000);
