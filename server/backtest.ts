import { marketCache } from "./cache";

export interface BacktestTrade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  quantity: number;
  side: "buy" | "sell";
  pnl: number;
  pnlPercent: number;
  riskReward: number;
}

export interface BacktestResult {
  symbol: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalPnL: number;
  totalPnLPercent: number;
  trades: BacktestTrade[];
  winRate: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  historicalData: {
    date: string;
    close: number;
    emaFast: number;
    emaSlow: number;
    rsi: number;
    signal?: "buy" | "sell";
  }[];
}

export interface StrategyConfig {
  emaFast: number;
  emaSlow: number;
  rsiLower: number;
  rsiUpper: number;
  scoreThreshold: number;
  atrMultiplier: number;
  tpMultiplier: number;
  trendFilter: boolean;
  volatilityFilter: boolean;
}

interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TechnicalIndicators {
  static sma(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  static ema(data: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        result.push(data[i]);
      } else if (i < period - 1) {
        result.push(NaN);
      } else if (i === period - 1) {
        const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      } else {
        const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
        result.push(ema);
      }
    }
    return result;
  }

  static rsi(data: number[], period: number = 14): number[] {
    const result: number[] = [];
    const changes: number[] = [];

    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }

    for (let i = 0; i < data.length; i++) {
      if (i < period) {
        result.push(NaN);
      } else {
        const gains = changes.slice(i - period, i).filter(c => c > 0).reduce((a, b) => a + b, 0);
        const losses = Math.abs(changes.slice(i - period, i).filter(c => c < 0).reduce((a, b) => a + b, 0));

        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / (avgLoss || 1);
        const rsi = 100 - (100 / (1 + rs));

        result.push(rsi);
      }
    }
    return result;
  }

  static atr(candles: HistoricalCandle[], period: number = 14): number[] {
    const result: number[] = [];
    const tr: number[] = [];

    for (let i = 0; i < candles.length; i++) {
      if (i === 0) {
        tr.push(candles[i].high - candles[i].low);
      } else {
        const tr1 = candles[i].high - candles[i].low;
        const tr2 = Math.abs(candles[i].high - candles[i - 1].close);
        const tr3 = Math.abs(candles[i].low - candles[i - 1].close);
        tr.push(Math.max(tr1, tr2, tr3));
      }
    }

    for (let i = 0; i < tr.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else if (i === period - 1) {
        const sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      } else {
        const atr = (result[i - 1] * (period - 1) + tr[i]) / period;
        result.push(atr);
      }
    }
    return result;
  }

  static detectRsiDivergence(prices: number[], rsi: number[], lookback: number = 14): "bullish" | "bearish" | "none" {
    if (prices.length < lookback || rsi.length < lookback) return "none";

    const recentPrices = prices.slice(-lookback);
    const recentRsi = rsi.slice(-lookback);

    // Filter out NaN values
    const validPrices = recentPrices.filter(p => !isNaN(p));
    const validRsi = recentRsi.filter(r => !isNaN(r));

    if (validPrices.length < lookback || validRsi.length < lookback) return "none";

    const midpoint = Math.floor(lookback / 2);
    const firstHalfPrices = recentPrices.slice(0, midpoint);
    const secondHalfPrices = recentPrices.slice(midpoint);
    const firstHalfRsi = recentRsi.slice(0, midpoint);
    const secondHalfRsi = recentRsi.slice(midpoint);

    // Filter NaN values before calculating min/max
    const firstHalfPricesValid = firstHalfPrices.filter(p => !isNaN(p));
    const secondHalfPricesValid = secondHalfPrices.filter(p => !isNaN(p));
    const firstHalfRsiValid = firstHalfRsi.filter(r => !isNaN(r));
    const secondHalfRsiValid = secondHalfRsi.filter(r => !isNaN(r));

    if (firstHalfPricesValid.length === 0 || secondHalfPricesValid.length === 0 ||
        firstHalfRsiValid.length === 0 || secondHalfRsiValid.length === 0) {
      return "none";
    }

    const minFirstPrice = Math.min(...firstHalfPricesValid);
    const minSecondPrice = Math.min(...secondHalfPricesValid);
    const minFirstRsi = Math.min(...firstHalfRsiValid);
    const minSecondRsi = Math.min(...secondHalfRsiValid);

    if (!isNaN(minFirstPrice) && !isNaN(minSecondPrice) && !isNaN(minFirstRsi) && !isNaN(minSecondRsi)) {
      if (minSecondPrice < minFirstPrice && minSecondRsi > minFirstRsi) {
        return "bullish";
      }
    }

    const maxFirstPrice = Math.max(...firstHalfPricesValid);
    const maxSecondPrice = Math.max(...secondHalfPricesValid);
    const maxFirstRsi = Math.max(...firstHalfRsiValid);
    const maxSecondRsi = Math.max(...secondHalfRsiValid);

    if (!isNaN(maxFirstPrice) && !isNaN(maxSecondPrice) && !isNaN(maxFirstRsi) && !isNaN(maxSecondRsi)) {
      if (maxSecondPrice > maxFirstPrice && maxSecondRsi < maxFirstRsi) {
        return "bearish";
      }
    }

    return "none";
  }

  static detectVolumeDivergence(prices: number[], volumes: number[], lookback: number = 14): "bullish" | "bearish" | "none" {
    if (prices.length < lookback || volumes.length < lookback) return "none";

    const recentPrices = prices.slice(-lookback);
    const recentVolumes = volumes.slice(-lookback);

    // Filter out NaN values
    const validPrices = recentPrices.filter(p => !isNaN(p));
    const validVolumes = recentVolumes.filter(v => !isNaN(v));

    if (validPrices.length < lookback || validVolumes.length < lookback) return "none";

    const midpoint = Math.floor(lookback / 2);
    const firstHalfPrices = recentPrices.slice(0, midpoint);
    const secondHalfPrices = recentPrices.slice(midpoint);
    const firstHalfVolumes = recentVolumes.slice(0, midpoint);
    const secondHalfVolumes = recentVolumes.slice(midpoint);

    // Filter NaN values before calculations
    const firstHalfPricesValid = firstHalfPrices.filter(p => !isNaN(p));
    const secondHalfPricesValid = secondHalfPrices.filter(p => !isNaN(p));
    const firstHalfVolumesValid = firstHalfVolumes.filter(v => !isNaN(v));
    const secondHalfVolumesValid = secondHalfVolumes.filter(v => !isNaN(v));

    if (firstHalfPricesValid.length === 0 || secondHalfPricesValid.length === 0 ||
        firstHalfVolumesValid.length === 0 || secondHalfVolumesValid.length === 0) {
      return "none";
    }

    const maxFirstPrice = Math.max(...firstHalfPricesValid);
    const maxSecondPrice = Math.max(...secondHalfPricesValid);
    const avgFirstVolume = firstHalfVolumesValid.reduce((a, b) => a + b, 0) / firstHalfVolumesValid.length;
    const avgSecondVolume = secondHalfVolumesValid.reduce((a, b) => a + b, 0) / secondHalfVolumesValid.length;

    if (!isNaN(maxFirstPrice) && !isNaN(maxSecondPrice) && !isNaN(avgFirstVolume) && !isNaN(avgSecondVolume)) {
      if (maxSecondPrice > maxFirstPrice && avgSecondVolume < avgFirstVolume * 0.8) {
        return "bearish";
      }
    }

    const minFirstPrice = Math.min(...firstHalfPricesValid);
    const minSecondPrice = Math.min(...secondHalfPricesValid);

    if (!isNaN(minFirstPrice) && !isNaN(minSecondPrice) && !isNaN(avgFirstVolume) && !isNaN(avgSecondVolume)) {
      if (minSecondPrice < minFirstPrice && avgSecondVolume > avgFirstVolume * 1.2) {
        return "bullish";
      }
    }

    return "none";
  }
}

export class BacktestEngine {
  async runMultiFactorStrategy(
    symbol: string,
    range: string = "3mo",
    initialCapital: number = 10000,
    strategyConfig?: StrategyConfig
  ): Promise<BacktestResult> {
    const config = strategyConfig || {
      emaFast: 21,
      emaSlow: 50,
      rsiLower: 45,
      rsiUpper: 65,
      scoreThreshold: 7,
      atrMultiplier: 2.0, // Increased default SL
      tpMultiplier: 4.0, // Increased default TP
      trendFilter: true,
      volatilityFilter: true,
    };

    const history = await marketCache.getHistory(symbol, range, "1d");
    
    if (history.length < 50) {
      throw new Error("Insufficient historical data for backtesting");
    }

    const candles: HistoricalCandle[] = history.map(h => ({
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: h.volume,
    }));

    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);

    // Calculate indicators
    const emaFast = TechnicalIndicators.ema(closes, config.emaFast);
    const emaSlow = TechnicalIndicators.ema(closes, config.emaSlow);
    const ema200 = TechnicalIndicators.ema(closes, 200);
    const rsi = TechnicalIndicators.rsi(closes, 14);
    const macd = this.calculateMACD(closes);
    const atr = TechnicalIndicators.atr(candles, 14);
    const avgVolume = this.calculateSMA(volumes, 20);

    const trades: BacktestTrade[] = [];
    const signals: Record<string, "buy" | "sell"> = {};
    let capital = initialCapital;
    let position: { entryPrice: number; entryDate: string; quantity: number; stopLoss: number; takeProfit: number } | null = null;
    
    // Track daily capital for Sharpe Ratio calculation
    const dailyCapital: Array<{ date: string; capital: number }> = [];
    dailyCapital.push({ date: candles[50].date, capital: initialCapital });

    for (let i = 50; i < candles.length; i++) {
      const close = candles[i].close;
      const high = candles[i].high;
      const low = candles[i].low;
      const date = candles[i].date;
      const volume = candles[i].volume;

      if (!position) {
        // IMPROVED ENTRY LOGIC
        let score = 0;

        // 1. Trend Filter: Price MUST be above 200 EMA for long-term health
        if (config.trendFilter && i >= 200) {
          if (close < ema200[i]) continue;
        }

        // 2. RSI Overbought Filter: Don't enter if RSI is too high (overbought)
        // RSI above 70 is typically overbought and should not trigger buy signals
        if (rsi[i] > 70) continue;

        // 3. EMA Trend
        if (close > emaFast[i] && emaFast[i] > emaSlow[i]) score += 3;

        // 4. Volume Confirmation
        if (volume > avgVolume[i] * 1.2) score += 2;

        // 5. RSI Pullback zone
        if (rsi[i] >= config.rsiLower && rsi[i] <= config.rsiUpper) score += 2;

        // 6. MACD Momentum
        if (macd.histogram[i] > 0 && macd.histogram[i] > macd.histogram[i-1]) score += 2;

        // 7. Volatility Filter: Don't enter if volatility is too low
        if (config.volatilityFilter && i > 0 && atr[i] < atr[i-1] * 0.8) continue;

        if (score >= config.scoreThreshold) {
          const entryATR = atr[i] || 10;
          const sl = close - (config.atrMultiplier * entryATR);
          const tp = close + (config.tpMultiplier * entryATR);
          
          const riskPerShare = close - sl;
          const riskAmount = capital * 0.02; // Risk only 2% per trade
          const quantity = Math.floor(riskAmount / riskPerShare);

          if (quantity > 0) {
            position = { entryPrice: close, entryDate: date, quantity, stopLoss: sl, takeProfit: tp };
            signals[date] = "buy";
          }
        }
      } else {
        // IMPROVED EXIT LOGIC
        let shouldExit = false;
        let exitPrice = close;

        // Trailing Stop Loss
        const currentATR = atr[i] || 10;
        const trailingSL = close - (config.atrMultiplier * currentATR);
        if (trailingSL > position.stopLoss) {
          position.stopLoss = trailingSL;
        }

        if (low <= position.stopLoss) {
          shouldExit = true;
          exitPrice = position.stopLoss;
        } else if (high >= position.takeProfit) {
          shouldExit = true;
          exitPrice = position.takeProfit;
        } else if (emaFast[i] < emaSlow[i]) {
          // Trend reversal exit
          shouldExit = true;
          exitPrice = close;
        }

        if (shouldExit) {
          const pnl = (exitPrice - position.entryPrice) * position.quantity;
          const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
          const riskAmount = (position.entryPrice - position.stopLoss) * position.quantity;
          const riskReward = riskAmount > 0 ? Math.abs(pnl) / riskAmount : 0;

          trades.push({
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: date,
            exitPrice,
            quantity: position.quantity,
            side: "buy",
            pnl,
            pnlPercent,
            riskReward,
          });

          signals[date] = "sell";
          capital += pnl;
          position = null;
        }
      }
      
      // Track portfolio value at end of each day
      // If in position, include unrealized P&L
      let portfolioValue = capital;
      if (position) {
        const unrealizedPnL = (close - position.entryPrice) * position.quantity;
        portfolioValue = capital + unrealizedPnL;
      }
      dailyCapital.push({ date, capital: portfolioValue });
    }

    const historicalData = candles.slice(50).map((c, i) => {
      const idx = i + 50;
      return {
        date: c.date,
        close: c.close,
        emaFast: emaFast[idx],
        emaSlow: emaSlow[idx],
        rsi: rsi[idx],
        signal: signals[c.date],
      };
    });

    const winningTrades = trades.filter(t => t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl < 0).length;
    const totalPnL = capital - initialCapital;
    const totalPnLPercent = (totalPnL / initialCapital) * 100;

    const avgWin = winningTrades > 0 
      ? trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / winningTrades
      : 0;
    
    const avgLoss = losingTrades > 0
      ? Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / losingTrades)
      : 0;

    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;

    // Calculate Sharpe Ratio from daily capital progression
    let sharpeRatio = 0;
    if (dailyCapital.length >= 2) {
      const dailyReturns: number[] = [];
      for (let i = 1; i < dailyCapital.length; i++) {
        const prevCapital = dailyCapital[i - 1].capital;
        const currentCapital = dailyCapital[i].capital;
        if (prevCapital > 0) {
          const dailyReturn = (currentCapital - prevCapital) / prevCapital;
          dailyReturns.push(dailyReturn);
        }
      }
      
      if (dailyReturns.length >= 2) {
        sharpeRatio = this.calculateSharpeRatio(dailyReturns);
      }
    }

    // Ensure we include today's data if available
    const lastCandle = candles[candles.length - 1];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastCandleDate = new Date(lastCandle.date);
    lastCandleDate.setHours(0, 0, 0, 0);
    
    // Use today's date if the last candle is today, otherwise use the last candle's date
    const endDate = lastCandleDate.getTime() === today.getTime() 
      ? new Date().toISOString() 
      : lastCandle.date;

    return {
      symbol,
      strategy: "Multi-Factor Weighted Momentum",
      startDate: candles[50].date,
      endDate: endDate,
      initialCapital,
      finalCapital: capital,
      totalPnL,
      totalPnLPercent,
      trades,
      winRate,
      winningTrades,
      losingTrades,
      averageWin: avgWin,
      averageLoss: avgLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown: this.calculateMaxDrawdown(trades, initialCapital),
      historicalData,
    };
  }

  calculateMACD(closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const emaFast = TechnicalIndicators.ema(closes, fastPeriod);
    const emaSlow = TechnicalIndicators.ema(closes, slowPeriod);
    
    const macdLine = emaFast.map((fast, i) => {
      if (!isNaN(fast) && !isNaN(emaSlow[i])) {
        return fast - emaSlow[i];
      }
      return NaN;
    });

    const signal = TechnicalIndicators.ema(macdLine.filter(v => !isNaN(v)), signalPeriod);
    const histogram = macdLine.map((macd, i) => {
      if (!isNaN(macd) && i >= slowPeriod && signal[i - slowPeriod]) {
        return macd - signal[i - slowPeriod];
      }
      return NaN;
    });

    return { macdLine, signal, histogram };
  }

  calculateSMA(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  private calculateMaxDrawdown(trades: BacktestTrade[], initialCapital: number): number {
    let maxDrawdown = 0;
    let peak = initialCapital;
    let equity = initialCapital;

    for (const trade of trades) {
      equity += trade.pnl;
      if (equity > peak) peak = equity;
      const drawdown = ((peak - equity) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  private calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length < 2) return 0;
    
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    // Annualize Sharpe Ratio (assuming daily returns, 252 trading days per year)
    const annualizedReturn = meanReturn * 252;
    const annualizedStdDev = stdDev * Math.sqrt(252);
    const annualizedRiskFreeRate = riskFreeRate;
    
    return (annualizedReturn - annualizedRiskFreeRate) / annualizedStdDev;
  }
}
