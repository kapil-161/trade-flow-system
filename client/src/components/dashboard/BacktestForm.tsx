import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";

interface BacktestFormProps {
  onSuccess: (result: any) => void;
}

export function BacktestForm({ onSuccess }: BacktestFormProps) {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [range, setRange] = useState("3mo");
  const [initialCapital, setInitialCapital] = useState("10000");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/backtest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          range,
          initialCapital: parseFloat(initialCapital),
        }),
      });

      if (!response.ok) throw new Error("Backtest failed");
      const result = await response.json();
      
      onSuccess(result);
      toast({
        title: "Backtest Complete",
        description: `${result.winningTrades} wins, ${result.losingTrades} losses`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run backtest",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-md border-border/50">
      <CardHeader>
        <CardTitle>Strategy Backtest</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Symbol</Label>
              <Input 
                value={symbol} 
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="BTC-USD"
              />
            </div>
            <div>
              <Label className="text-xs">Timeframe</Label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1mo">1 Month</SelectItem>
                  <SelectItem value="3mo">3 Months</SelectItem>
                  <SelectItem value="6mo">6 Months</SelectItem>
                  <SelectItem value="1y">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Initial Capital</Label>
              <Input 
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                placeholder="10000"
              />
            </div>
          </div>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {isLoading ? "Running..." : "Run Backtest"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
