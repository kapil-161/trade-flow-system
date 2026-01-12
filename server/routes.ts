import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertHoldingSchema, insertTradeSchema, insertWatchlistSchema, insertAlertSchema } from "@shared/schema";
import { z } from "zod";
import { marketCache } from "./cache";
import { BacktestEngine, TechnicalIndicators } from "./backtest";
import { requireAdmin, requireAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { calculateRiskAnalytics } from "./risk-analytics";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup WebSocket for real-time market data
  setupWebSocket(httpServer);
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Test database connection
      const users = await storage.getAllUsers();
      const rateLimitStatus = marketCache.getRateLimitStatus();
      res.json({ 
        status: "ok", 
        database: "connected", 
        users: users.length,
        rateLimit: rateLimitStatus,
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({ status: "error", database: "disconnected", error: String(error) });
    }
  });

  // Rate limit status endpoint
  app.get("/api/market/rate-limit-status", async (req, res) => {
    try {
      const status = marketCache.getRateLimitStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting rate limit status:", error);
      res.status(500).json({ error: "Failed to get rate limit status" });
    }
  });

  // One-time setup endpoint: Set first admin (only works if no admins exist)
  app.post("/api/setup/first-admin", async (req, res) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      // Check if any admins exist
      const allUsers = await storage.getAllUsers();
      const hasAdmins = allUsers.some(u => u.isAdmin === "true");
      
      if (hasAdmins) {
        return res.status(403).json({ error: "Admin already exists. Use admin panel to manage users." });
      }

      // Find the user
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Set as admin
      const updatedUser = await storage.updateUser(user.id, {
        isAdmin: "true",
      });

      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update user" });
      }

      res.json({
        success: true,
        message: `Successfully set ${username} as the first administrator`,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          isAdmin: true,
        },
      });
    } catch (error) {
      console.error("Error setting first admin:", error);
      res.status(500).json({ error: "Failed to set first admin" });
    }
  });

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
    const { symbols, config, scanDate } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({ error: "Symbols array is required" });
    }

    // Parse scan date if provided (format: YYYY-MM-DD or ISO string)
    let targetDate: Date | null = null;
    if (scanDate) {
      targetDate = new Date(scanDate);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ error: "Invalid scan date format" });
      }
      // Set to end of day to include that day's data
      targetDate.setHours(23, 59, 59, 999);
    }

    // Use provided config or defaults (matching backtest defaults)
    const strategyConfig = config || {
      emaFast: 21,
      emaSlow: 50,
      rsiLower: 45,
      rsiUpper: 65,
      scoreThreshold: 7,
      trendFilter: true,
      volatilityFilter: true,
    };

    try {
      const engine = new BacktestEngine();
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            // Using 3mo instead of 1mo to ensure we have enough data (min 50 candles)
            // If scanning a historical date, we need more data to ensure we have enough before that date
            const range = targetDate ? "1y" : "3mo";
            let history = await marketCache.getHistory(symbol, range, "1d");

            // Filter history to only include data up to the target date
            if (targetDate) {
              history = history.filter((h: any) => {
                const candleDate = new Date(h.date);
                return candleDate <= targetDate!;
              });
            }

            if (history.length < 50) {
              return null;
            }

            const closes = history.map((h: any) => h.close);
            const volumes = history.map((h: any) => h.volume);

            // Filter out any invalid data points (null, undefined, or NaN)
            const validIndices: number[] = [];
            for (let i = 0; i < closes.length; i++) {
              if (closes[i] != null && !isNaN(closes[i]) && volumes[i] != null && !isNaN(volumes[i])) {
                validIndices.push(i);
              }
            }

            // Need at least 50 valid data points
            if (validIndices.length < 50) {
              return null;
            }

            // Use only valid data points (maintain original indices for alignment)
            const validCloses = validIndices.map(i => closes[i]);
            const validVolumes = validIndices.map(i => volumes[i]);

            // Need at least 200 data points for EMA200 if trend filter is enabled
            const minDataPoints = strategyConfig.trendFilter ? 200 : Math.max(strategyConfig.emaSlow, 14);
            if (validCloses.length < minDataPoints) {
              return null;
            }

            // Calculate indicators using the configured parameters (matching backtest logic)
            const emaFast = TechnicalIndicators.ema(validCloses, strategyConfig.emaFast);
            const emaSlow = TechnicalIndicators.ema(validCloses, strategyConfig.emaSlow);
            const ema200 = TechnicalIndicators.ema(validCloses, 200);
            const rsi = TechnicalIndicators.rsi(validCloses, 14);
            const macd = engine.calculateMACD(validCloses);
            
            // Create candles array for ATR calculation
            const candles = validIndices.map((idx, i) => ({
              date: history[idx]?.date || new Date().toISOString(),
              open: history[idx]?.open ?? validCloses[i],
              high: history[idx]?.high ?? validCloses[i],
              low: history[idx]?.low ?? validCloses[i],
              close: validCloses[i],
              volume: validVolumes[i],
            }));
            const atr = TechnicalIndicators.atr(candles, 14);
            const avgVolume = engine.calculateSMA(validVolumes, 20);

            const lastIndex = validCloses.length - 1;
            const lastClose = validCloses[lastIndex];
            const lastEmaFast = emaFast[lastIndex];
            const lastEmaSlow = emaSlow[lastIndex];
            const lastEma200 = ema200[lastIndex];
            const lastRsi = rsi[lastIndex];
            const lastVolume = validVolumes[lastIndex];
            const lastAvgVolume = avgVolume[lastIndex];
            const lastMacdHistogram = macd.histogram[lastIndex];
            const prevMacdHistogram = macd.histogram[lastIndex - 1];
            const lastATR = atr[lastIndex];
            const prevATR = atr[lastIndex - 1];

            // Validate that we have valid indicator values (check for NaN)
            if (isNaN(lastEmaFast) || isNaN(lastEmaSlow) || isNaN(lastRsi) || isNaN(lastClose)) {
              return null;
            }

            // Apply trend filter: Price MUST be above 200 EMA for long-term health
            if (strategyConfig.trendFilter && !isNaN(lastEma200) && lastClose < lastEma200) {
              return null; // Skip if below 200 EMA
            }

            // Apply volatility filter: Don't signal if volatility is too low
            if (strategyConfig.volatilityFilter && lastIndex > 0 && 
                !isNaN(lastATR) && !isNaN(prevATR) && lastATR < prevATR * 0.8) {
              return null; // Skip if volatility dropped too much
            }

            // RSI Overbought/Oversold Filter: Don't signal buy if RSI is too high (overbought)
            // RSI above 70 is typically overbought and should not trigger buy signals
            if (lastRsi > 70) {
              return {
                symbol,
                signal: "hold",
                price: lastClose,
                emaFast: lastEmaFast,
                emaSlow: lastEmaSlow,
                rsi: lastRsi,
                score: 0,
                rsiDivergence: "none",
                volumeDivergence: "none",
              };
            }

            // Calculate real-time score using the SAME logic as backtest
            let score = 0;

            // 1. EMA Trend (3 points)
            if (lastClose > lastEmaFast && lastEmaFast > lastEmaSlow) {
              score += 3;
            }

            // 2. Volume Confirmation (2 points) - using actual volume vs average
            if (!isNaN(lastVolume) && !isNaN(lastAvgVolume) && lastVolume > lastAvgVolume * 1.2) {
              score += 2;
            }

            // 3. RSI Pullback zone (2 points) - only if RSI is in the sweet spot
            if (lastRsi >= strategyConfig.rsiLower && lastRsi <= strategyConfig.rsiUpper) {
              score += 2;
            }

            // 4. MACD Momentum (2 points)
            if (!isNaN(lastMacdHistogram) && !isNaN(prevMacdHistogram) && 
                lastMacdHistogram > 0 && lastMacdHistogram > prevMacdHistogram) {
              score += 2;
            }

            return {
              symbol,
              signal: score >= strategyConfig.scoreThreshold ? "buy" : "hold",
              price: lastClose,
              emaFast: lastEmaFast,
              emaSlow: lastEmaSlow,
              rsi: lastRsi,
              score: Math.min(10, score), // Max score is 9, cap at 10 for display
              rsiDivergence: "none", // Keep for backward compatibility but not used in scoring
              volumeDivergence: "none", // Keep for backward compatibility but not used in scoring
            };
          } catch (e) {
            console.error(`Failed to scan ${symbol}:`, e);
            return null;
          }
        })
      );

      res.json({
        results: results.filter(Boolean),
        scanDate: targetDate ? targetDate.toISOString() : new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error in batch scan:", error);
      res.status(500).json({ error: "Batch scan failed" });
    }
  });

  // Holdings CRUD
  app.get("/api/holdings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const holdings = await storage.getAllHoldings(user.id);
      res.json(holdings);
    } catch (error) {
      console.error("Error fetching holdings:", error);
      res.status(500).json({ error: "Failed to fetch holdings" });
    }
  });

  app.post("/api/holdings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertHoldingSchema.parse(req.body);
      const holding = await storage.createHolding({ ...validatedData, userId: user.id });
      res.status(201).json(holding);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating holding:", error);
      res.status(500).json({ error: "Failed to create holding" });
    }
  });

  app.patch("/api/holdings/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      const holding = await storage.updateHolding(id, user.id, req.body);
      
      if (!holding) {
        return res.status(404).json({ error: "Holding not found" });
      }
      
      res.json(holding);
    } catch (error) {
      console.error("Error updating holding:", error);
      res.status(500).json({ error: "Failed to update holding" });
    }
  });

  app.delete("/api/holdings/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      await storage.deleteHolding(id, user.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting holding:", error);
      res.status(500).json({ error: "Failed to delete holding" });
    }
  });

  app.delete("/api/holdings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const deletedCount = await storage.deleteAllHoldings(user.id);
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("Error deleting all holdings:", error);
      res.status(500).json({ error: "Failed to delete all holdings" });
    }
  });

  // Trades CRUD
  app.get("/api/trades", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const trades = await storage.getAllTrades(user.id);
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ error: "Failed to fetch trades" });
    }
  });

  app.post("/api/trades", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertTradeSchema.parse(req.body);
      const trade = await storage.createTrade({ ...validatedData, userId: user.id });
      
      // Update holdings when trade is executed
      const existingHolding = await storage.getHoldingBySymbol(validatedData.symbol, user.id);
      
      if (validatedData.side === "buy") {
        if (existingHolding) {
          // Update existing holding
          const newQuantity = parseFloat(existingHolding.quantity) + parseFloat(validatedData.quantity);
          const newAvgPrice = (
            (parseFloat(existingHolding.quantity) * parseFloat(existingHolding.avgPrice)) + 
            (parseFloat(validatedData.quantity) * parseFloat(validatedData.price))
          ) / newQuantity;
          
          await storage.updateHolding(existingHolding.id, user.id, {
            quantity: newQuantity.toString(),
            avgPrice: newAvgPrice.toFixed(2),
          });
        } else {
          // Create new holding - get asset info from cache
          try {
            const quote = await marketCache.getQuote(validatedData.symbol);
            
            await storage.createHolding({
              userId: user.id,
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
          await storage.deleteHolding(existingHolding.id, user.id);
        } else {
          await storage.updateHolding(existingHolding.id, user.id, {
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
  app.get("/api/watchlist", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const watchlist = await storage.getAllWatchlist(user.id);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertWatchlistSchema.parse(req.body);
      const item = await storage.addToWatchlist({ ...validatedData, userId: user.id });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ error: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      await storage.removeFromWatchlist(id, user.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ error: "Failed to remove from watchlist" });
    }
  });

  // Helper function to calculate Sharpe Ratio
  function calculateSharpeRatio(
    returns: number[], 
    riskFreeRate: number = 0,
    periodsPerYear: number = 252
  ): number {
    if (returns.length < 2) return 0;
    
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    // Annualize Sharpe Ratio
    const annualizedReturn = meanReturn * periodsPerYear;
    const annualizedStdDev = stdDev * Math.sqrt(periodsPerYear);
    const annualizedRiskFreeRate = riskFreeRate;
    
    return (annualizedReturn - annualizedRiskFreeRate) / annualizedStdDev;
  }

  // Portfolio analytics with caching
  app.get("/api/portfolio/stats", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const holdings = await storage.getAllHoldings(user.id);
      const trades = await storage.getAllTrades(user.id);

      // Get current prices for all holdings using cache
      const symbols = holdings.map(h => h.symbol);
      let quotes: Array<{ symbol: string; price: number }> = [];
      
      try {
        if (symbols.length > 0) {
          // Add timeout to prevent hanging
          const quotesPromise = marketCache.getMultiQuotes(symbols);
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Market data fetch timeout")), 10000)
          );
          quotes = await Promise.race([quotesPromise, timeoutPromise]);
        }
      } catch (error) {
        console.error("Error fetching market quotes:", error);
        // Continue with empty quotes - will use 0 as fallback price
        // Use holdings' avgPrice as fallback
        quotes = holdings.map(h => ({
          symbol: h.symbol,
          price: parseFloat(h.avgPrice)
        }));
      }

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

      // Calculate Sharpe Ratio from trade history
      let sharpeRatio = 0;
      try {
        if (filledTrades.length > 1 && totalCost > 0) {
          // Sort trades by date
          const sortedTrades = [...filledTrades].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          
          // Group trades by date (daily)
          const tradesByDate = new Map<string, typeof sortedTrades>();
          sortedTrades.forEach(trade => {
            const date = new Date(trade.createdAt).toISOString().split('T')[0];
            if (!tradesByDate.has(date)) {
              tradesByDate.set(date, []);
            }
            tradesByDate.get(date)!.push(trade);
          });
          
          // Track portfolio value over time
          const portfolioValues: Array<{ date: string; value: number }> = [];
          const holdingsBySymbol = new Map<string, { quantity: number; avgPrice: number }>();
          let portfolioCost = 0; // Track total cost basis
          
          // Process trades chronologically and track portfolio value
          const sortedDates = Array.from(tradesByDate.keys()).sort();
          
          sortedDates.forEach(date => {
            const dayTrades = tradesByDate.get(date)!;
            
            // Process trades for this day
            dayTrades.forEach(trade => {
              const quantity = parseFloat(trade.quantity);
              const price = parseFloat(trade.price);
              const symbol = trade.symbol;
              
              if (trade.side === "buy") {
                const existing = holdingsBySymbol.get(symbol) || { quantity: 0, avgPrice: 0 };
                const totalCost = existing.quantity * existing.avgPrice + quantity * price;
                const totalQuantity = existing.quantity + quantity;
                holdingsBySymbol.set(symbol, {
                  quantity: totalQuantity,
                  avgPrice: totalQuantity > 0 ? totalCost / totalQuantity : price
                });
                portfolioCost += quantity * price;
              } else {
                const holding = holdingsBySymbol.get(symbol);
                if (holding && holding.quantity > 0) {
                  const soldQuantity = Math.min(quantity, holding.quantity);
                  portfolioCost -= soldQuantity * holding.avgPrice;
                  holding.quantity -= soldQuantity;
                  if (holding.quantity === 0) {
                    holdingsBySymbol.delete(symbol);
                  } else {
                    holdingsBySymbol.set(symbol, holding);
                  }
                }
              }
            });
            
            // Calculate portfolio value at end of day using current prices
            let dayValue = portfolioCost; // Start with cost basis
            holdingsBySymbol.forEach((holding, symbol) => {
              const currentPrice = priceMap[symbol] || holding.avgPrice;
              dayValue += holding.quantity * (currentPrice - holding.avgPrice); // Add unrealized P&L
            });
            
            portfolioValues.push({ date, value: Math.max(0, dayValue) });
          });
          
          // Add current portfolio value as final data point
          if (portfolioValues.length > 0) {
            portfolioValues.push({ date: new Date().toISOString().split('T')[0], value: totalEquity });
          }
          
          // Calculate daily returns
          const dailyReturns: number[] = [];
          for (let i = 1; i < portfolioValues.length; i++) {
            const prevValue = portfolioValues[i - 1].value;
            const currentValue = portfolioValues[i].value;
            if (prevValue > 0) {
              const dailyReturn = (currentValue - prevValue) / prevValue;
              dailyReturns.push(dailyReturn);
            }
          }
          
          // Calculate Sharpe Ratio (annualized from daily returns)
          if (dailyReturns.length >= 2) {
            sharpeRatio = calculateSharpeRatio(dailyReturns, 0, 252); // 252 trading days per year
          }
        }
      } catch (error) {
        console.error("Error calculating Sharpe Ratio:", error);
        sharpeRatio = 0; // Fallback to 0 on error
      }

      res.json({
        totalEquity,
        totalPnL,
        totalPnLPercent,
        winRate,
        totalTrades: filledTrades.length,
        sharpeRatio,
      });
    } catch (error) {
      console.error("Error calculating portfolio stats:", error);
      res.status(500).json({ error: "Failed to calculate portfolio stats" });
    }
  });

  // Get portfolio value history over time
  app.get("/api/portfolio/history", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { range = "3mo", interval = "1d" } = req.query;
      
      const holdings = await storage.getAllHoldings(user.id);
      const trades = await storage.getAllTrades(user.id);
      
      if (holdings.length === 0) {
        return res.json([]);
      }

      // Get all unique symbols from holdings
      const symbols = Array.from(new Set(holdings.map(h => h.symbol)));
      
      // Fetch historical data for all symbols
      const historicalDataPromises = symbols.map(symbol => 
        marketCache.getHistory(symbol, range as string, interval as string).catch(() => [])
      );
      
      const allHistoricalData = await Promise.all(historicalDataPromises);
      
      // Create a map of symbol -> historical prices by date
      const pricesByDate = new Map<string, Map<string, number>>();
      
      symbols.forEach((symbol, index) => {
        const history = allHistoricalData[index];
        if (!history || history.length === 0) return;
        
        const symbolPrices = new Map<string, number>();
        history.forEach((item: any) => {
          const date = new Date(item.date).toISOString().split('T')[0];
          symbolPrices.set(date, item.close);
        });
        pricesByDate.set(symbol, symbolPrices);
      });

      // Get all unique dates from all historical data
      const allDates = new Set<string>();
      allHistoricalData.forEach(history => {
        history.forEach((item: any) => {
          const date = new Date(item.date).toISOString().split('T')[0];
          allDates.add(date);
        });
      });

      // Sort dates chronologically
      const sortedDates = Array.from(allDates).sort();

      // Calculate portfolio value for each date
      const portfolioHistory = sortedDates.map(date => {
        let totalValue = 0;
        
        holdings.forEach(holding => {
          const symbolPrices = pricesByDate.get(holding.symbol);
          const price = symbolPrices?.get(date);
          
          if (price !== undefined) {
            totalValue += parseFloat(holding.quantity) * price;
          } else {
            // If no price for this date, use average price as fallback
            totalValue += parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
          }
        });
        
        return {
          date,
          value: totalValue,
          open: totalValue, // For compatibility with chart
          high: totalValue,
          low: totalValue,
          close: totalValue,
          volume: 0,
        };
      });

      res.json(portfolioHistory);
    } catch (error) {
      console.error("Error fetching portfolio history:", error);
      res.status(500).json({ error: "Failed to fetch portfolio history" });
    }
  });

  // Export portfolio to CSV or JSON
  app.get("/api/portfolio/export", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { format = "csv" } = req.query;
      const holdings = await storage.getAllHoldings(user.id);
      const trades = await storage.getAllTrades(user.id);

      if (format === "csv") {
        // Export holdings as CSV
        const csvHeader = "Symbol,Name,Type,Quantity,Avg Price,Created At\n";
        const csvRows = holdings.map(h =>
          `${h.symbol},${h.name},${h.type},${h.quantity},${h.avgPrice},${h.createdAt}`
        ).join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=portfolio_${Date.now()}.csv`);
        res.send(csvHeader + csvRows);
      } else {
        // Export as JSON with both holdings and trades
        const exportData = {
          exportedAt: new Date().toISOString(),
          holdings,
          trades,
        };

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=portfolio_${Date.now()}.json`);
        res.json(exportData);
      }
    } catch (error) {
      console.error("Error exporting portfolio:", error);
      res.status(500).json({ error: "Failed to export portfolio" });
    }
  });

  // Import portfolio from CSV or JSON
  app.post("/api/portfolio/import", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { data, format = "json", replaceExisting = false } = req.body;

      if (!data) {
        return res.status(400).json({ error: "Import data is required" });
      }

      let importedHoldings = [];
      let importedTrades = [];

      if (format === "csv") {
        // Parse CSV data
        const lines = data.trim().split("\n");
        const headers = lines[0].toLowerCase().split(",");

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",");
          const holding: any = {};

          headers.forEach((header: string, index: number) => {
            holding[header.trim()] = values[index]?.trim();
          });

          // Validate and add holding
          if (holding.symbol && holding.quantity && holding.avgprice) {
            importedHoldings.push({
              symbol: holding.symbol,
              name: holding.name || holding.symbol,
              type: holding.type || "stock",
              quantity: holding.quantity,
              avgPrice: holding.avgprice || holding["avg price"],
            });
          }
        }
      } else {
        // Parse JSON data
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        importedHoldings = parsed.holdings || [];
        importedTrades = parsed.trades || [];
      }

      // Clear existing data if requested
      if (replaceExisting) {
        const existingHoldings = await storage.getAllHoldings(user.id);
        await Promise.all(existingHoldings.map(h => storage.deleteHolding(h.id, user.id)));
      }

      // Import holdings
      const createdHoldings = await Promise.all(
        importedHoldings.map(async (holding: any) => {
          try {
            const validatedData = insertHoldingSchema.parse({
              symbol: holding.symbol,
              name: holding.name,
              type: holding.type,
              quantity: holding.quantity.toString(),
              avgPrice: holding.avgPrice.toString(),
            });
            return await storage.createHolding({ ...validatedData, userId: user.id });
          } catch (error) {
            console.error(`Failed to import holding ${holding.symbol}:`, error);
            return null;
          }
        })
      );

      // Import trades if present
      const createdTrades = await Promise.all(
        importedTrades.map(async (trade: any) => {
          try {
            const validatedData = insertTradeSchema.parse({
              symbol: trade.symbol,
              side: trade.side,
              quantity: trade.quantity.toString(),
              price: trade.price.toString(),
              totalValue: trade.totalValue.toString(),
              fees: trade.fees?.toString() || "0",
              status: trade.status || "filled",
            });
            return await storage.createTrade({ ...validatedData, userId: user.id });
          } catch (error) {
            console.error(`Failed to import trade:`, error);
            return null;
          }
        })
      );

      res.json({
        success: true,
        imported: {
          holdings: createdHoldings.filter(Boolean).length,
          trades: createdTrades.filter(Boolean).length,
        },
      });
    } catch (error) {
      console.error("Error importing portfolio:", error);
      res.status(500).json({ error: "Failed to import portfolio" });
    }
  });

  // Risk Analytics endpoint
  app.get("/api/portfolio/risk-analytics", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const holdings = await storage.getAllHoldings(user.id);

      if (holdings.length === 0) {
        return res.status(400).json({ error: "No holdings in portfolio. Add assets to analyze risk." });
      }

      // Get current prices and historical data for all holdings
      const symbols = holdings.map(h => h.symbol);
      const quotes = await marketCache.getMultiQuotes(symbols);
      const priceMap = Object.fromEntries(quotes.map(q => [q.symbol, q.price]));

      // Fetch 3 months of historical data for returns calculation
      const historicalDataPromises = symbols.map(symbol =>
        marketCache.getHistory(symbol, "3mo", "1d").catch(() => [])
      );
      const allHistoricalData = await Promise.all(historicalDataPromises);

      // Build portfolio positions with returns data
      const positions = holdings.map((holding, index) => {
        const history = allHistoricalData[index];
        const historicalPrices = history.map((item: any) => item.close);
        const returns = [];

        // Calculate daily returns
        for (let i = 1; i < historicalPrices.length; i++) {
          if (historicalPrices[i - 1] !== 0) {
            returns.push((historicalPrices[i] - historicalPrices[i - 1]) / historicalPrices[i - 1]);
          }
        }

        return {
          symbol: holding.symbol,
          name: holding.name,
          quantity: parseFloat(holding.quantity),
          avgPrice: parseFloat(holding.avgPrice),
          currentPrice: priceMap[holding.symbol] || parseFloat(holding.avgPrice),
          returns,
          historicalPrices,
        };
      });

      // Optional: Get benchmark returns (SPY for US market)
      let benchmarkReturns: number[] | undefined;
      try {
        const spyHistory = await marketCache.getHistory("SPY", "3mo", "1d");
        const spyPrices = spyHistory.map((item: any) => item.close);
        benchmarkReturns = [];
        for (let i = 1; i < spyPrices.length; i++) {
          if (spyPrices[i - 1] !== 0) {
            benchmarkReturns.push((spyPrices[i] - spyPrices[i - 1]) / spyPrices[i - 1]);
          }
        }
      } catch (error) {
        console.error("Error fetching benchmark data:", error);
        // Continue without benchmark
      }

      // Calculate risk analytics
      const riskAnalytics = await calculateRiskAnalytics(positions, benchmarkReturns);

      res.json(riskAnalytics);
    } catch (error) {
      console.error("Error calculating risk analytics:", error);
      res.status(500).json({ error: "Failed to calculate risk analytics" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Don't send passwords
      const users = allUsers.map(({ password, ...user }) => ({
        ...user,
        isAdmin: user.isAdmin === "true",
      }));
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isAdmin } = req.body;
      
      const updatedUser = await storage.updateUser(id, {
        isAdmin: isAdmin ? "true" : "false",
      });
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        ...updatedUser,
        isAdmin: updatedUser.isAdmin === "true",
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const holdings = await storage.getAllHoldingsForAdmin();
      const trades = await storage.getAllTradesForAdmin();
      const watchlist = await storage.getAllWatchlistForAdmin();
      
      res.json({
        users: {
          total: users.length,
          admins: users.filter(u => u.isAdmin === "true").length,
        },
        holdings: {
          total: holdings.length,
          uniqueSymbols: new Set(holdings.map(h => h.symbol)).size,
        },
        trades: {
          total: trades.length,
          filled: trades.filter(t => t.status === "filled").length,
        },
        watchlist: {
          total: watchlist.length,
        },
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // SMTP Settings endpoints
  app.get("/api/admin/smtp-settings", requireAdmin, async (req, res) => {
    try {
      const smtpHost = await storage.getSetting("smtp_host");
      const smtpPort = await storage.getSetting("smtp_port");
      const smtpSecure = await storage.getSetting("smtp_secure");
      const smtpUser = await storage.getSetting("smtp_user");
      const smtpPassword = await storage.getSetting("smtp_password");

      res.json({
        host: smtpHost?.value || process.env.SMTP_HOST || "",
        port: smtpPort?.value || process.env.SMTP_PORT || "587",
        secure: smtpSecure?.value === "true" || process.env.SMTP_SECURE === "true",
        user: smtpUser?.value || process.env.SMTP_USER || "",
        password: smtpPassword?.value ? "***" : (process.env.SMTP_PASSWORD ? "***" : ""), // Don't expose password
        configured: !!(smtpUser?.value && smtpPassword?.value) || !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD),
      });
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
      res.status(500).json({ error: "Failed to fetch SMTP settings" });
    }
  });

  app.post("/api/admin/smtp-settings", requireAdmin, async (req, res) => {
    try {
      const { host, port, secure, user, password } = req.body;

      if (!host || !port || !user) {
        return res.status(400).json({ error: "Host, port, and user are required" });
      }

      // Check if password should be kept (special value) or if it's a new password
      const existingPassword = await storage.getSetting("smtp_password");
      const passwordToSave = password === "KEEP_EXISTING" && existingPassword?.value 
        ? existingPassword.value 
        : password;

      if (!passwordToSave) {
        return res.status(400).json({ error: "Password is required for new configurations" });
      }

      await storage.setSetting("smtp_host", host);
      await storage.setSetting("smtp_port", String(port));
      await storage.setSetting("smtp_secure", secure ? "true" : "false");
      await storage.setSetting("smtp_user", user);
      await storage.setSetting("smtp_password", passwordToSave);

      // Clear transporter cache to force reload
      // This is handled in email.ts by checking config changes

      res.json({ message: "SMTP settings updated successfully" });
    } catch (error) {
      console.error("Error updating SMTP settings:", error);
      res.status(500).json({ error: "Failed to update SMTP settings" });
    }
  });

  app.post("/api/admin/test-email", requireAdmin, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email address is required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email address format" });
      }

      const { sendTestEmail } = await import("./email");

      // Set a timeout for the entire operation (35 seconds)
      const sendPromise = sendTestEmail(email);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out. The email sending operation took too long.")), 35000);
      });

      await Promise.race([sendPromise, timeoutPromise]);

      res.json({ message: "Test email sent successfully" });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      // Ensure we always return JSON, even on error
      const errorMessage = error?.message || "Failed to send test email";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Alert endpoints
  app.get("/api/alerts", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const alerts = await storage.getAllAlerts(user.id);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertAlertSchema.parse(req.body);
      const alert = await storage.createAlert({ ...validatedData, userId: user.id });
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating alert:", error);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  app.patch("/api/alerts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      const alert = await storage.updateAlert(id, user.id, req.body);

      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json(alert);
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  app.delete("/api/alerts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      await storage.deleteAlert(id, user.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  // Alert history endpoints
  app.get("/api/alerts/:id/history", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      const history = await storage.getAlertHistory(id, user.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching alert history:", error);
      res.status(500).json({ error: "Failed to fetch alert history" });
    }
  });

  app.get("/api/alert-history", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const history = await storage.getAllAlertHistory(user.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching alert history:", error);
      res.status(500).json({ error: "Failed to fetch alert history" });
    }
  });

  // Alert statistics endpoint
  app.get("/api/alerts/stats", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const alerts = await storage.getAllAlerts(user.id);
      const history = await storage.getAllAlertHistory(user.id);

      const activeAlerts = alerts.filter(a => a.status === "active");
      const uniqueSymbols = new Set(alerts.map(a => a.symbol));

      // Count triggered today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const triggeredToday = history.filter(h => {
        const triggerDate = new Date(h.triggeredAt);
        return triggerDate >= today;
      });

      res.json({
        activeAlerts: activeAlerts.length,
        totalAlerts: alerts.length,
        watchingSymbols: uniqueSymbols.size,
        triggeredToday: triggeredToday.length,
        lastTriggered: history[0] ? {
          symbol: history[0].symbol,
          triggeredAt: history[0].triggeredAt,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching alert stats:", error);
      res.status(500).json({ error: "Failed to fetch alert stats" });
    }
  });

  // ==================== ML PREDICTION ENDPOINTS ====================

  // Global predictor cache (in-memory for simplicity, can be persisted)
  const predictorCache = new Map<string, any>();
  // Training lock to prevent concurrent training for the same symbol
  const trainingLocks = new Map<string, Promise<any>>();

  // Test TensorFlow.js initialization (no auth required for testing)
  app.get("/api/ml/test", async (req, res) => {
    try {
      console.log("Testing TensorFlow.js initialization...");
      const tf = await import("@tensorflow/tfjs-node");
      await tf.ready();
      
      // Test basic tensor operations
      const testTensor = tf.tensor2d([[1, 2], [3, 4]]);
      const result = testTensor.sum().dataSync()[0];
      testTensor.dispose();
      
      res.json({
        success: true,
        message: "TensorFlow.js is working",
        version: tf.version,
        testResult: result,
      });
    } catch (error: any) {
      console.error("TensorFlow.js test failed:", error);
      res.status(500).json({
        error: "TensorFlow.js initialization failed",
        details: error.message || error.toString(),
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  });

  // Train ML model for a symbol
  app.post("/api/ml/train", requireAuth, async (req, res) => {
    try {
      const { symbol, range = "1y", epochs = 80 } = req.body;

      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      const symbolUpper = symbol.toUpperCase();

      // Check if training is already in progress
      if (trainingLocks.has(symbolUpper)) {
        return res.status(409).json({ 
          error: "Training already in progress",
          message: `Model for ${symbolUpper} is currently being trained. Please wait.`
        });
      }

      // Check if model already exists and is recent (within 24 hours)
      const existingPredictor = predictorCache.get(symbolUpper);
      if (existingPredictor && existingPredictor.trainedAt) {
        const hoursSinceTraining = (Date.now() - new Date(existingPredictor.trainedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceTraining < 24) {
          return res.status(200).json({
            success: true,
            symbol: symbolUpper,
            message: `Model was trained ${hoursSinceTraining.toFixed(1)} hours ago. Use existing model or wait 24h to retrain.`,
            cached: true
          });
        }
      }

      console.log(`🚀 Training ML model for ${symbolUpper}...`);

      // Dynamic import to avoid loading TensorFlow on startup
      const { StockPredictor } = await import("./stock-predictor");

      const predictor = new StockPredictor({
        sequenceLength: 7,
        priceChangeThreshold: 0.015
      });

      // Create training promise and add to lock
      const trainPromise = (async () => {
        try {
          // Set timeout for training (10 minutes max)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Training timeout")), 600000);
          });

          const metrics = await Promise.race([
            predictor.train(symbolUpper, range, epochs),
            timeoutPromise
          ]) as any;

          // Cache the trained predictor with timestamp
          predictorCache.set(symbolUpper, {
            predictor,
            trainedAt: new Date().toISOString()
          });

          return metrics;
        } finally {
          // Remove lock when done
          trainingLocks.delete(symbolUpper);
        }
      })();

      trainingLocks.set(symbolUpper, trainPromise);

      const metrics = await trainPromise;

      res.json({
        success: true,
        symbol: symbolUpper,
        metrics,
        message: "Model trained successfully"
      });
    } catch (error: any) {
      const symbolUpper = req.body.symbol?.toUpperCase();
      if (symbolUpper) {
        trainingLocks.delete(symbolUpper);
      }
      console.error("Error training ML model:", error);
      const errorMessage = error?.message || error?.toString() || "Failed to train ML model";
      res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      });
    }
  });

  // Get price prediction for next N days
  app.get("/api/ml/predict/:symbol", requireAuth, async (req, res) => {
    try {
      const { symbol } = req.params;
      const { days = "3" } = req.query;
      const numDays = parseInt(days as string, 10);

      if (numDays < 1 || numDays > 7) {
        return res.status(400).json({ error: "Days must be between 1 and 7" });
      }

      // Check if model is trained for this symbol
      const cached = predictorCache.get(symbol);
      const predictor = cached?.predictor || cached;

      if (!predictor) {
        return res.status(404).json({
          error: "Model not trained for this symbol",
          message: `Please train the model first using POST /api/ml/train with symbol=${symbol}`
        });
      }

      console.log(`Predicting ${numDays} days for ${symbol}...`);
      const predictions = await predictor.predictNextDays(symbol, numDays);

      res.json({
        symbol,
        predictions,
        generatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error making prediction:", error);
      res.status(500).json({ error: error.message || "Failed to make prediction" });
    }
  });

  // Quick prediction endpoint (auto-trains if needed)
  app.get("/api/ml/quick-predict/:symbol", requireAuth, async (req, res) => {
    try {
      const { symbol } = req.params;
      const { days = "3" } = req.query;
      const numDays = parseInt(days as string, 10);

      console.log(`Quick predict for ${symbol}...`);

      // Check if model exists, if not, train it
      const cached = predictorCache.get(symbol);
      let predictor = cached?.predictor || cached;

      if (!predictor) {
        console.log(`No cached model for ${symbol}, training now...`);
        const { StockPredictor } = await import("./stock-predictor");

        predictor = new StockPredictor({
          sequenceLength: 7,
          priceChangeThreshold: 0.015
        });

        // Train with fewer epochs for speed
        await predictor.train(symbol, "1y", 40);
        predictorCache.set(symbol, {
          predictor,
          trainedAt: new Date().toISOString()
        });
      }

      const predictions = await predictor.predictNextDays(symbol, numDays);

      res.json({
        symbol,
        predictions,
        generatedAt: new Date().toISOString(),
        autoTrained: true
      });
    } catch (error: any) {
      console.error("Error in quick predict:", error);
      res.status(500).json({ error: error.message || "Failed to make prediction" });
    }
  });

  // Get list of trained models
  app.get("/api/ml/models", requireAuth, async (_req, res) => {
    try {
      const models = Array.from(predictorCache.entries()).map(([symbol, cached]) => ({
        symbol,
        trainedAt: cached?.trainedAt || new Date().toISOString()
      }));

      res.json({ models });
    } catch (error) {
      console.error("Error fetching models:", error);
      res.status(500).json({ error: "Failed to fetch models" });
    }
  });

  // Clear model cache
  app.delete("/api/ml/models/:symbol", requireAuth, async (req, res) => {
    try {
      const { symbol } = req.params;

      if (predictorCache.has(symbol)) {
        predictorCache.delete(symbol);
        res.json({ success: true, message: `Model for ${symbol} removed` });
      } else {
        res.status(404).json({ error: "Model not found" });
      }
    } catch (error) {
      console.error("Error deleting model:", error);
      res.status(500).json({ error: "Failed to delete model" });
    }
  });

  return httpServer;
}
