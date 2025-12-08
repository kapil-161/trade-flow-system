import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHoldingSchema, insertTradeSchema, insertWatchlistSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Market Data - Yahoo Finance proxy
  app.get("/api/market/quote/:symbol", async (req, res) => {
    const { symbol } = req.params;
    
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Symbol not found" });
      }

      const data = await response.json();
      const result = data.chart.result[0];
      
      if (!result) {
        return res.status(404).json({ error: "No data available" });
      }

      const meta = result.meta;
      const quote = {
        symbol: meta.symbol,
        price: meta.regularMarketPrice,
        previousClose: meta.previousClose,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
        volume: meta.regularMarketVolume,
        marketCap: meta.marketCap,
        name: meta.longName || meta.shortName || symbol,
      };

      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // Get historical price data
  app.get("/api/market/history/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const { range = "1mo", interval = "1d" } = req.query;

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return res.status(404).json({ error: "Symbol not found" });
      }

      const data = await response.json();
      const result = data.chart.result[0];
      
      if (!result || !result.timestamp) {
        return res.status(404).json({ error: "No data available" });
      }

      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];
      
      const history = timestamps.map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString(),
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i],
      }));

      res.json(history);
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch historical data" });
    }
  });

  // Multi-symbol quotes
  app.post("/api/market/quotes", async (req, res) => {
    const { symbols } = req.body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: "Symbols array is required" });
    }

    try {
      const quotes = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            const response = await fetch(url);
            const data = await response.json();
            const result = data.chart.result[0];
            const meta = result?.meta;

            if (!meta) return null;

            return {
              symbol: meta.symbol,
              price: meta.regularMarketPrice,
              previousClose: meta.previousClose,
              change: meta.regularMarketPrice - meta.previousClose,
              changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
              volume: meta.regularMarketVolume,
            };
          } catch {
            return null;
          }
        })
      );

      res.json(quotes.filter(q => q !== null));
    } catch (error) {
      console.error("Error fetching multiple quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  // Holdings CRUD
  app.get("/api/holdings", async (req, res) => {
    try {
      const holdings = await storage.getAllHoldings();
      res.json(holdings);
    } catch (error) {
      console.error("Error fetching holdings:", error);
      res.status(500).json({ error: "Failed to fetch holdings" });
    }
  });

  app.post("/api/holdings", async (req, res) => {
    try {
      const validatedData = insertHoldingSchema.parse(req.body);
      const holding = await storage.createHolding(validatedData);
      res.status(201).json(holding);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating holding:", error);
      res.status(500).json({ error: "Failed to create holding" });
    }
  });

  app.patch("/api/holdings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const holding = await storage.updateHolding(id, req.body);
      
      if (!holding) {
        return res.status(404).json({ error: "Holding not found" });
      }
      
      res.json(holding);
    } catch (error) {
      console.error("Error updating holding:", error);
      res.status(500).json({ error: "Failed to update holding" });
    }
  });

  app.delete("/api/holdings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHolding(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting holding:", error);
      res.status(500).json({ error: "Failed to delete holding" });
    }
  });

  // Trades CRUD
  app.get("/api/trades", async (req, res) => {
    try {
      const trades = await storage.getAllTrades();
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  app.post("/api/trades", async (req, res) => {
    try {
      const validatedData = insertTradeSchema.parse(req.body);
      const trade = await storage.createTrade(validatedData);
      
      // Update holdings when trade is executed
      const existingHolding = await storage.getHoldingBySymbol(validatedData.symbol);
      
      if (validatedData.side === "buy") {
        if (existingHolding) {
          // Update existing holding
          const newQuantity = parseFloat(existingHolding.quantity) + parseFloat(validatedData.quantity);
          const newAvgPrice = (
            (parseFloat(existingHolding.quantity) * parseFloat(existingHolding.avgPrice)) + 
            (parseFloat(validatedData.quantity) * parseFloat(validatedData.price))
          ) / newQuantity;
          
          await storage.updateHolding(existingHolding.id, {
            quantity: newQuantity.toString(),
            avgPrice: newAvgPrice.toFixed(2),
          });
        } else {
          // Create new holding - get asset info from market data
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${validatedData.symbol}?interval=1d&range=1d`;
            const response = await fetch(url);
            const data = await response.json();
            const meta = data.chart.result[0]?.meta;
            
            await storage.createHolding({
              symbol: validatedData.symbol,
              name: meta?.longName || meta?.shortName || validatedData.symbol,
              type: validatedData.symbol.match(/^(BTC|ETH|SOL|DOGE|ADA|XRP|DOT|MATIC|LINK|UNI|AAVE|AVAX|ATOM|ALGO|VET|FIL|XLM|NEAR|APT|ARB|OP)/) ? "crypto" : "stock",
              quantity: validatedData.quantity,
              avgPrice: validatedData.price,
            });
          } catch (error) {
            console.error("Error fetching asset info:", error);
          }
        }
      } else if (validatedData.side === "sell" && existingHolding) {
        const newQuantity = parseFloat(existingHolding.quantity) - parseFloat(validatedData.quantity);
        
        if (newQuantity <= 0) {
          await storage.deleteHolding(existingHolding.id);
        } else {
          await storage.updateHolding(existingHolding.id, {
            quantity: newQuantity.toString(),
          });
        }
      }
      
      res.status(201).json(trade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating trade:", error);
      res.status(500).json({ error: "Failed to create trade" });
    }
  });

  // Watchlist CRUD
  app.get("/api/watchlist", async (req, res) => {
    try {
      const watchlist = await storage.getAllWatchlist();
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", async (req, res) => {
    try {
      const validatedData = insertWatchlistSchema.parse(req.body);
      const item = await storage.addToWatchlist(validatedData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ error: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.removeFromWatchlist(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ error: "Failed to remove from watchlist" });
    }
  });

  // Portfolio analytics
  app.get("/api/portfolio/stats", async (req, res) => {
    try {
      const holdings = await storage.getAllHoldings();
      const trades = await storage.getAllTrades();
      
      // Get current prices for all holdings
      const symbols = holdings.map(h => h.symbol);
      const quotes = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
            const response = await fetch(url);
            const data = await response.json();
            const meta = data.chart.result[0]?.meta;
            return { symbol, price: meta?.regularMarketPrice || 0 };
          } catch {
            return { symbol, price: 0 };
          }
        })
      );

      const priceMap = Object.fromEntries(quotes.map(q => [q.symbol, q.price]));

      // Calculate total equity and P&L
      let totalEquity = 0;
      let totalCost = 0;

      holdings.forEach(holding => {
        const currentPrice = priceMap[holding.symbol] || 0;
        const quantity = parseFloat(holding.quantity);
        const avgPrice = parseFloat(holding.avgPrice);
        
        totalEquity += quantity * currentPrice;
        totalCost += quantity * avgPrice;
      });

      const totalPnL = totalEquity - totalCost;
      const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

      // Calculate win rate from trades
      const filledTrades = trades.filter(t => t.status === "filled");
      const winningTrades = filledTrades.filter(t => {
        const holding = holdings.find(h => h.symbol === t.symbol);
        if (!holding) return false;
        const currentPrice = priceMap[t.symbol] || 0;
        const tradePrice = parseFloat(t.price);
        return t.side === "buy" ? currentPrice > tradePrice : currentPrice < tradePrice;
      });
      const winRate = filledTrades.length > 0 ? (winningTrades.length / filledTrades.length) * 100 : 0;

      res.json({
        totalEquity,
        totalPnL,
        totalPnLPercent,
        winRate,
        totalTrades: filledTrades.length,
        sharpeRatio: 2.1, // Placeholder - requires historical return data for accurate calculation
      });
    } catch (error) {
      console.error("Error calculating portfolio stats:", error);
      res.status(500).json({ error: "Failed to calculate portfolio stats" });
    }
  });

  return httpServer;
}
