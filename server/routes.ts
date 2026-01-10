import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHoldingSchema, insertTradeSchema, insertWatchlistSchema } from "@shared/schema";
import { z } from "zod";
import { marketCache } from "./cache";
import { BacktestEngine } from "./backtest";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Market Data - Yahoo Finance proxy with caching
  app.get("/api/market/quote/:symbol", async (req, res) => {
    const { symbol } = req.params;
    
    try {
      const quote = await marketCache.getQuote(symbol);
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // Get historical price data with caching
  app.get("/api/market/history/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const { range = "1mo", interval = "1d" } = req.query;

    try {
      const history = await marketCache.getHistory(
        symbol, 
        range as string, 
        interval as string
      );
      res.json(history);
    } catch (error) {
      console.error("Error fetching history:", error);
      res.status(500).json({ error: "Failed to fetch historical data" });
    }
  });

  // Multi-symbol quotes with caching
  app.post("/api/market/quotes", async (req, res) => {
    const { symbols } = req.body;
    
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: "Symbols array is required" });
    }

    try {
      const quotes = await marketCache.getMultiQuotes(symbols);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching multiple quotes:", error);
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  // Cache stats endpoint (for debugging)
  app.get("/api/cache/stats", (req, res) => {
    res.json(marketCache.getStats());
  });

  // Backtesting endpoint
  app.post("/api/backtest/run", async (req, res) => {
    const { symbol, range = "3mo", initialCapital = 10000, strategy } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: "Symbol is required" });
    }

    try {
      const engine = new BacktestEngine();
      const result = await engine.runMultiFactorStrategy(symbol, range, initialCapital, strategy);
      res.json(result);
    } catch (error) {
      console.error("Error running backtest:", error);
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  // Batch scan endpoint
  app.post("/api/backtest/batch-scan", async (req, res) => {
    const { symbols } = req.body;
    
    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: "Symbols array is required" });
    }

    try {
      const engine = new BacktestEngine();
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            // Using 3mo instead of 1mo to ensure we have enough data (min 50 candles)
            const result = await engine.runMultiFactorStrategy(symbol, "3mo", 10000);
            const lastData = result.historicalData[result.historicalData.length - 1];
            
            // Calculate real-time score for the last candle
            let score = 0;
            if (lastData.close > lastData.emaFast && lastData.emaFast > lastData.emaSlow) score += 3;
            if (lastData.rsi >= 40 && lastData.rsi <= 70) score += 2;
            
            return {
              symbol,
              signal: lastData.signal || (score >= 5 ? "buy" : "hold"),
              price: lastData.close,
              emaFast: lastData.emaFast,
              emaSlow: lastData.emaSlow,
              rsi: lastData.rsi,
              score: Math.min(10, score + 2),
            };
          } catch (e) {
            console.error(`Failed to scan ${symbol}:`, e);
            return null;
          }
        })
      );

      res.json(results.filter(Boolean));
    } catch (error) {
      console.error("Error in batch scan:", error);
      res.status(500).json({ error: "Batch scan failed" });
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
          // Create new holding - get asset info from cache
          try {
            const quote = await marketCache.getQuote(validatedData.symbol);
            
            await storage.createHolding({
              symbol: validatedData.symbol,
              name: quote.name || validatedData.symbol,
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

  // Portfolio analytics with caching
  app.get("/api/portfolio/stats", async (req, res) => {
    try {
      const holdings = await storage.getAllHoldings();
      const trades = await storage.getAllTrades();
      
      // Get current prices for all holdings using cache
      const symbols = holdings.map(h => h.symbol);
      const quotes = await marketCache.getMultiQuotes(symbols);

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
