import {
  type User,
  type InsertUser,
  type Holding,
  type InsertHolding,
  type Trade,
  type InsertTrade,
  type Watchlist,
  type InsertWatchlist,
  type Setting,
  type InsertSetting,
  type Alert,
  type InsertAlert,
  type AlertHistory,
  type InsertAlertHistory,
  users,
  holdings,
  trades,
  watchlist,
  settings,
  alerts,
  alertHistory
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Holdings methods
  getAllHoldings(userId: string): Promise<Holding[]>;
  getHolding(id: string, userId: string): Promise<Holding | undefined>;
  getHoldingBySymbol(symbol: string, userId: string): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding & { userId: string }): Promise<Holding>;
  updateHolding(id: string, userId: string, holding: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(id: string, userId: string): Promise<void>;
  deleteAllHoldings(userId: string): Promise<number>;

  // Trade methods
  getAllTrades(userId: string): Promise<Trade[]>;
  getTrade(id: string, userId: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade & { userId: string }): Promise<Trade>;
  getTradesBySymbol(symbol: string, userId: string): Promise<Trade[]>;

  // Watchlist methods
  getAllWatchlist(userId: string): Promise<Watchlist[]>;
  addToWatchlist(item: InsertWatchlist & { userId: string }): Promise<Watchlist>;
  removeFromWatchlist(id: string, userId: string): Promise<void>;

  // Admin methods - get all data across all users
  getAllHoldingsForAdmin(): Promise<Holding[]>;
  getAllTradesForAdmin(): Promise<Trade[]>;
  getAllWatchlistForAdmin(): Promise<Watchlist[]>;

  // Settings methods
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  setSetting(key: string, value: string): Promise<Setting>;
  deleteSetting(key: string): Promise<void>;

  // Alert methods
  getAllAlerts(userId: string): Promise<Alert[]>;
  getAlert(id: string, userId: string): Promise<Alert | undefined>;
  getActiveAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert & { userId: string }): Promise<Alert>;
  updateAlert(id: string, userId: string, alert: Partial<Alert>): Promise<Alert | undefined>;
  deleteAlert(id: string, userId: string): Promise<void>;

  // Alert history methods
  createAlertHistory(history: InsertAlertHistory): Promise<AlertHistory>;
  getAlertHistory(alertId: string, userId: string): Promise<AlertHistory[]>;
  getAllAlertHistory(userId: string): Promise<AlertHistory[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Holdings methods
  async getAllHoldings(userId: string): Promise<Holding[]> {
    return await db.select().from(holdings).where(eq(holdings.userId, userId));
  }

  async getHolding(id: string, userId: string): Promise<Holding | undefined> {
    const [holding] = await db
      .select()
      .from(holdings)
      .where(and(eq(holdings.id, id), eq(holdings.userId, userId)));
    return holding || undefined;
  }

  async getHoldingBySymbol(symbol: string, userId: string): Promise<Holding | undefined> {
    const [holding] = await db
      .select()
      .from(holdings)
      .where(and(eq(holdings.symbol, symbol), eq(holdings.userId, userId)));
    return holding || undefined;
  }

  async createHolding(insertHolding: InsertHolding & { userId: string }): Promise<Holding> {
    const [holding] = await db.insert(holdings).values(insertHolding).returning();
    return holding;
  }

  async updateHolding(id: string, userId: string, updateData: Partial<InsertHolding>): Promise<Holding | undefined> {
    const [holding] = await db
      .update(holdings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(holdings.id, id), eq(holdings.userId, userId)))
      .returning();
    return holding || undefined;
  }

  async deleteHolding(id: string, userId: string): Promise<void> {
    await db.delete(holdings).where(and(eq(holdings.id, id), eq(holdings.userId, userId)));
  }

  async deleteAllHoldings(userId: string): Promise<number> {
    const userHoldings = await this.getAllHoldings(userId);
    const count = userHoldings.length;
    if (count > 0) {
      await db.delete(holdings).where(eq(holdings.userId, userId));
    }
    return count;
  }

  // Trade methods
  async getAllTrades(userId: string): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(eq(trades.userId, userId))
      .orderBy(desc(trades.createdAt));
  }

  async getTrade(id: string, userId: string): Promise<Trade | undefined> {
    const [trade] = await db
      .select()
      .from(trades)
      .where(and(eq(trades.id, id), eq(trades.userId, userId)));
    return trade || undefined;
  }

  async createTrade(insertTrade: InsertTrade & { userId: string }): Promise<Trade> {
    const [trade] = await db.insert(trades).values(insertTrade).returning();
    return trade;
  }

  async getTradesBySymbol(symbol: string, userId: string): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(and(eq(trades.symbol, symbol), eq(trades.userId, userId)))
      .orderBy(desc(trades.createdAt));
  }

  // Watchlist methods
  async getAllWatchlist(userId: string): Promise<Watchlist[]> {
    return await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.createdAt));
  }

  async addToWatchlist(insertWatchlist: InsertWatchlist & { userId: string }): Promise<Watchlist> {
    const [item] = await db.insert(watchlist).values(insertWatchlist).returning();
    return item;
  }

  async removeFromWatchlist(id: string, userId: string): Promise<void> {
    await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)));
  }

  // Admin methods - get all data across all users
  async getAllHoldingsForAdmin(): Promise<Holding[]> {
    return await db.select().from(holdings);
  }

  async getAllTradesForAdmin(): Promise<Trade[]> {
    return await db.select().from(trades).orderBy(desc(trades.createdAt));
  }

  async getAllWatchlistForAdmin(): Promise<Watchlist[]> {
    return await db.select().from(watchlist).orderBy(desc(watchlist.createdAt));
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async setSetting(key: string, value: string): Promise<Setting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ value, updatedAt: sql`NOW()` })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(settings)
        .values({ key, value })
        .returning();
      return created;
    }
  }

  async deleteSetting(key: string): Promise<void> {
    await db.delete(settings).where(eq(settings.key, key));
  }

  // Alert methods
  async getAllAlerts(userId: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.createdAt));
  }

  async getAlert(id: string, userId: string): Promise<Alert | undefined> {
    const [alert] = await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
    return alert || undefined;
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.status, "active"));
  }

  async createAlert(insertAlert: InsertAlert & { userId: string }): Promise<Alert> {
    const [alert] = await db.insert(alerts).values(insertAlert).returning();
    return alert;
  }

  async updateAlert(id: string, userId: string, updateData: Partial<Alert>): Promise<Alert | undefined> {
    const [alert] = await db
      .update(alerts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(alerts.id, id), eq(alerts.userId, userId)))
      .returning();
    return alert || undefined;
  }

  async deleteAlert(id: string, userId: string): Promise<void> {
    await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
  }

  // Alert history methods
  async createAlertHistory(insertHistory: InsertAlertHistory): Promise<AlertHistory> {
    const [history] = await db.insert(alertHistory).values(insertHistory).returning();
    return history;
  }

  async getAlertHistory(alertId: string, userId: string): Promise<AlertHistory[]> {
    return await db
      .select()
      .from(alertHistory)
      .where(and(eq(alertHistory.alertId, alertId), eq(alertHistory.userId, userId)))
      .orderBy(desc(alertHistory.triggeredAt));
  }

  async getAllAlertHistory(userId: string): Promise<AlertHistory[]> {
    return await db
      .select()
      .from(alertHistory)
      .where(eq(alertHistory.userId, userId))
      .orderBy(desc(alertHistory.triggeredAt));
  }
}

export const storage = new DatabaseStorage();
