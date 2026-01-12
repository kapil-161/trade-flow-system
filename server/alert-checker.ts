import { storage } from "./storage";
import { marketCache } from "./cache";
import { TechnicalIndicators } from "./backtest";
import type { Alert } from "@shared/schema";

interface AlertCondition {
  type: "price_above" | "price_below" | "rsi_above" | "rsi_below" | "ema_cross_up" | "ema_cross_down" | "volume_spike";
  value?: number;
  operator?: ">" | "<" | ">=" | "<=";
}

interface MarketData {
  price: number;
  rsi?: number;
  emaFast?: number;
  emaSlow?: number;
  volume?: number;
  avgVolume?: number;
}

export class AlertChecker {
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private previousMarketData: Map<string, MarketData> = new Map();

  start(): void {
    if (this.isRunning) {
      console.log("Alert checker is already running");
      return;
    }

    console.log("Starting alert checker - checking every 60 seconds");
    this.isRunning = true;

    // Check immediately on start
    this.checkAlerts();

    // Then check every 60 seconds
    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, 60000); // 60 seconds
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log("Alert checker stopped");
  }

  private async checkAlerts(): Promise<void> {
    try {
      const activeAlerts = await storage.getActiveAlerts();

      if (activeAlerts.length === 0) {
        return;
      }

      console.log(`Checking ${activeAlerts.length} active alerts...`);

      // Group alerts by symbol for efficient market data fetching
      const symbolsToCheck = new Set<string>();
      activeAlerts.forEach(alert => symbolsToCheck.add(alert.symbol));

      // Fetch market data for all symbols
      const symbols = Array.from(symbolsToCheck);
      const marketDataPromises = symbols.map(async (symbol) => {
        try {
          const data = await this.getMarketDataForSymbol(symbol);
          return { symbol, data };
        } catch (error) {
          console.error(`Error fetching market data for ${symbol}:`, error);
          return { symbol, data: null };
        }
      });

      const marketDataResults = await Promise.all(marketDataPromises);
      const marketDataMap = new Map<string, MarketData>();
      marketDataResults.forEach(result => {
        if (result.data) {
          marketDataMap.set(result.symbol, result.data);
        }
      });

      // Check each alert
      for (const alert of activeAlerts) {
        try {
          await this.checkAlert(alert, marketDataMap);
        } catch (error) {
          console.error(`Error checking alert ${alert.id}:`, error);
        }
      }

      // Update last checked timestamp
      const now = new Date();
      for (const alert of activeAlerts) {
        await storage.updateAlert(alert.id, alert.userId, { lastChecked: now });
      }
    } catch (error) {
      console.error("Error in alert checker:", error);
    }
  }

  private async getMarketDataForSymbol(symbol: string): Promise<MarketData> {
    // Fetch current quote
    const quote = await marketCache.getQuote(symbol);
    const price = quote.price;

    // Fetch historical data for technical indicators (need at least 50 candles)
    const history = await marketCache.getHistory(symbol, "3mo", "1d");

    if (history.length < 50) {
      return { price };
    }

    const closes = history.map((h: any) => h.close).filter((c: number) => !isNaN(c));
    const volumes = history.map((h: any) => h.volume).filter((v: number) => !isNaN(v));

    if (closes.length < 50) {
      return { price };
    }

    // Calculate technical indicators
    const rsi = TechnicalIndicators.rsi(closes, 14);
    const emaFast = TechnicalIndicators.ema(closes, 21);
    const emaSlow = TechnicalIndicators.ema(closes, 50);

    // Calculate average volume (20-day)
    let avgVolume: number | undefined;
    if (volumes.length >= 20) {
      const recentVolumes = volumes.slice(-20);
      avgVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
    }

    return {
      price,
      rsi: rsi[rsi.length - 1],
      emaFast: emaFast[emaFast.length - 1],
      emaSlow: emaSlow[emaSlow.length - 1],
      volume: volumes[volumes.length - 1],
      avgVolume,
    };
  }

  private async checkAlert(alert: Alert, marketDataMap: Map<string, MarketData>): Promise<void> {
    const marketData = marketDataMap.get(alert.symbol);

    if (!marketData) {
      console.log(`No market data available for ${alert.symbol}`);
      return;
    }

    // Parse conditions from JSON
    let conditions: AlertCondition[];
    try {
      conditions = JSON.parse(alert.conditions);
    } catch (error) {
      console.error(`Invalid conditions format for alert ${alert.id}:`, error);
      return;
    }

    // Check if all conditions are met
    const conditionResults: string[] = [];
    let allConditionsMet = true;

    for (const condition of conditions) {
      const met = this.checkCondition(condition, marketData, alert.symbol);
      if (met) {
        conditionResults.push(met);
      } else {
        allConditionsMet = false;
        break;
      }
    }

    if (allConditionsMet && conditionResults.length > 0) {
      console.log(`Alert triggered for ${alert.symbol}: ${alert.name}`);
      await this.triggerAlert(alert, marketData, conditionResults);
    }
  }

  private checkCondition(condition: AlertCondition, data: MarketData, symbol: string): string | null {
    const previousData = this.previousMarketData.get(symbol);

    switch (condition.type) {
      case "price_above":
        if (condition.value && data.price > condition.value) {
          return `Price $${data.price.toFixed(2)} is above $${condition.value.toFixed(2)}`;
        }
        break;

      case "price_below":
        if (condition.value && data.price < condition.value) {
          return `Price $${data.price.toFixed(2)} is below $${condition.value.toFixed(2)}`;
        }
        break;

      case "rsi_above":
        if (condition.value && data.rsi && data.rsi > condition.value) {
          return `RSI ${data.rsi.toFixed(2)} is above ${condition.value}`;
        }
        break;

      case "rsi_below":
        if (condition.value && data.rsi && data.rsi < condition.value) {
          return `RSI ${data.rsi.toFixed(2)} is below ${condition.value}`;
        }
        break;

      case "ema_cross_up":
        // EMA fast crosses above EMA slow
        if (data.emaFast && data.emaSlow && previousData?.emaFast && previousData?.emaSlow) {
          const currentCross = data.emaFast > data.emaSlow;
          const previousCross = previousData.emaFast > previousData.emaSlow;
          if (currentCross && !previousCross) {
            return `EMA fast crossed above EMA slow (bullish)`;
          }
        }
        break;

      case "ema_cross_down":
        // EMA fast crosses below EMA slow
        if (data.emaFast && data.emaSlow && previousData?.emaFast && previousData?.emaSlow) {
          const currentCross = data.emaFast < data.emaSlow;
          const previousCross = previousData.emaFast < previousData.emaSlow;
          if (currentCross && !previousCross) {
            return `EMA fast crossed below EMA slow (bearish)`;
          }
        }
        break;

      case "volume_spike":
        if (data.volume && data.avgVolume && condition.value) {
          const volumeRatio = data.volume / data.avgVolume;
          if (volumeRatio > condition.value) {
            return `Volume spike: ${volumeRatio.toFixed(2)}x average volume`;
          }
        }
        break;
    }

    // Store current data for next check (for crossover detection)
    this.previousMarketData.set(symbol, data);

    return null;
  }

  private async triggerAlert(alert: Alert, marketData: MarketData, conditionsMet: string[]): Promise<void> {
    try {
      // Create alert history record
      await storage.createAlertHistory({
        alertId: alert.id,
        userId: alert.userId,
        symbol: alert.symbol,
        price: marketData.price.toString(),
        rsi: marketData.rsi?.toString(),
        emaFast: marketData.emaFast?.toString(),
        emaSlow: marketData.emaSlow?.toString(),
        volume: marketData.volume?.toString(),
        conditionsMet: JSON.stringify(conditionsMet),
      });

      // Update alert status and trigger count
      const triggerCount = parseInt(alert.triggerCount) + 1;
      await storage.updateAlert(alert.id, alert.userId, {
        status: "triggered",
        triggeredAt: new Date(),
        triggerCount: triggerCount.toString(),
      });

      // Send notifications
      if (alert.notifyEmail === "true") {
        await this.sendEmailNotification(alert, marketData, conditionsMet);
      }

      // Browser notification would be handled via WebSocket in the future
      // if (alert.notifyBrowser === "true") {
      //   await this.sendBrowserNotification(alert, marketData, conditionsMet);
      // }
    } catch (error) {
      console.error(`Error triggering alert ${alert.id}:`, error);
    }
  }

  private async sendEmailNotification(alert: Alert, marketData: MarketData, conditionsMet: string[]): Promise<void> {
    try {
      const { sendAlertEmail } = await import("./email");

      // Get user email
      const user = await storage.getUser(alert.userId);
      if (!user) {
        console.error(`User not found for alert ${alert.id}`);
        return;
      }

      await sendAlertEmail({
        to: user.username,
        alertName: alert.name,
        symbol: alert.symbol,
        price: marketData.price,
        conditionsMet,
        triggeredAt: new Date(),
      });

      console.log(`Email notification sent to ${user.username} for alert: ${alert.name}`);
    } catch (error) {
      console.error("Error sending email notification:", error);
    }
  }
}

// Export singleton instance
export const alertChecker = new AlertChecker();
