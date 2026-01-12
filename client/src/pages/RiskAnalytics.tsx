import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, Shield, Activity, PieChart } from "lucide-react";
import type { RiskAnalytics } from "@shared/schema";

export default function RiskAnalyticsDashboard() {
  const { data: riskData, isLoading, error } = useQuery<RiskAnalytics>({
    queryKey: ["/api/portfolio/risk-analytics"],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <Activity className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Calculating risk metrics...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !riskData) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="mt-4 text-muted-foreground">
            {error ? "Failed to load risk analytics" : "No holdings in portfolio"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">Add assets to your portfolio to view risk analytics</p>
        </div>
      </DashboardLayout>
    );
  }

  const { portfolio, assets, correlations } = riskData;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number, decimals = 2) => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const getRiskLevel = (value: number, metric: string): { level: string; color: string } => {
    if (metric === "volatility") {
      if (value < 0.15) return { level: "Low", color: "bg-green-500/10 text-green-500 border-green-500/20" };
      if (value < 0.30) return { level: "Medium", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" };
      return { level: "High", color: "bg-red-500/10 text-red-500 border-red-500/20" };
    }

    if (metric === "sharpe") {
      if (value > 1.5) return { level: "Excellent", color: "bg-green-500/10 text-green-500 border-green-500/20" };
      if (value > 1.0) return { level: "Good", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
      if (value > 0.5) return { level: "Fair", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" };
      return { level: "Poor", color: "bg-red-500/10 text-red-500 border-red-500/20" };
    }

    return { level: "N/A", color: "bg-muted/10 text-muted-foreground border-muted/20" };
  };

  const volatilityRisk = getRiskLevel(portfolio.volatility.annualized, "volatility");
  const sharpeRating = getRiskLevel(portfolio.sharpeRatio, "sharpe");

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 pb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Risk Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive risk assessment of your portfolio using industry-standard metrics
          </p>
        </div>

        {/* Value at Risk Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">VaR (95%)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {formatCurrency(portfolio.valueAtRisk.var95)}
              </div>
              <p className="text-xs text-muted-foreground">Maximum 1-day loss (95% confidence)</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">VaR (99%)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {formatCurrency(portfolio.valueAtRisk.var99)}
              </div>
              <p className="text-xs text-muted-foreground">Maximum 1-day loss (99% confidence)</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CVaR (95%)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(portfolio.valueAtRisk.cvar95)}
              </div>
              <p className="text-xs text-muted-foreground">Expected loss beyond VaR</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatPercent(portfolio.maxDrawdown)}
              </div>
              <p className="text-xs text-muted-foreground">
                Current: {formatPercent(portfolio.currentDrawdown)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Volatility and Returns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Volatility
                <Badge variant="outline" className={volatilityRisk.color}>
                  {volatilityRisk.level} Risk
                </Badge>
              </CardTitle>
              <CardDescription>Portfolio price volatility metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Daily Volatility:</span>
                <span className="text-sm font-medium">{formatPercent(portfolio.volatility.daily)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Annualized Volatility:</span>
                <span className="text-sm font-medium">{formatPercent(portfolio.volatility.annualized)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Downside Deviation:</span>
                <span className="text-sm font-medium">{formatPercent(portfolio.volatility.downsideDeviation)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Returns
              </CardTitle>
              <CardDescription>Portfolio return metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Daily Return:</span>
                <span className={`text-sm font-medium ${portfolio.returns.daily >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(portfolio.returns.daily)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Annualized Return:</span>
                <span className={`text-sm font-medium ${portfolio.returns.annualized >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(portfolio.returns.annualized)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cumulative Return:</span>
                <span className={`text-sm font-medium ${portfolio.returns.cumulative >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(portfolio.returns.cumulative)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Risk-Adjusted Returns
                <Badge variant="outline" className={sharpeRating.color}>
                  {sharpeRating.level}
                </Badge>
              </CardTitle>
              <CardDescription>Return per unit of risk</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Sharpe Ratio:</span>
                <span className="text-sm font-medium">{portfolio.sharpeRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Sortino Ratio:</span>
                <span className="text-sm font-medium">{portfolio.sortinoRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Calmar Ratio:</span>
                <span className="text-sm font-medium">{portfolio.calmarRatio.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Beta and Portfolio Composition */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-500" />
                Market Sensitivity
              </CardTitle>
              <CardDescription>Correlation with market benchmark (SPY)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Beta:</span>
                <span className="text-sm font-medium">{portfolio.beta.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Alpha (Annual):</span>
                <span className={`text-sm font-medium ${portfolio.alpha >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(portfolio.alpha)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Correlation:</span>
                <span className="text-sm font-medium">{portfolio.correlation.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Beta &gt; 1: More volatile than market | Beta &lt; 1: Less volatile
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-purple-500" />
                Portfolio Composition
              </CardTitle>
              <CardDescription>Diversification and concentration metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Concentration Risk:</span>
                <span className="text-sm font-medium">{portfolio.concentrationRisk.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Diversification Ratio:</span>
                <span className="text-sm font-medium">{portfolio.diversificationRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Max Drawdown Duration:</span>
                <span className="text-sm font-medium">{portfolio.maxDrawdownDuration} days</span>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Lower concentration = better diversification
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Individual Asset Risk Breakdown */}
        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle>Asset-Level Risk Breakdown</CardTitle>
            <CardDescription>Individual contribution to portfolio risk</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead>Symbol</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Component VaR</TableHead>
                  <TableHead>Volatility</TableHead>
                  <TableHead>Beta</TableHead>
                  <TableHead>Sharpe</TableHead>
                  <TableHead>Max DD</TableHead>
                  <TableHead>Unrealized P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.symbol} className="border-border/40 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium">{asset.symbol}</TableCell>
                    <TableCell>{asset.portfolioWeight.toFixed(1)}%</TableCell>
                    <TableCell className="text-orange-500">{formatCurrency(asset.componentVaR)}</TableCell>
                    <TableCell>{formatPercent(asset.volatility)}</TableCell>
                    <TableCell>{asset.beta.toFixed(2)}</TableCell>
                    <TableCell>{asset.sharpeRatio.toFixed(2)}</TableCell>
                    <TableCell className="text-red-500">{formatPercent(asset.maxDrawdown)}</TableCell>
                    <TableCell className={asset.unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}>
                      {formatCurrency(asset.unrealizedPnL)}
                      <span className="text-xs ml-1">
                        ({asset.unrealizedPnLPercent >= 0 ? "+" : ""}{asset.unrealizedPnLPercent.toFixed(2)}%)
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Correlation Matrix */}
        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle>Correlation Matrix</CardTitle>
            <CardDescription>Asset correlation coefficients (-1 to +1)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-sm font-medium text-muted-foreground border border-border/40"></th>
                    {correlations.symbols.map((symbol) => (
                      <th key={symbol} className="p-2 text-center text-sm font-medium text-muted-foreground border border-border/40">
                        {symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlations.matrix.map((row, i) => (
                    <tr key={correlations.symbols[i]}>
                      <td className="p-2 text-sm font-medium text-muted-foreground border border-border/40">
                        {correlations.symbols[i]}
                      </td>
                      {row.map((corr, j) => {
                        const absCorr = Math.abs(corr);
                        let bgColor = "bg-gray-500/10";
                        if (i === j) {
                          bgColor = "bg-blue-500/20";
                        } else if (absCorr > 0.7) {
                          bgColor = corr > 0 ? "bg-red-500/20" : "bg-green-500/20";
                        } else if (absCorr > 0.4) {
                          bgColor = corr > 0 ? "bg-orange-500/20" : "bg-cyan-500/20";
                        }

                        return (
                          <td
                            key={j}
                            className={`p-2 text-center text-sm border border-border/40 ${bgColor}`}
                          >
                            {corr.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              High positive correlation (red) = assets move together | High negative correlation (green) = assets move opposite | Low correlation = good diversification
            </p>
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground">
          <p>Last updated: {new Date(riskData.calculatedAt).toLocaleString()}</p>
          <p className="mt-2">
            <strong>Note:</strong> Risk metrics are calculated using 3 months of historical data and assume normal market conditions.
            Past performance does not guarantee future results. VaR represents statistical estimates of potential losses and should not be considered absolute limits.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
