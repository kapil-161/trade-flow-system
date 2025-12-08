import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, Activity, Percent } from "lucide-react";

export interface Asset {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  type: "crypto" | "stock";
  allocation: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
  date: string;
  status: "filled" | "pending" | "cancelled";
}

export const portfolioHistory = [
  { date: "09:00", value: 124000 },
  { date: "10:00", value: 124500 },
  { date: "11:00", value: 124200 },
  { date: "12:00", value: 125100 },
  { date: "13:00", value: 124800 },
  { date: "14:00", value: 125400 },
  { date: "15:00", value: 126200 },
  { date: "16:00", value: 125800 },
];

export const assets: Asset[] = [
  { symbol: "BTC", name: "Bitcoin", quantity: 1.25, avgPrice: 45000, currentPrice: 68500, type: "crypto", allocation: 45 },
  { symbol: "ETH", name: "Ethereum", quantity: 15.5, avgPrice: 2800, currentPrice: 3950, type: "crypto", allocation: 25 },
  { symbol: "NVDA", name: "NVIDIA Corp", quantity: 50, avgPrice: 450, currentPrice: 890, type: "stock", allocation: 15 },
  { symbol: "TSLA", name: "Tesla Inc", quantity: 100, avgPrice: 180, currentPrice: 175, type: "stock", allocation: 8 },
  { symbol: "SOL", name: "Solana", quantity: 500, avgPrice: 45, currentPrice: 145, type: "crypto", allocation: 7 },
];

export const marketData = [
  { symbol: "BTC/USD", price: 68524.50, change: 2.4, volume: "24B" },
  { symbol: "ETH/USD", price: 3952.10, change: 1.8, volume: "12B" },
  { symbol: "SPX", price: 5124.50, change: 0.45, volume: "N/A" },
  { symbol: "NDX", price: 18240.20, change: -0.12, volume: "N/A" },
  { symbol: "SOL/USD", price: 145.20, change: 5.6, volume: "2B" },
];

export const recentTrades: Trade[] = [
  { id: "t1", symbol: "BTC", side: "buy", amount: 0.1, price: 67500, date: "2024-03-10 14:30", status: "filled" },
  { id: "t2", symbol: "NVDA", side: "sell", amount: 10, price: 885, date: "2024-03-10 11:15", status: "filled" },
  { id: "t3", symbol: "ETH", side: "buy", amount: 2.5, price: 3850, date: "2024-03-09 09:45", status: "filled" },
  { id: "t4", symbol: "SOL", side: "buy", amount: 50, price: 142, date: "2024-03-09 09:40", status: "filled" },
];

export const stats = [
  { label: "Total Equity", value: "$125,840.50", change: "+1.2%", icon: Wallet, trend: "up" },
  { label: "Daily P&L", value: "+$1,450.20", change: "+0.85%", icon: DollarSign, trend: "up" },
  { label: "Win Rate", value: "68%", change: "+2.4%", icon: Activity, trend: "up" },
  { label: "Sharpe Ratio", value: "2.1", change: "-0.1", icon: Percent, trend: "down" },
];
