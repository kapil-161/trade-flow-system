import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { BacktestResult } from "@shared/schema";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Scatter,
} from "recharts";

interface BacktestResultsProps {
  result: BacktestResult;
}

export function BacktestResults({ result }: BacktestResultsProps) {
  const equityData = useMemo(() => {
    const data: any[] = [];
    let equity = result.initialCapital;
    let peak = result.initialCapital;

    for (const trade of result.trades) {
      equity += trade.pnl;
      if (equity > peak) peak = equity;
      const drawdown = ((peak - equity) / peak) * 100;

      data.push({
        date: new Date(trade.exitDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        equity: Math.round(equity),
        cumPnL: Math.round(equity - result.initialCapital),
        drawdown: Math.max(0, drawdown),
      });
    }
    return data;
  }, [result]);

  const signalChartData = useMemo(() => {
    return result.historicalData.map(d => ({
      ...d,
      formattedDate: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      buyPrice: d.signal === "buy" ? d.close : null,
      sellPrice: d.signal === "sell" ? d.close : null,
    }));
  }, [result]);

  const profitColor = result.totalPnL >= 0 ? "#10b981" : "#ef4444";

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Total P&L</p>
            <p className={cn("text-2xl font-bold font-mono-nums", result.totalPnL >= 0 ? "text-profit" : "text-loss")}>
              ${result.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className={cn("text-xs mt-1", result.totalPnLPercent >= 0 ? "text-profit" : "text-loss")}>
              {result.totalPnLPercent.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Win Rate</p>
            <p className="text-2xl font-bold font-mono-nums">{result.winRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {result.winningTrades}W / {result.losingTrades}L
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Profit Factor</p>
            <p className="text-2xl font-bold font-mono-nums">{result.profitFactor.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg Win / Loss</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Max Drawdown</p>
            <p className="text-2xl font-bold font-mono-nums text-loss">{result.maxDrawdown.toFixed(2)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Peak to trough</p>
          </CardContent>
        </Card>
      </div>

      {/* Signal Chart */}
      <Card className="bg-card/50 backdrop-blur-md border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-medium tracking-tight">Price Chart & Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={signalChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="formattedDate" stroke="rgba(255,255,255,0.4)" fontSize={12} minTickGap={30} />
              <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.4)" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#1e1e2e", border: "none", borderRadius: "8px" }}
                itemStyle={{ fontSize: "12px" }}
              />
              <Line type="monotone" dataKey="close" stroke="#fff" dot={false} strokeWidth={1} opacity={0.8} />
              <Line type="monotone" dataKey="emaFast" stroke="#3b82f6" dot={false} strokeWidth={1} strokeDasharray="5 5" opacity={0.5} />
              <Line type="monotone" dataKey="emaSlow" stroke="#ef4444" dot={false} strokeWidth={1} strokeDasharray="5 5" opacity={0.5} />
              <Scatter name="Buy" dataKey="buyPrice" fill="#10b981" shape="triangle" />
              <Scatter name="Sell" dataKey="sellPrice" fill="#ef4444" shape="triangle" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Fast EMA</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Slow EMA</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Buy Signal</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Sell Signal</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Equity Curve */}
        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip />
                <Area type="monotone" dataKey="equity" stroke={profitColor} fill={profitColor} fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Technical Analysis Section */}
        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Technical Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-muted-foreground uppercase">Average Win</p>
                <p className="text-lg font-bold text-profit font-mono-nums">${result.averageWin.toFixed(0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-muted-foreground uppercase">Average Loss</p>
                <p className="text-lg font-bold text-loss font-mono-nums">${result.averageLoss.toFixed(0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-muted-foreground uppercase">Profit Factor</p>
                <p className="text-lg font-bold font-mono-nums">{result.profitFactor.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-[10px] text-muted-foreground uppercase">Expectancy</p>
                <p className="text-lg font-bold font-mono-nums">${((result.winRate/100 * result.averageWin) - ((1 - result.winRate/100) * result.averageLoss)).toFixed(0)}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Strategy: Multi-Factor Weighted Momentum</p>
              <p>• Indicators: EMA({result.historicalData[0]?.emaFast || 21}/{result.historicalData[0]?.emaSlow || 50}), RSI(14), MACD, ATR</p>
              <p>• Total Trades: {result.trades.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade History */}
      <Card className="bg-card/50 backdrop-blur-md border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-medium tracking-tight">Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          {result.trades.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No trades generated in backtest</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead className="text-right">R:R</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.trades.map((trade: any, i: number) => (
                  <TableRow key={i} className="border-border/40 text-xs">
                    <TableCell>{new Date(trade.entryDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-mono-nums">${trade.entryPrice.toFixed(2)}</TableCell>
                    <TableCell className={cn("text-right font-mono-nums font-bold", trade.pnl >= 0 ? "text-profit" : "text-loss")}>
                      ${trade.pnl.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-[10px] py-0">{trade.riskReward.toFixed(1)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
