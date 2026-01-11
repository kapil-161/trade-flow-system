import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrades } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function History() {
  const { data: trades = [], isLoading } = useTrades();

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 pb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trade History</h1>
          <p className="text-muted-foreground">Detailed log of all your past transactions.</p>
        </div>

        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No trades recorded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead>Date</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((trade) => (
                    <TableRow key={trade.id} className="border-border/40 hover:bg-white/5 transition-colors">
                      <TableCell className="text-muted-foreground">
                        {format(new Date(trade.createdAt || new Date()), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="font-bold">{trade.symbol}</TableCell>
                      <TableCell>
                        <Badge 
                          className={cn(
                            "uppercase text-[10px] font-bold",
                            trade.side === "buy" ? "bg-profit/20 text-profit border-profit/20" : "bg-loss/20 text-loss border-loss/20"
                          )}
                          variant="outline"
                        >
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono-nums">${parseFloat(trade.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono-nums">{parseFloat(trade.quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono-nums font-medium">${parseFloat(trade.totalValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-white/5 text-[10px] uppercase">
                          {trade.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
