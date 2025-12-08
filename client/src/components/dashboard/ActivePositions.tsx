import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Bitcoin, CircleDollarSign } from "lucide-react";
import { useHoldings, useMultiQuotes } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export function ActivePositions() {
  const { data: holdings = [], isLoading: holdingsLoading } = useHoldings();
  const symbols = holdings.map(h => h.symbol);
  const { data: quotes = [], isLoading: quotesLoading } = useMultiQuotes(symbols);

  const isLoading = holdingsLoading || quotesLoading;

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-md border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-medium tracking-tight">Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const priceMap = Object.fromEntries(quotes.map(q => [q.symbol, q.price]));

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-md border-border/50" data-testid="card-active-positions">
      <CardHeader>
        <CardTitle className="text-lg font-medium tracking-tight">Active Positions</CardTitle>
      </CardHeader>
      <CardContent>
        {holdings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No positions yet. Place your first trade to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/40">
                <TableHead className="w-[100px]">Asset</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Holdings</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">Avg Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((holding) => {
                const currentPrice = priceMap[holding.symbol] || 0;
                const quantity = parseFloat(holding.quantity);
                const avgPrice = parseFloat(holding.avgPrice);
                const value = quantity * currentPrice;
                const cost = quantity * avgPrice;
                const pnl = value - cost;
                const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

                return (
                  <TableRow key={holding.id} className="hover:bg-white/5 border-border/40 transition-colors" data-testid={`row-holding-${holding.symbol}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center bg-secondary/50 border border-border/50",
                          holding.type === "crypto" ? "text-orange-400" : "text-blue-400"
                        )}>
                          {holding.type === "crypto" ? <Bitcoin className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-bold" data-testid={`text-symbol-${holding.symbol}`}>{holding.symbol}</div>
                          <div className="text-xs text-muted-foreground" data-testid={`text-name-${holding.symbol}`}>{holding.name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono-nums" data-testid={`text-price-${holding.symbol}`}>
                      ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono-nums" data-testid={`text-quantity-${holding.symbol}`}>
                      {quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                    </TableCell>
                    <TableCell className="text-right font-mono-nums font-medium" data-testid={`text-value-${holding.symbol}`}>
                      ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={cn("font-mono-nums font-medium", pnl >= 0 ? "text-profit" : "text-loss")} data-testid={`text-pnl-${holding.symbol}`}>
                        {pnl >= 0 ? "+" : ""}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className={cn("text-xs", pnl >= 0 ? "text-profit/70" : "text-loss/70")}>
                        {pnlPercent.toFixed(2)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono-nums text-muted-foreground text-sm" data-testid={`text-avgprice-${holding.symbol}`}>
                      ${avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
