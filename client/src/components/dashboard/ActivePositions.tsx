import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MoreVertical, Edit2, Trash2, Trash } from "lucide-react";
import { useHoldings, useMultiQuotes, useUpdateHolding, useDeleteHolding, useDeleteAllHoldings } from "@/lib/api";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  const deleteAllHoldings = useDeleteAllHoldings();
  const { toast } = useToast();
  
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editAvgPrice, setEditAvgPrice] = useState("");
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

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

  // Group holdings by type
  const cryptoHoldings = holdings.filter(h => h.type === "crypto");
  const stockHoldings = holdings.filter(h => h.type === "stock");

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

  const handleDeleteAll = async () => {
    try {
      const result = await deleteAllHoldings.mutateAsync();
      toast({ 
        title: "All Holdings Deleted", 
        description: `Successfully removed ${result.deletedCount || holdings.length} position(s) from your portfolio.` 
      });
      setShowDeleteAllDialog(false);
    } catch (err) {
      toast({ title: "Delete Failed", description: "Failed to delete all holdings.", variant: "destructive" });
    }
  };

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-md border-border/50" data-testid="card-active-positions">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg font-medium tracking-tight">Active Positions</CardTitle>
        {holdings.length > 0 && (
          <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm"
                className="gap-2"
                data-testid="button-delete-all-holdings"
              >
                <Trash className="h-4 w-4" />
                Delete All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Holdings?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {holdings.length} position(s) from your portfolio. 
                  This action cannot be undone. Are you sure you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAll}
                  disabled={deleteAllHoldings.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteAllHoldings.isPending ? "Deleting..." : "Delete All"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardHeader>
      <CardContent>
        {holdings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No positions yet. Place your first trade to get started.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Cryptocurrencies Section */}
            {cryptoHoldings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Cryptocurrencies</h3>
                <div className="space-y-3">
                  {cryptoHoldings.map((holding) => {
                    const currentPrice = priceMap[holding.symbol] || 0;
                    const quantity = parseFloat(holding.quantity);
                    const avgPrice = parseFloat(holding.avgPrice);
                    const value = quantity * currentPrice;
                    const cost = quantity * avgPrice;
                    const pnl = value - cost;
                    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

                    return (
                      <div 
                        key={holding.id} 
                        className="flex items-center justify-between py-2 border-b border-border/40 group hover:bg-white/5 transition-colors"
                        data-testid={`row-holding-${holding.symbol}`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="font-semibold text-base" data-testid={`text-symbol-${holding.symbol}`}>
                            {holding.symbol}
                          </div>
                          <div className="text-sm text-muted-foreground font-mono-nums">
                            {quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-holding-actions-${holding.symbol}`}>
                                <MoreVertical className="h-3 w-3" />
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
                        </div>
                        <div className="flex items-center gap-6">
                          <div className={cn("font-mono-nums text-sm", pnl >= 0 ? "text-profit" : "text-loss")} data-testid={`text-pnl-${holding.symbol}`}>
                            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                          </div>
                          <div className={cn("font-mono-nums text-sm w-16 text-right", pnl >= 0 ? "text-profit" : "text-loss")}>
                            {pnl >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stocks Section */}
            {stockHoldings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Stocks</h3>
                <div className="space-y-3">
                  {stockHoldings.map((holding) => {
                    const currentPrice = priceMap[holding.symbol] || 0;
                    const quantity = parseFloat(holding.quantity);
                    const avgPrice = parseFloat(holding.avgPrice);
                    const value = quantity * currentPrice;
                    const cost = quantity * avgPrice;
                    const pnl = value - cost;
                    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;

                    return (
                      <div 
                        key={holding.id} 
                        className="flex items-center justify-between py-2 border-b border-border/40 group hover:bg-white/5 transition-colors"
                        data-testid={`row-holding-${holding.symbol}`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="font-semibold text-base" data-testid={`text-symbol-${holding.symbol}`}>
                            {holding.symbol}
                          </div>
                          <div className="text-sm text-muted-foreground font-mono-nums">
                            {quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} shares
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-holding-actions-${holding.symbol}`}>
                                <MoreVertical className="h-3 w-3" />
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
                        </div>
                        <div className="flex items-center gap-6">
                          <div className={cn("font-mono-nums text-sm", pnl >= 0 ? "text-profit" : "text-loss")} data-testid={`text-pnl-${holding.symbol}`}>
                            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                          </div>
                          <div className={cn("font-mono-nums text-sm w-16 text-right", pnl >= 0 ? "text-profit" : "text-loss")}>
                            {pnl >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
