import { 
  type User, 
  type InsertUser,
  type Holding,
  type InsertHolding,
  type Trade,
  type InsertTrade,
  type Watchlist,
  type InsertWatchlist,
  users,
  holdings,
  trades,
  watchlist
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Holdings methods
  getAllHoldings(): Promise<Holding[]>;
  getHolding(id: string): Promise<Holding | undefined>;
  getHoldingBySymbol(symbol: string): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: string, holding: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(id: string): Promise<void>;

  // Trade methods
  getAllTrades(): Promise<Trade[]>;
  getTrade(id: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  getTradesBySymbol(symbol: string): Promise<Trade[]>;

  // Watchlist methods
  getAllWatchlist(): Promise<Watchlist[]>;
  addToWatchlist(item: InsertWatchlist): Promise<Watchlist>;
  removeFromWatchlist(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
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

  // Holdings methods
  async getAllHoldings(): Promise<Holding[]> {
    return await db.select().from(holdings);
  }

  async getHolding(id: string): Promise<Holding | undefined> {
    const [holding] = await db.select().from(holdings).where(eq(holdings.id, id));
    return holding || undefined;
  }

  async getHoldingBySymbol(symbol: string): Promise<Holding | undefined> {
    const [holding] = await db.select().from(holdings).where(eq(holdings.symbol, symbol));
    return holding || undefined;
  }

  async createHolding(insertHolding: InsertHolding): Promise<Holding> {
    const [holding] = await db.insert(holdings).values(insertHolding).returning();
    return holding;
  }

  async updateHolding(id: string, updateData: Partial<InsertHolding>): Promise<Holding | undefined> {
    const [holding] = await db
      .update(holdings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(holdings.id, id))
      .returning();
    return holding || undefined;
  }

  async deleteHolding(id: string): Promise<void> {
    await db.delete(holdings).where(eq(holdings.id, id));
  }

  // Trade methods
  async getAllTrades(): Promise<Trade[]> {
    return await db.select().from(trades).orderBy(desc(trades.createdAt));
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id));
    return trade || undefined;
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(trades).values(insertTrade).returning();
    return trade;
  }

  async getTradesBySymbol(symbol: string): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.symbol, symbol)).orderBy(desc(trades.createdAt));
  }

  // Watchlist methods
  async getAllWatchlist(): Promise<Watchlist[]> {
    return await db.select().from(watchlist).orderBy(desc(watchlist.createdAt));
  }

  async addToWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const [item] = await db.insert(watchlist).values(insertWatchlist).returning();
    return item;
  }

  async removeFromWatchlist(id: string): Promise<void> {
    await db.delete(watchlist).where(eq(watchlist.id, id));
  }
}

export const storage = new DatabaseStorage();
