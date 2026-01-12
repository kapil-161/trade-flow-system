import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { marketCache } from "./cache";

interface ClientData {
  ws: WebSocket;
  userId?: string;
  subscribedSymbols: Set<string>;
}

export class RealtimeMarketData {
  private wss: WebSocketServer;
  private clients: Set<ClientData> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL_MS = 60000; // Update every 1 minute to reduce API calls and prevent rate limiting

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws",
    });

    this.setupWebSocketServer();
    this.startPriceUpdates();
  }

  private setupWebSocketServer() {
    this.wss.on("connection", (ws: WebSocket, req) => {
      const client: ClientData = {
        ws,
        subscribedSymbols: new Set(),
      };

      this.clients.add(client);
      console.log(`WebSocket client connected. Total clients: ${this.clients.size}`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: "connected",
        message: "Connected to real-time market data",
      }));

      // Handle messages from client
      ws.on("message", async (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          
          switch (data.type) {
            case "subscribe":
              // Subscribe to symbols
              if (Array.isArray(data.symbols)) {
                data.symbols.forEach((symbol: string) => {
                  client.subscribedSymbols.add(symbol);
                });
                ws.send(JSON.stringify({
                  type: "subscribed",
                  symbols: Array.from(client.subscribedSymbols),
                }));
                console.log(`Client subscribed to: ${Array.from(client.subscribedSymbols).join(", ")}`);
              }
              break;

            case "unsubscribe":
              // Unsubscribe from symbols
              if (Array.isArray(data.symbols)) {
                data.symbols.forEach((symbol: string) => {
                  client.subscribedSymbols.delete(symbol);
                });
                ws.send(JSON.stringify({
                  type: "unsubscribed",
                  symbols: Array.from(client.subscribedSymbols),
                }));
              }
              break;

            case "ping":
              // Respond to ping
              ws.send(JSON.stringify({ type: "pong" }));
              break;
          }
        } catch (error) {
          console.error("Error handling WebSocket message:", error);
        }
      });

      // Handle client disconnect
      ws.on("close", () => {
        this.clients.delete(client);
        console.log(`WebSocket client disconnected. Total clients: ${this.clients.size}`);
      });

      // Handle errors
      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.clients.delete(client);
      });
    });
  }

  private async startPriceUpdates() {
    // Update prices periodically and broadcast to subscribed clients
    this.updateInterval = setInterval(async () => {
      if (this.clients.size === 0) return;

      // Collect all subscribed symbols across all clients
      const allSymbols = new Set<string>();
      this.clients.forEach(client => {
        client.subscribedSymbols.forEach(symbol => {
          allSymbols.add(symbol);
        });
      });

      if (allSymbols.size === 0) return;

      try {
        // Fetch latest prices for all subscribed symbols
        const symbolsArray = Array.from(allSymbols);
        
        // Only fetch if we have symbols and cache allows it
        if (symbolsArray.length === 0) return;
        
        const quotes = await marketCache.getMultiQuotes(symbolsArray);
        
        // If we got no quotes (possibly rate limited), skip this update
        if (quotes.length === 0) {
          console.log("[websocket] No quotes received, skipping update (possibly rate limited)");
          return;
        }

        // Broadcast updates to clients
        const updates = quotes.map(quote => ({
          type: "price_update",
          symbol: quote.symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume,
          name: quote.name,
        }));

        // Send updates to each client based on their subscriptions
        this.clients.forEach(client => {
          if (client.ws.readyState === WebSocket.OPEN && client.subscribedSymbols.size > 0) {
            const relevantUpdates = updates.filter(update => 
              client.subscribedSymbols.has(update.symbol)
            );
            
            if (relevantUpdates.length > 0) {
              client.ws.send(JSON.stringify({
                type: "updates",
                updates: relevantUpdates,
              }));
            }
          }
        });
      } catch (error) {
        console.error("Error updating prices:", error);
      }
    }, this.UPDATE_INTERVAL_MS);

    console.log(`Real-time market data updates started (${this.UPDATE_INTERVAL_MS}ms interval)`);
  }

  public stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.wss.close();
  }
}

let realtimeInstance: RealtimeMarketData | null = null;

export function setupWebSocket(server: Server): RealtimeMarketData {
  if (!realtimeInstance) {
    realtimeInstance = new RealtimeMarketData(server);
  }
  return realtimeInstance;
}
