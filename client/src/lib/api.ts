import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Holding, Trade, Watchlist, InsertHolding, InsertTrade, InsertWatchlist } from "@shared/schema";

// Types for market data
export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  name: string;
}

export interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PortfolioStats {
  totalEquity: number;
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
  sharpeRatio: number;
}

// Market Data Hooks
export function useQuote(symbol: string) {
  return useQuery<Quote>({
    queryKey: ["quote", symbol],
    queryFn: async () => {
      const response = await fetch(`/api/market/quote/${symbol}`);
      if (!response.ok) throw new Error("Failed to fetch quote");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!symbol,
  });
}

export function useMultiQuotes(symbols: string[]) {
  return useQuery<Quote[]>({
    queryKey: ["quotes", symbols],
    queryFn: async () => {
      const response = await fetch("/api/market/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols }),
      });
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    refetchInterval: 30000,
    enabled: symbols.length > 0,
  });
}

export function useHistoricalData(symbol: string, range = "1mo", interval = "1d") {
  return useQuery<HistoricalData[]>({
    queryKey: ["history", symbol, range, interval],
    queryFn: async () => {
      const response = await fetch(`/api/market/history/${symbol}?range=${range}&interval=${interval}`);
      if (!response.ok) throw new Error("Failed to fetch historical data");
      return response.json();
    },
    enabled: !!symbol,
  });
}

// Holdings Hooks
export function useHoldings() {
  return useQuery<Holding[]>({
    queryKey: ["holdings"],
    queryFn: async () => {
      const response = await fetch("/api/holdings");
      if (!response.ok) throw new Error("Failed to fetch holdings");
      return response.json();
    },
  });
}

export function useCreateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (holding: InsertHolding) => {
      const response = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holding),
      });
      if (!response.ok) throw new Error("Failed to create holding");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-stats"] });
    },
  });
}

export function useUpdateHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertHolding> }) => {
      const response = await fetch(`/api/holdings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update holding");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-stats"] });
    },
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/holdings/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete holding");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-stats"] });
    },
  });
}

// Trades Hooks
export function useTrades() {
  return useQuery<Trade[]>({
    queryKey: ["trades"],
    queryFn: async () => {
      const response = await fetch("/api/trades");
      if (!response.ok) throw new Error("Failed to fetch trades");
      return response.json();
    },
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trade: InsertTrade) => {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trade),
      });
      if (!response.ok) throw new Error("Failed to create trade");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-stats"] });
    },
  });
}

// Watchlist Hooks
export function useWatchlist() {
  return useQuery<Watchlist[]>({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const response = await fetch("/api/watchlist");
      if (!response.ok) throw new Error("Failed to fetch watchlist");
      return response.json();
    },
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: InsertWatchlist) => {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error("Failed to add to watchlist");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to remove from watchlist");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
}

// Portfolio Stats Hook
export function usePortfolioStats() {
  return useQuery<PortfolioStats>({
    queryKey: ["portfolio-stats"],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/stats");
      if (!response.ok) throw new Error("Failed to fetch portfolio stats");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
