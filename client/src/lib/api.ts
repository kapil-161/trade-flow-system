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
  maxDrawdown?: number;
}

// Market Data Hooks
// Note: For real-time updates, use useRealtimeQuote from @/lib/websocket
export function useQuote(symbol: string) {
  return useQuery<Quote>({
    queryKey: ["quote", symbol],
    queryFn: async () => {
      const response = await fetch(`/api/market/quote/${symbol}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch quote");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every 60 seconds (WebSocket provides real-time updates every 1 minute)
    enabled: !!symbol,
  });
}

// Note: For real-time updates, use useRealtimeQuotes from @/lib/websocket
export function useMultiQuotes(symbols: string[]) {
  return useQuery<Quote[]>({
    queryKey: ["quotes", symbols],
    queryFn: async () => {
      const response = await fetch("/api/market/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every 60 seconds (WebSocket provides real-time updates every 1 minute)
    enabled: symbols.length > 0,
  });
}

export function useHistoricalData(symbol: string, range = "1mo", interval = "1d") {
  return useQuery<HistoricalData[]>({
    queryKey: ["history", symbol, range, interval],
    queryFn: async () => {
      const response = await fetch(`/api/market/history/${symbol}?range=${range}&interval=${interval}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch historical data");
      return response.json();
    },
    enabled: !!symbol,
  });
}

// Portfolio value history hook
export function usePortfolioHistory(range = "3mo", interval = "1d") {
  return useQuery<HistoricalData[]>({
    queryKey: ["portfolio-history", range, interval],
    queryFn: async () => {
      const response = await fetch(`/api/portfolio/history?range=${range}&interval=${interval}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch portfolio history");
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

// Holdings Hooks
export function useHoldings() {
  return useQuery<Holding[]>({
    queryKey: ["holdings"],
    queryFn: async () => {
      const response = await fetch("/api/holdings", {
        credentials: "include",
      });
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
        credentials: "include",
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
        credentials: "include",
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
      const response = await fetch(`/api/holdings/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete holding");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-stats"] });
    },
  });
}

export function useDeleteAllHoldings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/holdings", {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete all holdings");
      return response.json();
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
      const response = await fetch("/api/trades", {
        credentials: "include",
      });
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
        credentials: "include",
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
      const response = await fetch("/api/watchlist", {
        credentials: "include",
      });
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
        credentials: "include",
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
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
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
      const response = await fetch("/api/portfolio/stats", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch portfolio stats");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

// Scanner Signal Types
export interface ScannerSignal {
  symbol: string;
  signal: "buy" | "sell" | "hold";
  price: number;
  emaFast: number;
  emaSlow: number;
  rsi: number;
  score: number;
  rsiDivergence: "bullish" | "bearish" | "none";
  volumeDivergence: "bullish" | "bearish" | "none";
}

export interface ScannerSignalsResponse {
  results: ScannerSignal[];
  scanDate: string;
}

// Portfolio Scanner Signals Hook - fetches signals for portfolio holdings
export function usePortfolioScannerSignals(symbols: string[]) {
  return useQuery<Record<string, ScannerSignal>>({
    queryKey: ["portfolio-scanner-signals", symbols.sort().join(",")], // Sort for consistent cache key
    queryFn: async () => {
      if (symbols.length === 0) return {};
      
      try {
        const response = await fetch("/api/backtest/batch-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbols: symbols.map(s => s.toUpperCase()), // Ensure uppercase
            config: {
              emaFast: 21,
              emaSlow: 50,
              rsiLower: 45,
              rsiUpper: 65,
              scoreThreshold: 7,
              trendFilter: true,
              volatilityFilter: true,
            },
          }),
          credentials: "include",
        });
        
        if (!response.ok) {
          console.warn("Failed to fetch scanner signals:", response.status, response.statusText);
          return {}; // Return empty object instead of throwing
        }
        
        const data: ScannerSignalsResponse = await response.json();
        
        // Convert array to object keyed by symbol for easy lookup (case-insensitive)
        const signalsMap: Record<string, ScannerSignal> = {};
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((signal) => {
            // Store with uppercase key for consistency
            signalsMap[signal.symbol.toUpperCase()] = signal;
          });
        }
        
        return signalsMap;
      } catch (error) {
        console.error("Error fetching scanner signals:", error);
        return {}; // Return empty object on error instead of throwing
      }
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    enabled: symbols.length > 0,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    retry: 1, // Retry once on failure
  });
}
