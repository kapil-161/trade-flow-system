import { useState, useEffect, useMemo } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp } from "lucide-react";
import { POPULAR_SYMBOLS, ALL_SYMBOLS, SYMBOL_NAMES } from "@shared/constants";
import { useLocation } from "wouter";

interface BacktestFormProps {
  onSuccess: (result: any) => void;
}

export function BacktestForm({ onSuccess }: BacktestFormProps) {
  const [location] = useLocation();
  
  // Initialize symbol from URL query params or default
  const getInitialSymbol = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("symbol") || "BTC-USD";
  };
  
  const [symbol, setSymbol] = useState(getInitialSymbol);
  
  // Handle symbol from URL query params when location changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const symbolParam = params.get("symbol");
    if (symbolParam && symbolParam !== symbol) {
      setSymbol(symbolParam);
    }
  }, [location]);

  const [range, setRange] = useState("3mo");
  const [initialCapital, setInitialCapital] = useState("10000");
  const [showStrategy, setShowStrategy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [strategy, setStrategy] = useState({
    emaFast: 21,
    emaSlow: 50,
    rsiLower: 45,
    rsiUpper: 65,
    scoreThreshold: 7,
    atrMultiplier: 2.0,
    tpMultiplier: 4.0,
    trendFilter: true,
    volatilityFilter: true,
  });

  const { toast } = useToast();

  // Create symbol options list that includes current symbol if not in popular list
  const symbolOptions = useMemo(() => {
    const options = [...POPULAR_SYMBOLS];
    // Add current symbol if it's not already in the list
    if (symbol && !ALL_SYMBOLS.includes(symbol)) {
      options.unshift({
        label: SYMBOL_NAMES[symbol] || symbol,
        value: symbol
      });
    }
    return options;
  }, [symbol]);

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
          strategy,
        }),
      });

      if (!response.ok) throw new Error("Backtest failed");
      const result = await response.json();
      
      onSuccess(result);
      toast({
        title: "Backtest Complete",
        description: `${result.winningTrades} wins, ${result.losingTrades} losses • ${result.totalPnLPercent.toFixed(2)}% return`,
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
          {/* Basic Settings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger data-testid="select-symbol">
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <ScrollArea className="h-[280px] w-full">
                    {symbolOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label} ({s.value})
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Timeframe</Label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger data-testid="select-range">
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
                data-testid="input-capital"
              />
            </div>
          </div>

          {/* Strategy Config Toggle */}
          <button
            type="button"
            onClick={() => setShowStrategy(!showStrategy)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            data-testid="button-toggle-strategy"
          >
            {showStrategy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Advanced Strategy Settings
          </button>

          {/* Strategy Parameters */}
          {showStrategy && (
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="grid grid-cols-2 gap-6">
                {/* EMA Settings */}
                <div>
                  <Label className="text-xs mb-2 block">Fast EMA: <span className="text-primary">{strategy.emaFast}</span></Label>
                  <Slider
                    value={[strategy.emaFast]}
                    onValueChange={(v) => setStrategy({...strategy, emaFast: v[0]})}
                    min={5}
                    max={50}
                    step={1}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Slow EMA: <span className="text-primary">{strategy.emaSlow}</span></Label>
                  <Slider
                    value={[strategy.emaSlow]}
                    onValueChange={(v) => setStrategy({...strategy, emaSlow: v[0]})}
                    min={20}
                    max={200}
                    step={5}
                  />
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/10">
                  <Label className="text-xs">200 EMA Trend Filter</Label>
                  <Switch 
                    checked={strategy.trendFilter} 
                    onCheckedChange={(v) => setStrategy({...strategy, trendFilter: v})} 
                  />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/10">
                  <Label className="text-xs">Volatility Filter (ATR)</Label>
                  <Switch 
                    checked={strategy.volatilityFilter} 
                    onCheckedChange={(v) => setStrategy({...strategy, volatilityFilter: v})} 
                  />
                </div>

                {/* Risk Management */}
                <div>
                  <Label className="text-xs mb-2 block">Stop Loss (ATR x): <span className="text-primary">{strategy.atrMultiplier.toFixed(1)}</span></Label>
                  <Slider
                    value={[strategy.atrMultiplier]}
                    onValueChange={(v) => setStrategy({...strategy, atrMultiplier: v[0]})}
                    min={1}
                    max={4}
                    step={0.1}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Take Profit (ATR x): <span className="text-primary">{strategy.tpMultiplier.toFixed(1)}</span></Label>
                  <Slider
                    value={[strategy.tpMultiplier]}
                    onValueChange={(v) => setStrategy({...strategy, tpMultiplier: v[0]})}
                    min={2}
                    max={8}
                    step={0.1}
                  />
                </div>
              </div>

              <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-200">
                🚀 <strong>Improvement Tip:</strong> Enabling the <strong>200 EMA Filter</strong> ensures you only trade with the major trend, which significantly reduces losses in choppy markets.
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full"
            data-testid="button-run-backtest"
          >
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {isLoading ? "Optimizing Strategy..." : "Run Backtest"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
