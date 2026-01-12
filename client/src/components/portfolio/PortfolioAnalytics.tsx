import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHoldings, usePortfolioStats, useTrades } from "@/lib/api";
import { TrendingUp, TrendingDown, Activity, PieChart, BarChart3, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface AssetAllocation {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  pnl: number;
  pnlPercent: number;
}

export function PortfolioAnalytics() {
  const { data: stats } = usePortfolioStats();
  const { data: holdings = [] } = useHoldings();
  const { data: trades = [] } = useTrades();

  // Calculate asset allocation
  const assetAllocation = useMemo<AssetAllocation[]>(() => {
    if (!stats || !holdings.length) return [];

    const totalEquity = stats.totalEquity || 0;

    return holdings.map(holding => {
      const currentPrice = 0; // Will be updated from market data
      const quantity = parseFloat(holding.quantity);
      const avgPrice = parseFloat(holding.avgPrice);
      const value = quantity * (currentPrice || avgPrice);
      const pnl = quantity * ((currentPrice || avgPrice) - avgPrice);
      const pnlPercent = avgPrice > 0 ? (pnl / (quantity * avgPrice)) * 100 : 0;

      return {
        symbol: holding.symbol,
        name: holding.name,
        value,
        percentage: totalEquity > 0 ? (value / totalEquity) * 100 : 0,
        pnl,
        pnlPercent,
      };
    }).sort((a, b) => b.value - a.value);
  }, [holdings, stats]);

  // Calculate sector/type diversification
  const typeDiversification = useMemo(() => {
    const typeMap = new Map<string, number>();
    holdings.forEach(h => {
      const type = h.type || 'unknown';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    return Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: holdings.length > 0 ? (count / holdings.length) * 100 : 0,
    }));
  }, [holdings]);

  // Calculate volatility (standard deviation of returns)
  const volatility = useMemo(() => {
    if (trades.length < 2) return 0;

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const returns: number[] = [];
    for (let i = 1; i < sortedTrades.length; i++) {
      const prevPrice = parseFloat(sortedTrades[i - 1].price);
      const currentPrice = parseFloat(sortedTrades[i].price);
      if (prevPrice > 0) {
        returns.push((currentPrice - prevPrice) / prevPrice);
      }
    }

    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100; // Convert to percentage
  }, [trades]);

  // Calculate max drawdown
  const maxDrawdown = useMemo(() => {
    if (trades.length < 2) return 0;

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let peak = parseFloat(sortedTrades[0].totalValue);
    let maxDD = 0;

    sortedTrades.forEach(trade => {
      const value = parseFloat(trade.totalValue);
      if (value > peak) {
        peak = value;
      } else {
        const drawdown = ((peak - value) / peak) * 100;
        maxDD = Math.max(maxDD, drawdown);
      }
    });

    return maxDD;
  }, [trades]);

  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono-nums">
              {stats.sharpeRatio?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              {(stats.sharpeRatio || 0) > 1 ? 'Good' : (stats.sharpeRatio || 0) > 0 ? 'Fair' : 'Poor'} risk-adjusted returns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volatility</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono-nums">
              {volatility.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {volatility < 2 ? 'Low' : volatility < 5 ? 'Medium' : 'High'} portfolio risk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold font-mono-nums",
              maxDrawdown > 20 ? "text-loss" : maxDrawdown > 10 ? "text-yellow-500" : "text-profit"
            )}>
              -{maxDrawdown.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Largest peak-to-trough decline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold font-mono-nums",
              (stats.winRate || 0) >= 60 ? "text-profit" : (stats.winRate || 0) >= 40 ? "text-yellow-500" : "text-loss"
            )}>
              {stats.winRate?.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTrades || 0} total trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Asset Allocation & Diversification */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Asset Allocation
            </CardTitle>
            <CardDescription>Portfolio distribution by holding</CardDescription>
          </CardHeader>
          <CardContent>
            {assetAllocation.length === 0 ? (
              <p className="text-sm text-muted-foreground">No holdings yet</p>
            ) : (
              <div className="space-y-3">
                {assetAllocation.slice(0, 5).map((asset) => (
                  <div key={asset.symbol} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{asset.symbol}</span>
                        <span className="text-muted-foreground text-xs">
                          {asset.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className={cn(
                        "text-xs font-medium",
                        asset.pnlPercent >= 0 ? "text-profit" : "text-loss"
                      )}>
                        {asset.pnlPercent >= 0 ? '+' : ''}{asset.pnlPercent.toFixed(1)}%
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(asset.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {assetAllocation.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    +{assetAllocation.length - 5} more positions
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Type Diversification
            </CardTitle>
            <CardDescription>Holdings by asset type</CardDescription>
          </CardHeader>
          <CardContent>
            {typeDiversification.length === 0 ? (
              <p className="text-sm text-muted-foreground">No holdings yet</p>
            ) : (
              <div className="space-y-4">
                {typeDiversification.map((item) => (
                  <div key={item.type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-3 w-3 rounded-full",
                          item.type === 'stock' ? "bg-blue-500" :
                          item.type === 'crypto' ? "bg-orange-500" : "bg-gray-500"
                        )} />
                        <span className="text-sm font-medium capitalize">{item.type}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.count} ({item.percentage.toFixed(0)}%)
                      </div>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          item.type === 'stock' ? "bg-blue-500" :
                          item.type === 'crypto' ? "bg-orange-500" : "bg-gray-500"
                        )}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
          <CardDescription>Analysis and recommendations based on your portfolio metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Risk Assessment</h4>
            <p className="text-sm text-muted-foreground">
              {volatility < 2 ? (
                "Your portfolio shows low volatility, indicating stable performance with lower risk exposure."
              ) : volatility < 5 ? (
                "Your portfolio has moderate volatility. Consider diversifying if you're risk-averse."
              ) : (
                "Your portfolio exhibits high volatility. Consider rebalancing towards more stable assets if this exceeds your risk tolerance."
              )}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Sharpe Ratio Analysis</h4>
            <p className="text-sm text-muted-foreground">
              {(stats.sharpeRatio || 0) > 1 ? (
                "Excellent risk-adjusted returns! Your portfolio is generating good returns relative to its risk."
              ) : (stats.sharpeRatio || 0) > 0 ? (
                "Fair risk-adjusted returns. There may be opportunities to improve returns without increasing risk."
              ) : (
                "Your returns aren't compensating for the risk taken. Consider reviewing your strategy and asset selection."
              )}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Diversification</h4>
            <p className="text-sm text-muted-foreground">
              {assetAllocation.length === 0 ? (
                "Start building your portfolio by adding positions."
              ) : assetAllocation.length < 3 ? (
                "Consider adding more positions to improve diversification and reduce concentration risk."
              ) : assetAllocation[0].percentage > 40 ? (
                `Your largest position (${assetAllocation[0].symbol}) represents ${assetAllocation[0].percentage.toFixed(1)}% of your portfolio. Consider rebalancing to reduce concentration risk.`
              ) : (
                "Your portfolio shows good diversification across multiple holdings."
              )}
            </p>
          </div>

          {maxDrawdown > 20 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-loss">Drawdown Alert</h4>
              <p className="text-sm text-muted-foreground">
                Your maximum drawdown of {maxDrawdown.toFixed(1)}% is significant. Consider implementing stop-loss strategies to protect capital during downturns.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
