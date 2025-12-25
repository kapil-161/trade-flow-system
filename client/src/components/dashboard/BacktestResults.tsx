import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { BacktestResult } from "@shared/schema";

interface BacktestResultsProps {
  result: BacktestResult;
}

export function BacktestResults({ result }: BacktestResultsProps) {
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
                      <TableCell className={cn("text-right font-mono-nums text-sm font-medium", 
                        trade.pnl >= 0 ? "text-profit" : "text-loss")}>
                        ${trade.pnl.toFixed(2)}
                      </TableCell>
                      <TableCell className={cn("text-right font-mono-nums text-sm",
                        trade.pnlPercent >= 0 ? "text-profit" : "text-loss")}>
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
