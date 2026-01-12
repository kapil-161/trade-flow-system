import { Card, CardContent } from "@/components/ui/card";
import { Wallet, DollarSign, Activity, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortfolioStats } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export function PortfolioSummary() {
  const { data: stats, isLoading } = usePortfolioStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-card/50 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const summaryStats = [
    { 
      label: "Total Equity", 
      value: `$${stats?.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`, 
      change: stats ? `${stats.totalPnLPercent >= 0 ? "+" : ""}${stats.totalPnLPercent.toFixed(2)}%` : "0%",
      icon: Wallet, 
      trend: (stats?.totalPnLPercent || 0) >= 0 ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Total P&L", 
      value: `${(stats?.totalPnL ?? 0) >= 0 ? "+" : ""}$${Math.abs(stats?.totalPnL ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      change: stats ? `${stats.totalPnLPercent >= 0 ? "+" : ""}${stats.totalPnLPercent.toFixed(2)}%` : "0%",
      icon: DollarSign, 
      trend: (stats?.totalPnL ?? 0) >= 0 ? "up" : "down" as "up" | "down"
    },
    { 
      label: "Win Rate", 
      value: `${stats?.winRate.toFixed(1) || "0.0"}%`, 
      change: `${stats?.totalTrades || 0} trades`,
      icon: Activity, 
      trend: "up" as "up" | "down"
    },
    { 
      label: "Sharpe Ratio", 
      value: (stats?.sharpeRatio ?? 0).toFixed(2), 
      change: "Good",
      icon: Percent, 
      trend: "up" as "up" | "down"
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {summaryStats.map((stat, index) => (
        <Card key={index} className="bg-card/50 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors duration-300" data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground" data-testid={`text-label-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>{stat.label}</p>
              <stat.icon className="h-4 w-4 text-muted-foreground" data-testid={`icon-${stat.label.toLowerCase().replace(/\s+/g, '-')}`} />
            </div>
            <div className="flex items-end justify-between mt-2">
              <div className="text-2xl font-bold font-mono-nums tracking-tight" data-testid={`text-value-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>{stat.value}</div>
              <div className={cn(
                "text-xs font-medium px-2 py-1 rounded-full",
                stat.trend === "up" 
                  ? "text-profit bg-profit/10" 
                  : "text-loss bg-loss/10"
              )} data-testid={`badge-change-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                {stat.change}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
