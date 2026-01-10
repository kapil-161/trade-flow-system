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
}

interface HistoricalCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class TechnicalIndicators {
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
      atrMultiplier: 1.5,
      tpMultiplier: 3,
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
    const rsi = TechnicalIndicators.rsi(closes, 14);
    const macd = this.calculateMACD(closes);
    const atr = TechnicalIndicators.atr(candles, 14);
    const avgVolume = this.calculateSMA(volumes, 20);

    const trades: BacktestTrade[] = [];
    const signals: Record<string, "buy" | "sell"> = {};
    let capital = initialCapital;
    let position: { entryPrice: number; entryDate: string; quantity: number } | null = null;

    for (let i = 50; i < candles.length; i++) {
      const close = candles[i].close;
      const high = candles[i].high;
      const low = candles[i].low;
      const date = candles[i].date;
      const volume = candles[i].volume;

      if (!position) {
        let score = 0;
        if (close > emaFast[i] && emaFast[i] > emaSlow[i]) score += 3;
        if (volume > avgVolume[i]) score += 2;
        if (rsi[i] >= config.rsiLower && rsi[i] <= config.rsiUpper) score += 1;
        if (macd.histogram[i] > 0) score += 2;
        if (i > 0 && atr[i] > atr[i - 1]) score += 2;

        if (score >= config.scoreThreshold) {
          const quantity = (capital * 0.95) / close;
          position = { entryPrice: close, entryDate: date, quantity };
          signals[date] = "buy";
        }
      } else {
        const entryATR = atr[i] || 10;
        const stopLoss = position.entryPrice - (config.atrMultiplier * entryATR);
        const takeProfit = position.entryPrice + (config.tpMultiplier * entryATR);

        let shouldExit = false;
        let exitPrice = close;

        if (low <= stopLoss) {
          shouldExit = true;
          exitPrice = stopLoss;
        } else if (high >= takeProfit) {
          shouldExit = true;
          exitPrice = takeProfit;
        } else if (i - candles.findIndex(c => c.date === position!.entryDate) > 5) {
          if (close < position.entryPrice) {
            shouldExit = true;
            exitPrice = close;
          }
        }

        if (shouldExit) {
          const pnl = (exitPrice - position.entryPrice) * position.quantity;
          const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
          const riskAmount = (position.entryPrice - stopLoss) * position.quantity;
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

    return {
      symbol,
      strategy: "Multi-Factor Weighted Momentum",
      startDate: candles[50].date,
      endDate: candles[candles.length - 1].date,
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
      sharpeRatio: 2.0,
      maxDrawdown: this.calculateMaxDrawdown(trades, initialCapital),
      historicalData,
    };
  }

  private calculateMACD(closes: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
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

  private calculateSMA(data: number[], period: number): number[] {
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
}
