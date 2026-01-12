import { useEffect, useRef, useState, useCallback } from "react";
import type { Quote } from "./api";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface PriceUpdate {
  type: "price_update";
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  name: string;
}

interface UpdatesMessage {
  type: "updates";
  updates: PriceUpdate[];
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private subscribers: Map<string, Set<(data: Quote) => void>> = new Map();
  private subscribedSymbols: Set<string> = new Set();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 3000;
  private isPageVisible = true;
  private activeSubscriptions = 0; // Track how many components are using WebSocket

  connect() {
    // Only connect if we have active subscriptions
    if (this.activeSubscriptions === 0) {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;
        
        // Resubscribe to all symbols
        if (this.subscribedSymbols.size > 0) {
          this.subscribe(Array.from(this.subscribedSymbols));
        }
      };

      this.ws.onmessage = (event) => {
        // Only process updates if page is visible
        if (!this.isPageVisible) {
          return;
        }

        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === "updates") {
            const updatesMsg = message as UpdatesMessage;
            updatesMsg.updates.forEach((update) => {
              const quote: Quote = {
                symbol: update.symbol,
                price: update.price,
                previousClose: update.price - update.change,
                change: update.change,
                changePercent: update.changePercent,
                volume: update.volume,
                name: update.name,
              };

              // Notify all subscribers for this symbol
              const callbacks = this.subscribers.get(update.symbol);
              if (callbacks) {
                callbacks.forEach((callback) => callback(quote));
              }
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.ws = null;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
      this.connect();
    }, this.RECONNECT_DELAY);
  }

  subscribe(symbols: string[]) {
    const newSymbols = symbols.filter(s => !this.subscribedSymbols.has(s));
    
    if (newSymbols.length === 0) return;

    newSymbols.forEach(symbol => {
      this.subscribedSymbols.add(symbol);
      if (!this.subscribers.has(symbol)) {
        this.subscribers.set(symbol, new Set());
      }
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "subscribe",
        symbols: newSymbols,
      }));
    }
  }

  unsubscribe(symbols: string[]) {
    symbols.forEach(symbol => {
      this.subscribedSymbols.delete(symbol);
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "unsubscribe",
        symbols,
      }));
    }
  }

  onPriceUpdate(symbol: string, callback: (quote: Quote) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    
    this.subscribers.get(symbol)!.add(callback);
    this.activeSubscriptions++;

    // Subscribe to this symbol if not already subscribed
    if (!this.subscribedSymbols.has(symbol)) {
      this.subscribe([symbol]);
    }

    // Connect if not already connected
    if (this.activeSubscriptions === 1) {
      this.setupPageVisibility();
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(symbol);
      if (callbacks) {
        callbacks.delete(callback);
        this.activeSubscriptions = Math.max(0, this.activeSubscriptions - 1);
        
        if (callbacks.size === 0) {
          this.unsubscribe([symbol]);
        }

        // Disconnect if no active subscriptions
        if (this.activeSubscriptions === 0) {
          this.disconnect();
        }
      }
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.subscribers.clear();
    this.subscribedSymbols.clear();
    this.activeSubscriptions = 0;
  }

  // Handle page visibility changes
  private setupPageVisibility() {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      this.isPageVisible = !document.hidden;
      
      if (this.isPageVisible) {
        // Page became visible - reconnect if needed
        if (this.activeSubscriptions > 0 && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.connect();
        }
      } else {
        // Page hidden - can pause updates (server will still send but we ignore them)
        console.log("Page hidden, pausing WebSocket updates");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
}

// Singleton instance
const wsManager = new WebSocketManager();

// Don't auto-connect - only connect when components actually need it

export function useRealtimeQuote(symbol: string | null): Quote | null {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    if (!symbol) {
      setQuote(null);
      return;
    }

    const unsubscribe = wsManager.onPriceUpdate(symbol, (updatedQuote) => {
      setQuote(updatedQuote);
    });

    return unsubscribe;
  }, [symbol]);

  return quote;
}

export function useRealtimeQuotes(symbols: string[]): Map<string, Quote> {
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());

  useEffect(() => {
    if (symbols.length === 0) {
      setQuotes(new Map());
      return;
    }

    // Subscribe to all symbols
    wsManager.subscribe(symbols);

    const unsubscribers = symbols.map(symbol => 
      wsManager.onPriceUpdate(symbol, (quote) => {
        setQuotes(prev => {
          const newMap = new Map(prev);
          newMap.set(symbol, quote);
          return newMap;
        });
      })
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [symbols.join(",")]);

  return quotes;
}

export { wsManager };
