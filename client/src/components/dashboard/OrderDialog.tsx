import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateTrade, usePortfolioStats } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { POPULAR_SYMBOLS } from "@shared/constants";

interface OrderDialogProps {
  children: React.ReactNode;
}

export function OrderDialog({ children }: OrderDialogProps) {
  const [orderType, setOrderType] = useState("limit");
  const [side, setSide] = useState("buy");
  const [symbol, setSymbol] = useState("BTC");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [open, setOpen] = useState(false);
  
  const { data: stats } = usePortfolioStats();
  const createTrade = useCreateTrade();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!quantity || (orderType !== "market" && !price)) {
      toast({
        title: "Invalid Order",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const tradePrice = orderType === "market" ? 0 : parseFloat(price);
    const tradeQuantity = parseFloat(quantity);

    try {
      await createTrade.mutateAsync({
        symbol,
        side: side as "buy" | "sell",
        quantity: tradeQuantity.toString(),
        price: tradePrice.toFixed(2),
        totalValue: (tradeQuantity * tradePrice).toFixed(2),
        fees: "0",
        status: orderType === "market" ? "filled" : "pending",
      });

      toast({
        title: "Order Placed",
        description: `${side === "buy" ? "Bought" : "Sold"} ${quantity} ${symbol}`,
      });

      // Reset form and close dialog
      setQuantity("");
      setPrice("");
      setOpen(false);
    } catch (error) {
      toast({
        title: "Order Failed",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    }
  };

  const estimatedTotal = quantity && price ? (parseFloat(quantity) * parseFloat(price)).toFixed(2) : "0.00";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border/50 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">New Order</DialogTitle>
          <DialogDescription>
            Execute a trade across supported exchanges.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="buy" className="w-full mt-4" onValueChange={(v) => setSide(v)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="buy" className="data-[state=active]:bg-profit data-[state=active]:text-white" data-testid="tab-buy">Buy</TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-loss data-[state=active]:text-white" data-testid="tab-sell">Sell</TabsTrigger>
          </TabsList>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset</Label>
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger data-testid="select-symbol">
                    <SelectValue placeholder="Symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    {POPULAR_SYMBOLS.map((s) => (
                      <SelectItem key={s.value} value={s.value.split("-")[0]}>
                        {s.label} ({s.value.split("-")[0]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger data-testid="select-order-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="limit">Limit</SelectItem>
                    <SelectItem value="stop">Stop Loss</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="pr-12 font-mono-nums" 
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">{symbol}</span>
              </div>
            </div>

            {orderType !== "market" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-7 font-mono-nums"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    data-testid="input-price"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-mono-nums flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  ${stats?.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Estimated Total</span>
                <span className="font-mono-nums" data-testid="text-estimated-total">${estimatedTotal}</span>
              </div>
            </div>

            <Button 
              className={cn(
                "w-full mt-4 font-bold shadow-lg transition-all hover:scale-[1.02]", 
                side === "buy" 
                  ? "bg-profit hover:bg-profit/90 shadow-profit/20" 
                  : "bg-loss hover:bg-loss/90 shadow-loss/20"
              )}
              onClick={handleSubmit}
              disabled={createTrade.isPending}
              data-testid="button-place-order"
            >
              {createTrade.isPending ? "Placing..." : side === "buy" ? "Place Buy Order" : "Place Sell Order"}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
