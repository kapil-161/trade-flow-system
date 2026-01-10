import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Bitcoin, CircleDollarSign, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { useHoldings, useMultiQuotes, useUpdateHolding, useDeleteHolding } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Holding } from "@shared/schema";

export function ActivePositions() {
  const { data: holdings = [], isLoading: holdingsLoading } = useHoldings();
  const symbols = holdings.map(h => h.symbol);
  const { data: quotes = [], isLoading: quotesLoading } = useMultiQuotes(symbols);
  const updateHolding = useUpdateHolding();
  const deleteHolding = useDeleteHolding();
  const { toast } = useToast();
  
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editAvgPrice, setEditAvgPrice] = useState("");

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

  const handleEdit = (holding: Holding) => {
    setEditingHolding(holding);
    setEditQuantity(holding.quantity);
    setEditAvgPrice(holding.avgPrice);
  };

  const handleSaveEdit = async () => {
    if (!editingHolding) return;
    try {
      await updateHolding.mutateAsync({
        id: editingHolding.id,
        data: {
          quantity: editQuantity,
          avgPrice: editAvgPrice,
        }
      });
      toast({ title: "Position Updated", description: `Updated ${editingHolding.symbol} successfully.` });
      setEditingHolding(null);
    } catch (err) {
      toast({ title: "Update Failed", description: "Failed to update holding.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    if (confirm(`Are you sure you want to remove ${symbol} from your portfolio?`)) {
      try {
        await deleteHolding.mutateAsync(id);
        toast({ title: "Position Removed", description: `Removed ${symbol} successfully.` });
      } catch (err) {
        toast({ title: "Delete Failed", description: "Failed to remove holding.", variant: "destructive" });
      }
    }
  };

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-md border-border/50" data-testid="card-active-positions">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
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
                <TableHead className="w-[50px]"></TableHead>
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
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-holding-actions-${holding.symbol}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(holding)} className="gap-2" data-testid={`menu-edit-${holding.symbol}`}>
                            <Edit2 className="h-4 w-4" /> Edit Position
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(holding.id, holding.symbol)} 
                            className="gap-2 text-loss focus:text-loss"
                            data-testid={`menu-delete-${holding.symbol}`}
                          >
                            <Trash2 className="h-4 w-4" /> Remove Position
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!editingHolding} onOpenChange={(open) => !open && setEditingHolding(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit {editingHolding?.symbol} Position</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-quantity">Quantity</Label>
              <Input
                id="edit-quantity"
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                data-testid="input-edit-quantity"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-price">Average Price</Label>
              <Input
                id="edit-price"
                type="number"
                value={editAvgPrice}
                onChange={(e) => setEditAvgPrice(e.target.value)}
                data-testid="input-edit-price"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingHolding(null)} data-testid="button-cancel-edit">Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateHolding.isPending} data-testid="button-save-edit">
              {updateHolding.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
