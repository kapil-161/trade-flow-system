import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Package,
  History,
  Star,
  StarOff,
  Plus,
  LineChart,
  BarChart3,
  Info,
} from "lucide-react";
import { useQuote, useHistoricalData, useHoldings, useTrades, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { OrderDialog } from "./OrderDialog";
import { useRealtimeQuote } from "@/lib/websocket";

interface StockSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockSearchDialog({ open, onOpenChange }: StockSearchDialogProps) {
  const [searchSymbol, setSearchSymbol] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch data for selected symbol
  const { data: quote, isLoading: quoteLoading } = useQuote(selectedSymbol || "");
  const realtimeQuote = useRealtimeQuote(selectedSymbol);
  const displayQuote = realtimeQuote || quote;
  
  const { data: historicalData } = useHistoricalData(selectedSymbol || "", "3mo", "1d");
  const { data: holdings = [] } = useHoldings();
  const { data: trades = [] } = useTrades();
  const { data: watchlist = [] } = useWatchlist();
  
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const userHolding = holdings.find(h => h.symbol === selectedSymbol);
  const userTrades = trades.filter(t => t.symbol === selectedSymbol);
  const isInWatchlist = watchlist.some(w => w.symbol === selectedSymbol);

  const handleSearch = () => {
    if (!searchSymbol.trim()) {
      toast({
        title: "Please enter a symbol",
        variant: "destructive",
      });
      return;
    }
    setSelectedSymbol(searchSymbol.trim().toUpperCase());
  };

  const handleAddToWatchlist = async () => {
    if (!selectedSymbol || !displayQuote) return;
    
    try {
      await addToWatchlist.mutateAsync({
        symbol: selectedSymbol,
        name: displayQuote.name,
        type: selectedSymbol.match(/^(BTC|ETH|SOL|DOGE|ADA|XRP|DOT|MATIC|LINK|UNI|AAVE|AVAX|ATOM|ALGO|VET|FIL|XLM|NEAR|APT|ARB|OP)/) ? "crypto" : "stock",
      });
      toast({
        title: "Added to watchlist",
        description: `${selectedSymbol} has been added to your watchlist.`,
      });
    } catch (error) {
      toast({
        title: "Failed to add to watchlist",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFromWatchlist = async () => {
    if (!selectedSymbol) return;
    
    const watchlistItem = watchlist.find(w => w.symbol === selectedSymbol);
    if (!watchlistItem) return;

    try {
      await removeFromWatchlist.mutateAsync(watchlistItem.id);
      toast({
        title: "Removed from watchlist",
        description: `${selectedSymbol} has been removed from your watchlist.`,
      });
    } catch (error) {
      toast({
        title: "Failed to remove from watchlist",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!open) {
      setSearchSymbol("");
      setSelectedSymbol(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Stock Search & Analysis
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter symbol (e.g., AAPL, BTC-USD, TSLA)"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={!searchSymbol.trim()}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        {selectedSymbol && (
          <>
            {quoteLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : displayQuote ? (
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="holdings">Holdings</TabsTrigger>
                  <TabsTrigger value="trades">Trade History</TabsTrigger>
                  <TabsTrigger value="chart">Chart</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Quote Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-2xl">{displayQuote.symbol}</CardTitle>
                          <p className="text-muted-foreground">{displayQuote.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isInWatchlist ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRemoveFromWatchlist}
                            >
                              <Star className="h-4 w-4 mr-2 fill-yellow-500 text-yellow-500" />
                              In Watchlist
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleAddToWatchlist}
                            >
                              <StarOff className="h-4 w-4 mr-2" />
                              Add to Watchlist
                            </Button>
                          )}
                          <OrderDialog>
                            <Button size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              Place Order
                            </Button>
                          </OrderDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Price</p>
                          <p className="text-2xl font-bold font-mono-nums">
                            ${displayQuote.price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Change</p>
                          <div className={cn(
                            "text-xl font-bold font-mono-nums flex items-center gap-1",
                            displayQuote.change >= 0 ? "text-profit" : "text-loss"
                          )}>
                            {displayQuote.change >= 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <TrendingDown className="h-4 w-4" />
                            )}
                            {displayQuote.change >= 0 ? "+" : ""}
                            ${displayQuote.change.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Change %</p>
                          <div className={cn(
                            "text-xl font-bold font-mono-nums",
                            displayQuote.changePercent >= 0 ? "text-profit" : "text-loss"
                          )}>
                            {displayQuote.changePercent >= 0 ? "+" : ""}
                            {displayQuote.changePercent.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Volume</p>
                          <p className="text-xl font-bold font-mono-nums">
                            {displayQuote.volume.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {displayQuote.marketCap && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">Market Cap</p>
                          <p className="text-lg font-semibold font-mono-nums">
                            ${(displayQuote.marketCap / 1e9).toFixed(2)}B
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* User Position Summary */}
                  {userHolding && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          Your Position
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Quantity</p>
                            <p className="text-lg font-bold font-mono-nums">
                              {parseFloat(userHolding.quantity).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 8,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Avg Price</p>
                            <p className="text-lg font-bold font-mono-nums">
                              ${parseFloat(userHolding.avgPrice).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Current Value</p>
                            <p className="text-lg font-bold font-mono-nums">
                              ${(parseFloat(userHolding.quantity) * displayQuote.price).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">P&L</p>
                            <p className={cn(
                              "text-lg font-bold font-mono-nums",
                              (displayQuote.price - parseFloat(userHolding.avgPrice)) * parseFloat(userHolding.quantity) >= 0
                                ? "text-profit"
                                : "text-loss"
                            )}>
                              {((displayQuote.price - parseFloat(userHolding.avgPrice)) * parseFloat(userHolding.quantity) >= 0 ? "+" : "")}
                              ${((displayQuote.price - parseFloat(userHolding.avgPrice)) * parseFloat(userHolding.quantity)).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Trade Count
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{userTrades.length}</p>
                        <p className="text-xs text-muted-foreground">Total trades</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Previous Close
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold font-mono-nums">
                          ${displayQuote.previousClose.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Type
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge variant={userHolding?.type === "crypto" ? "default" : "secondary"}>
                          {userHolding?.type || (selectedSymbol?.match(/^(BTC|ETH|SOL|DOGE|ADA|XRP|DOT|MATIC|LINK|UNI|AAVE|AVAX|ATOM|ALGO|VET|FIL|XLM|NEAR|APT|ARB|OP)/) ? "Crypto" : "Stock")}
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Holdings Tab */}
                <TabsContent value="holdings" className="mt-4">
                  {userHolding ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>Your Holdings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Symbol</p>
                              <p className="text-lg font-semibold">{userHolding.symbol}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Name</p>
                              <p className="text-lg font-semibold">{userHolding.name}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Quantity</p>
                              <p className="text-lg font-semibold font-mono-nums">
                                {parseFloat(userHolding.quantity).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 8,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Average Price</p>
                              <p className="text-lg font-semibold font-mono-nums">
                                ${parseFloat(userHolding.avgPrice).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Current Price</p>
                              <p className="text-lg font-semibold font-mono-nums text-profit">
                                ${displayQuote.price.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Total Value</p>
                              <p className="text-lg font-semibold font-mono-nums">
                                ${(parseFloat(userHolding.quantity) * displayQuote.price).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          </div>
                          <Separator />
                          <div>
                            <p className="text-sm text-muted-foreground">Unrealized P&L</p>
                            <p className={cn(
                              "text-2xl font-bold font-mono-nums",
                              (displayQuote.price - parseFloat(userHolding.avgPrice)) * parseFloat(userHolding.quantity) >= 0
                                ? "text-profit"
                                : "text-loss"
                            )}>
                              {((displayQuote.price - parseFloat(userHolding.avgPrice)) * parseFloat(userHolding.quantity) >= 0 ? "+" : "")}
                              ${((displayQuote.price - parseFloat(userHolding.avgPrice)) * parseFloat(userHolding.quantity)).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p className={cn(
                              "text-sm font-mono-nums",
                              ((displayQuote.price - parseFloat(userHolding.avgPrice)) / parseFloat(userHolding.avgPrice)) * 100 >= 0
                                ? "text-profit"
                                : "text-loss"
                            )}>
                              {(((displayQuote.price - parseFloat(userHolding.avgPrice)) / parseFloat(userHolding.avgPrice)) * 100 >= 0 ? "+" : "")}
                              {(((displayQuote.price - parseFloat(userHolding.avgPrice)) / parseFloat(userHolding.avgPrice)) * 100).toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">You don't have any holdings in {selectedSymbol}</p>
                        <OrderDialog>
                          <Button className="mt-4">
                            <Plus className="h-4 w-4 mr-2" />
                            Place Order
                          </Button>
                        </OrderDialog>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Trade History Tab */}
                <TabsContent value="trades" className="mt-4">
                  {userTrades.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-5 w-5" />
                          Trade History ({userTrades.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {userTrades.map((trade) => (
                            <div
                              key={trade.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                            >
                              <div className="flex items-center gap-4">
                                <Badge variant={trade.side === "buy" ? "default" : "destructive"}>
                                  {trade.side.toUpperCase()}
                                </Badge>
                                <div>
                                  <p className="font-semibold font-mono-nums">
                                    {parseFloat(trade.quantity).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 8,
                                    })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    @ ${parseFloat(trade.price).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold font-mono-nums">
                                  ${parseFloat(trade.totalValue).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(trade.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No trade history for {selectedSymbol}</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Chart Tab */}
                <TabsContent value="chart" className="mt-4">
                  {historicalData && historicalData.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <LineChart className="h-5 w-5" />
                          3-Month Price Chart
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64 flex items-center justify-center">
                          <div className="text-center">
                            <LineChart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">
                              Chart visualization coming soon
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">
                              {historicalData.length} data points available
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <LineChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No historical data available</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Symbol not found. Please check the symbol and try again.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
