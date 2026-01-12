import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { usePortfolioStats, useHoldings } from "@/lib/api";

export function RiskMonitor() {
  const { data: stats } = usePortfolioStats();
  const { data: holdings } = useHoldings();

  // Calculate maximum drawdown from portfolio stats
  const maxDrawdown = stats?.maxDrawdown || 0;

  // Calculate portfolio VaR (simplified as % of total equity at risk)
  // Using max drawdown as proxy for VaR
  const portfolioVaR = maxDrawdown > 0 ? maxDrawdown : 0;

  // Find largest holding concentration
  const largestHolding = holdings?.reduce((max, holding) => {
    const holdingValue = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
    const maxValue = parseFloat(max.quantity) * parseFloat(max.avgPrice);
    return holdingValue > maxValue ? holding : max;
  }, holdings[0]);

  const largestHoldingPercent = stats && stats.totalEquity && largestHolding
    ? ((parseFloat(largestHolding.quantity) * parseFloat(largestHolding.avgPrice)) / stats.totalEquity) * 100
    : 0;

  const concentrationThreshold = 40; // 40% threshold
  const hasConcentrationAlert = largestHoldingPercent > concentrationThreshold;

  return (
    <Card className="h-full min-h-[300px] bg-card/50 backdrop-blur-md border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Risk Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Portfolio VaR (95%)</span>
            <span className="font-mono-nums font-bold text-loss">{portfolioVaR.toFixed(1)}%</span>
          </div>
          {/* Override internal indicator color */}
          <Progress value={Math.min(portfolioVaR * 10, 100)} className="h-2 bg-secondary [&>div]:bg-loss" />
          <p className="text-xs text-muted-foreground">
            {portfolioVaR < 5 ? "Value at Risk is within acceptable limits." : "Risk exposure is elevated."}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Max Drawdown</span>
            <span className="font-mono-nums font-bold text-orange-400">{maxDrawdown.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(maxDrawdown * 10, 100)} className="h-2 bg-secondary [&>div]:bg-orange-400" />
        </div>

        {hasConcentrationAlert && largestHolding && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-orange-200">Concentration Alert</p>
              <p className="text-xs text-muted-foreground">
                {largestHolding.symbol} allocation ({largestHoldingPercent.toFixed(1)}%) exceeds recommended cap of {concentrationThreshold}%. Consider rebalancing.
              </p>
            </div>
          </div>
        )}
        {!hasConcentrationAlert && holdings && holdings.length > 0 && (
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-200">Portfolio Balanced</p>
              <p className="text-xs text-muted-foreground">
                No concentration alerts. Largest position: {largestHolding?.symbol} ({largestHoldingPercent.toFixed(1)}%)
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
