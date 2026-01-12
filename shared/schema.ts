import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: text("is_admin").default("false").notNull(),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isAdmin: true,
}).partial({ isAdmin: true }).extend({
  username: z.string().email("Username must be a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Holdings table - what assets the user owns
export const holdings = pgTable("holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "crypto" or "stock"
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  avgPrice: decimal("avg_price", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Trades table - transaction history
export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // "buy" or "sell"
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 2 }).notNull(),
  totalValue: decimal("total_value", { precision: 18, scale: 2 }).notNull(),
  fees: decimal("fees", { precision: 18, scale: 2 }).default("0").notNull(),
  status: text("status").notNull().default("filled"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Watchlist table - assets user is tracking
export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Settings table - system-wide settings (SMTP, etc.)
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).pick({
  key: true,
  value: true,
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

// Alerts table - user price/condition alerts
export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(), // User-friendly alert name
  type: text("type").notNull(), // "price" | "rsi" | "ema_cross" | "volume" | "multi"
  status: text("status").notNull().default("active"), // "active" | "triggered" | "paused"

  // Condition fields (JSON-stringified for complex multi-condition alerts)
  conditions: text("conditions").notNull(), // JSON string of alert conditions

  // Notification settings
  notifyEmail: text("notify_email").default("true").notNull(),
  notifyBrowser: text("notify_browser").default("true").notNull(),

  // Tracking
  lastChecked: timestamp("last_checked"),
  triggeredAt: timestamp("triggered_at"),
  triggerCount: decimal("trigger_count", { precision: 10, scale: 0 }).default("0").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  lastChecked: true,
  triggeredAt: true,
  triggerCount: true,
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;

// Alert history table - track when alerts trigger
export const alertHistory = pgTable("alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: varchar("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),

  // Snapshot of market data when alert triggered
  price: decimal("price", { precision: 18, scale: 2 }),
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  emaFast: decimal("ema_fast", { precision: 18, scale: 2 }),
  emaSlow: decimal("ema_slow", { precision: 18, scale: 2 }),
  volume: decimal("volume", { precision: 18, scale: 2 }),

  // Alert details at time of trigger
  conditionsMet: text("conditions_met").notNull(), // JSON string describing which conditions were met

  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
});

export const insertAlertHistorySchema = createInsertSchema(alertHistory).omit({
  id: true,
  triggeredAt: true,
});

export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertHistory = z.infer<typeof insertAlertHistorySchema>;

// Insert schemas (userId will be set server-side from authenticated user)
export const insertHoldingSchema = createInsertSchema(holdings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Types
export type Holding = typeof holdings.$inferSelect;
export type InsertHolding = z.infer<typeof insertHoldingSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

// Backtesting types (not stored in database - calculated on the fly)
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

// Risk Analytics types (calculated on the fly)
export interface PortfolioRiskMetrics {
  // Value at Risk metrics
  valueAtRisk: {
    var95: number; // 95% confidence VaR (1-day)
    var99: number; // 99% confidence VaR (1-day)
    cvar95: number; // Conditional VaR (expected loss beyond VaR)
    cvar99: number;
  };

  // Volatility metrics
  volatility: {
    daily: number; // Daily volatility (standard deviation of returns)
    annualized: number; // Annualized volatility
    downsideDeviation: number; // Downside volatility (negative returns only)
  };

  // Return metrics
  returns: {
    daily: number; // Average daily return
    annualized: number; // Annualized return
    cumulative: number; // Total return since inception
  };

  // Risk-adjusted returns
  sharpeRatio: number; // (Return - RiskFreeRate) / Volatility
  sortinoRatio: number; // (Return - RiskFreeRate) / DownsideDeviation
  calmarRatio: number; // AnnualizedReturn / MaxDrawdown

  // Drawdown metrics
  maxDrawdown: number; // Maximum peak-to-trough decline
  currentDrawdown: number; // Current drawdown from peak
  maxDrawdownDuration: number; // Days in max drawdown

  // Beta and correlation (vs market benchmark)
  beta: number; // Sensitivity to market movements
  alpha: number; // Excess return vs benchmark
  correlation: number; // Correlation with market

  // Portfolio composition risk
  concentrationRisk: number; // Herfindahl index (0-1, higher = more concentrated)
  diversificationRatio: number; // Portfolio vol / weighted avg vol
}

export interface AssetRiskMetrics {
  symbol: string;
  name: string;

  // Contribution to portfolio risk
  portfolioWeight: number; // % of total portfolio value
  marginContribution: number; // Contribution to portfolio VaR
  componentVaR: number; // VaR attributable to this asset

  // Individual asset metrics
  volatility: number; // Annualized volatility
  beta: number; // Beta vs portfolio
  sharpeRatio: number;
  maxDrawdown: number;

  // Current risk status
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // Correlation coefficients (-1 to 1)
  timestamp: Date;
}

export interface RiskAnalytics {
  portfolio: PortfolioRiskMetrics;
  assets: AssetRiskMetrics[];
  correlations: CorrelationMatrix;
  calculatedAt: Date;
}
