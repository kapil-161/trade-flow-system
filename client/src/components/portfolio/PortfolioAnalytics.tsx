import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance Insights & Recommendations
          </CardTitle>
          <CardDescription>AI-powered analysis and actionable recommendations based on your portfolio metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Generate and Display Recommendations */}
          {useMemo(() => {
            const recommendations: Array<{
              priority: "high" | "medium" | "low";
              category: string;
              title: string;
              description: string;
              action?: string;
              icon: React.ReactNode;
            }> = [];

            // Risk Assessment
            if (volatility > 5) {
              recommendations.push({
                priority: "high",
                category: "Risk Management",
                title: "High Volatility Detected",
                description: `Your portfolio volatility is ${volatility.toFixed(1)}%, which is considered high. This indicates significant price swings.`,
                action: "Consider adding defensive assets (bonds, stablecoins) or reducing position sizes in volatile holdings.",
                icon: <TrendingDown className="h-4 w-4 text-loss" />,
              });
            } else if (volatility < 2 && (stats.totalPnLPercent || 0) < 5) {
              recommendations.push({
                priority: "medium",
                category: "Growth Opportunity",
                title: "Low Risk, Low Return",
                description: "Your portfolio has low volatility but also low returns. You may be too conservative.",
                action: "Consider allocating a small portion to growth assets to improve returns while maintaining overall stability.",
                icon: <TrendingUp className="h-4 w-4 text-yellow-500" />,
              });
            }

            // Sharpe Ratio Analysis
            if ((stats.sharpeRatio || 0) < 0) {
              recommendations.push({
                priority: "high",
                category: "Performance",
                title: "Negative Risk-Adjusted Returns",
                description: "Your Sharpe ratio is negative, meaning returns aren't compensating for risk.",
                action: "Review your trading strategy. Consider: 1) Improving entry/exit timing, 2) Reducing position sizes, 3) Adding stop-losses.",
                icon: <Activity className="h-4 w-4 text-loss" />,
              });
            } else if ((stats.sharpeRatio || 0) > 0 && (stats.sharpeRatio || 0) < 1) {
              recommendations.push({
                priority: "medium",
                category: "Performance",
                title: "Suboptimal Risk-Adjusted Returns",
                description: `Your Sharpe ratio of ${(stats.sharpeRatio || 0).toFixed(2)} is below the ideal threshold of 1.0.`,
                action: "Focus on improving win rate or reducing risk. Consider backtesting strategies before deploying capital.",
                icon: <Target className="h-4 w-4 text-yellow-500" />,
              });
            }

            // Diversification Analysis
            if (assetAllocation.length === 0) {
              recommendations.push({
                priority: "high",
                category: "Portfolio Building",
                title: "Empty Portfolio",
                description: "Start building your portfolio by adding your first positions.",
                action: "Use the 'New Order' button to add holdings. Consider starting with diversified positions across different asset types.",
                icon: <PieChart className="h-4 w-4 text-primary" />,
              });
            } else if (assetAllocation.length < 3) {
              recommendations.push({
                priority: "high",
                category: "Diversification",
                title: "Low Diversification",
                description: `You only have ${assetAllocation.length} position(s). Concentration risk is high.`,
                action: "Add more positions across different sectors/asset types. Aim for at least 5-10 holdings for better diversification.",
                icon: <BarChart3 className="h-4 w-4 text-loss" />,
              });
            } else if (assetAllocation[0]?.percentage > 40) {
              recommendations.push({
                priority: "high",
                category: "Concentration Risk",
                title: "High Position Concentration",
                description: `Your largest position (${assetAllocation[0].symbol}) represents ${assetAllocation[0].percentage.toFixed(1)}% of your portfolio.`,
                action: `Consider reducing ${assetAllocation[0].symbol} to below 20-25% and redistributing to other positions.`,
                icon: <TrendingDown className="h-4 w-4 text-loss" />,
              });
            } else if (typeDiversification.length === 1) {
              recommendations.push({
                priority: "medium",
                category: "Diversification",
                title: "Single Asset Type",
                description: `Your portfolio only contains ${typeDiversification[0].type} assets.`,
                action: "Consider adding positions in other asset types (stocks if you only have crypto, or vice versa) to reduce correlation risk.",
                icon: <PieChart className="h-4 w-4 text-yellow-500" />,
              });
            }

            // Win Rate Analysis
            if ((stats.winRate || 0) < 40 && stats.totalTrades >= 10) {
              recommendations.push({
                priority: "high",
                category: "Trading Strategy",
                title: "Low Win Rate",
                description: `Your win rate is ${(stats.winRate || 0).toFixed(1)}%, which is below the recommended 50%+.`,
                action: "Review losing trades: 1) Improve entry timing using technical analysis, 2) Tighten stop-losses, 3) Let winners run longer, 4) Avoid revenge trading.",
                icon: <Activity className="h-4 w-4 text-loss" />,
              });
            } else if ((stats.winRate || 0) >= 60 && stats.totalTrades >= 10) {
              recommendations.push({
                priority: "low",
                category: "Performance",
                title: "Excellent Win Rate",
                description: `Your win rate of ${(stats.winRate || 0).toFixed(1)}% is excellent! Keep up the good work.`,
                action: "Consider scaling up successful strategies while maintaining risk management discipline.",
                icon: <TrendingUp className="h-4 w-4 text-profit" />,
              });
            }

            // Drawdown Analysis
            if (maxDrawdown > 30) {
              recommendations.push({
                priority: "high",
                category: "Risk Management",
                title: "Severe Drawdown",
                description: `Your maximum drawdown of ${maxDrawdown.toFixed(1)}% is severe and indicates poor risk management.`,
                action: "Implement strict stop-losses (5-10% per position). Never risk more than 1-2% of capital per trade. Consider reducing position sizes.",
                icon: <TrendingDown className="h-4 w-4 text-loss" />,
              });
            } else if (maxDrawdown > 20) {
              recommendations.push({
                priority: "medium",
                category: "Risk Management",
                title: "Significant Drawdown",
                description: `Your maximum drawdown of ${maxDrawdown.toFixed(1)}% is significant.`,
                action: "Implement stop-loss strategies and position sizing rules. Consider taking partial profits at resistance levels.",
                icon: <Activity className="h-4 w-4 text-yellow-500" />,
              });
            }

            // P&L Analysis
            if ((stats.totalPnLPercent || 0) < -10) {
              recommendations.push({
                priority: "high",
                category: "Performance",
                title: "Significant Losses",
                description: `Your portfolio is down ${Math.abs(stats.totalPnLPercent || 0).toFixed(1)}%.`,
                action: "Review all positions. Consider: 1) Cutting losses on underperformers, 2) Rebalancing to winners, 3) Taking a break to reassess strategy.",
                icon: <TrendingDown className="h-4 w-4 text-loss" />,
              });
            } else if ((stats.totalPnLPercent || 0) > 20) {
              recommendations.push({
                priority: "low",
                category: "Performance",
                title: "Strong Performance",
                description: `Your portfolio is up ${(stats.totalPnLPercent || 0).toFixed(1)}%! Excellent work.`,
                action: "Consider taking partial profits on winners and rebalancing. Protect gains with trailing stop-losses.",
                icon: <TrendingUp className="h-4 w-4 text-profit" />,
              });
            }

            // Trade Frequency Analysis
            if (stats.totalTrades > 50) {
              recommendations.push({
                priority: "medium",
                category: "Trading Behavior",
                title: "High Trade Frequency",
                description: `You've made ${stats.totalTrades} trades. High frequency can lead to overtrading.`,
                action: "Focus on quality over quantity. Wait for high-probability setups. Overtrading often reduces win rate due to transaction costs and emotional decisions.",
                icon: <Activity className="h-4 w-4 text-yellow-500" />,
              });
            } else if (stats.totalTrades < 5 && assetAllocation.length > 0) {
              recommendations.push({
                priority: "low",
                category: "Trading Behavior",
                title: "Low Trade Frequency",
                description: "You have few trades relative to your holdings. This suggests a buy-and-hold approach.",
                action: "Consider reviewing positions periodically. Even long-term holdings benefit from occasional rebalancing.",
                icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
              });
            }

            return recommendations;
          }, [stats, volatility, maxDrawdown, assetAllocation, typeDiversification]).map((rec, index) => (
            <div
              key={index}
              className={cn(
                "p-4 rounded-lg border space-y-2",
                rec.priority === "high"
                  ? "border-loss/50 bg-loss/5"
                  : rec.priority === "medium"
                  ? "border-yellow-500/50 bg-yellow-500/5"
                  : "border-primary/50 bg-primary/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "mt-0.5",
                  rec.priority === "high" ? "text-loss" :
                  rec.priority === "medium" ? "text-yellow-500" : "text-primary"
                )}>
                  {rec.icon}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{rec.title}</h4>
                    <Badge
                      variant={
                        rec.priority === "high" ? "destructive" :
                        rec.priority === "medium" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {rec.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {rec.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                  {rec.action && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-sm font-medium text-foreground">💡 Recommendation:</p>
                      <p className="text-sm text-muted-foreground mt-1">{rec.action}</p>
          </div>
                  )}
                </div>
              </div>
          </div>
          ))}

          {/* Summary if no recommendations */}
          {useMemo(() => {
            const recommendations: Array<{
              priority: "high" | "medium" | "low";
              category: string;
              title: string;
              description: string;
              action?: string;
              icon: React.ReactNode;
            }> = [];

            if (volatility > 5) recommendations.push({ priority: "high", category: "Risk", title: "", description: "", icon: null });
            if ((stats.sharpeRatio || 0) < 0) recommendations.push({ priority: "high", category: "Performance", title: "", description: "", icon: null });
            if (assetAllocation.length === 0) recommendations.push({ priority: "high", category: "Portfolio", title: "", description: "", icon: null });
            if (assetAllocation.length < 3) recommendations.push({ priority: "high", category: "Diversification", title: "", description: "", icon: null });
            if (assetAllocation[0]?.percentage > 40) recommendations.push({ priority: "high", category: "Concentration", title: "", description: "", icon: null });
            if ((stats.winRate || 0) < 40 && stats.totalTrades >= 10) recommendations.push({ priority: "high", category: "Strategy", title: "", description: "", icon: null });
            if (maxDrawdown > 30) recommendations.push({ priority: "high", category: "Risk", title: "", description: "", icon: null });
            if ((stats.totalPnLPercent || 0) < -10) recommendations.push({ priority: "high", category: "Performance", title: "", description: "", icon: null });

            return recommendations.length === 0;
          }, [stats, volatility, maxDrawdown, assetAllocation]) && (
            <div className="p-4 rounded-lg border border-primary/50 bg-primary/5">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-profit" />
                <div>
                  <h4 className="text-sm font-semibold">Portfolio Health: Good</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your portfolio metrics are within healthy ranges. Continue monitoring and maintain your current risk management practices.
            </p>
          </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
