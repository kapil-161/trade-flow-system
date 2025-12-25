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
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BacktestResultsProps {
  result: BacktestResult;
}

export function BacktestResults({ result }: BacktestResultsProps) {
  const chartData = useMemo(() => {
    // Calculate equity curve and drawdown from trades
    const data: Array<{
      date: string;
      equity: number;
      cumPnL: number;
      drawdown: number;
    }> = [];

    let equity = result.initialCapital;
    let peak = result.initialCapital;

    for (const trade of result.trades) {
      equity += trade.pnl;
      if (equity > peak) peak = equity;
      const drawdown = ((peak - equity) / peak) * 100;

      data.push({
        date: new Date(trade.exitDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        equity: Math.round(equity),
        cumPnL: Math.round(equity - result.initialCapital),
        drawdown: Math.max(0, drawdown),
      });
    }

    return data;
  }, [result]);

  const profitColor = result.totalPnL >= 0 ? "#10b981" : "#ef4444";
  const drawdownColor = "#f59e0b";

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-2">Total P&L</p>
            <p
              className={cn(
                "text-2xl font-bold font-mono-nums",
                result.totalPnL >= 0 ? "text-profit" : "text-loss"
              )}
            >
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

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Equity Curve */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-medium tracking-tight">Equity Curve</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(value: any) => `$${value.toLocaleString()}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke={profitColor}
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Drawdown Chart */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-medium tracking-tight">Drawdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(value: any) => `${value.toFixed(2)}%`}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdown"
                    fill={drawdownColor}
                    stroke={drawdownColor}
                    fillOpacity={0.3}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cumulative P&L */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-medium tracking-tight">Cumulative P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.5)"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(value: any) => `$${value.toLocaleString()}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumPnL"
                    fill={profitColor}
                    stroke={profitColor}
                    fillOpacity={0.2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trade History */}
      <Card className="bg-card/50 backdrop-blur-md border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-medium tracking-tight">Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          {result.trades.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No trades generated in backtest</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead>Entry Date</TableHead>
                    <TableHead className="text-right">Entry Price</TableHead>
                    <TableHead className="text-right">Exit Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">P&L %</TableHead>
                    <TableHead className="text-right">R:R</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.trades.map((trade: any, i: number) => (
                    <TableRow key={i} className="hover:bg-white/5 border-border/40">
                      <TableCell className="text-sm">
                        {new Date(trade.entryDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-mono-nums text-sm">
                        ${trade.entryPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono-nums text-sm">
                        ${trade.exitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono-nums text-sm">
                        {trade.quantity.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono-nums text-sm font-medium",
                          trade.pnl >= 0 ? "text-profit" : "text-loss"
                        )}
                      >
                        ${trade.pnl.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono-nums text-sm",
                          trade.pnlPercent >= 0 ? "text-profit" : "text-loss"
                        )}
                      >
                        {trade.pnlPercent.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-mono-nums text-sm">
                        <Badge variant={trade.riskReward > 2 ? "default" : "secondary"}>
                          {trade.riskReward.toFixed(2)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
