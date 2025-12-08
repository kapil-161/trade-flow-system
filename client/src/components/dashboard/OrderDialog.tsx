import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderDialogProps {
  children: React.ReactNode;
}

export function OrderDialog({ children }: OrderDialogProps) {
  const [orderType, setOrderType] = useState("limit");
  const [side, setSide] = useState("buy");

  return (
    <Dialog>
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
            <TabsTrigger value="buy" className="data-[state=active]:bg-profit data-[state=active]:text-white">Buy</TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-loss data-[state=active]:text-white">Sell</TabsTrigger>
          </TabsList>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset</Label>
                <Select defaultValue="BTC">
                  <SelectTrigger>
                    <SelectValue placeholder="Symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                    <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                    <SelectItem value="SOL">Solana (SOL)</SelectItem>
                    <SelectItem value="NVDA">NVIDIA (NVDA)</SelectItem>
                    <SelectItem value="TSLA">Tesla (TSLA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger>
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
                <Input type="number" placeholder="0.00" className="pr-12 font-mono-nums" />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">BTC</span>
              </div>
            </div>

            {orderType !== "market" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input type="number" placeholder="0.00" className="pl-7 font-mono-nums" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Leverage</Label>
                <span className="text-muted-foreground">1x</span>
              </div>
              <Slider defaultValue={[1]} max={10} step={1} className="py-2" />
            </div>

            <div className="pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-mono-nums flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  $45,250.00
                </span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Estimated Total</span>
                <span className="font-mono-nums">$0.00</span>
              </div>
            </div>

            <Button 
              className={cn(
                "w-full mt-4 font-bold shadow-lg transition-all hover:scale-[1.02]", 
                side === "buy" 
                  ? "bg-profit hover:bg-profit/90 shadow-profit/20" 
                  : "bg-loss hover:bg-loss/90 shadow-loss/20"
              )}
            >
              {side === "buy" ? "Place Buy Order" : "Place Sell Order"}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
