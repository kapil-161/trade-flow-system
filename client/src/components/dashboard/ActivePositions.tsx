import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assets, Asset } from "@/lib/mockData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bitcoin, CircleDollarSign } from "lucide-react";

export function ActivePositions() {
  return (
    <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-md border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-medium tracking-tight">Active Positions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="w-[100px]">Asset</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Holdings</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">P&L</TableHead>
              <TableHead className="text-right">Allocation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => {
              const value = asset.quantity * asset.currentPrice;
              const cost = asset.quantity * asset.avgPrice;
              const pnl = value - cost;
              const pnlPercent = (pnl / cost) * 100;

              return (
                <TableRow key={asset.symbol} className="hover:bg-white/5 border-border/40 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center bg-secondary/50 border border-border/50",
                        asset.type === "crypto" ? "text-orange-400" : "text-blue-400"
                      )}>
                        {asset.type === "crypto" ? <Bitcoin className="h-4 w-4" /> : <CircleDollarSign className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="font-bold">{asset.symbol}</div>
                        <div className="text-xs text-muted-foreground">{asset.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono-nums">
                    ${asset.currentPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono-nums">
                    {asset.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono-nums font-medium">
                    ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={cn("font-mono-nums font-medium", pnl >= 0 ? "text-profit" : "text-loss")}>
                      {pnl >= 0 ? "+" : ""}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className={cn("text-xs", pnl >= 0 ? "text-profit/70" : "text-loss/70")}>
                      {pnlPercent.toFixed(2)}%
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs font-mono-nums text-muted-foreground">{asset.allocation}%</span>
                      <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${asset.allocation}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
