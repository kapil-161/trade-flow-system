import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp } from "lucide-react";

interface BacktestFormProps {
  onSuccess: (result: any) => void;
}

interface StrategyConfig {
  emaFast: number;
  emaSlow: number;
  rsiLower: number;
  rsiUpper: number;
  scoreThreshold: number;
  atrMultiplier: number;
  tpMultiplier: number;
}

const POPULAR_SYMBOLS = [
  { label: "Bitcoin", value: "BTC-USD" },
  { label: "Ethereum", value: "ETH-USD" },
  { label: "Apple", value: "AAPL" },
  { label: "Microsoft", value: "MSFT" },
  { label: "Tesla", value: "TSLA" },
  { label: "Amazon", value: "AMZN" },
  { label: "Google", value: "GOOGL" },
  { label: "Meta", value: "META" },
  { label: "NVIDIA", value: "NVDA" },
  { label: "S&P 500", value: "^GSPC" },
  { label: "Nasdaq 100", value: "^NDX" },
];

export function BacktestForm({ onSuccess }: BacktestFormProps) {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [range, setRange] = useState("3mo");
  const [initialCapital, setInitialCapital] = useState("10000");
  const [showStrategy, setShowStrategy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [strategy, setStrategy] = useState<StrategyConfig>({
    emaFast: 21,
    emaSlow: 50,
    rsiLower: 45,
    rsiUpper: 65,
    scoreThreshold: 7,
    atrMultiplier: 1.5,
    tpMultiplier: 3,
  });

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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POPULAR_SYMBOLS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label} ({s.value})
                    </SelectItem>
                  ))}
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
            Customize Strategy Parameters
          </button>

          {/* Strategy Parameters */}
          {showStrategy && (
            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="grid grid-cols-2 gap-4">
                {/* EMA Settings */}
                <div>
                  <Label className="text-xs mb-2 block">Fast EMA: <span className="text-primary">{strategy.emaFast}</span></Label>
                  <Slider
                    value={[strategy.emaFast]}
                    onValueChange={(v) => setStrategy({...strategy, emaFast: v[0]})}
                    min={5}
                    max={50}
                    step={1}
                    data-testid="slider-ema-fast"
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
                    data-testid="slider-ema-slow"
                  />
                </div>

                {/* RSI Settings */}
                <div>
                  <Label className="text-xs mb-2 block">RSI Lower: <span className="text-primary">{strategy.rsiLower}</span></Label>
                  <Slider
                    value={[strategy.rsiLower]}
                    onValueChange={(v) => setStrategy({...strategy, rsiLower: v[0]})}
                    min={20}
                    max={50}
                    step={1}
                    data-testid="slider-rsi-lower"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">RSI Upper: <span className="text-primary">{strategy.rsiUpper}</span></Label>
                  <Slider
                    value={[strategy.rsiUpper]}
                    onValueChange={(v) => setStrategy({...strategy, rsiUpper: v[0]})}
                    min={50}
                    max={80}
                    step={1}
                    data-testid="slider-rsi-upper"
                  />
                </div>

                {/* Score Threshold */}
                <div>
                  <Label className="text-xs mb-2 block">Entry Score: <span className="text-primary">{strategy.scoreThreshold}</span></Label>
                  <Slider
                    value={[strategy.scoreThreshold]}
                    onValueChange={(v) => setStrategy({...strategy, scoreThreshold: v[0]})}
                    min={3}
                    max={10}
                    step={0.5}
                    data-testid="slider-score"
                  />
                </div>

                {/* ATR Multiplier */}
                <div>
                  <Label className="text-xs mb-2 block">ATR Multiplier: <span className="text-primary">{strategy.atrMultiplier.toFixed(1)}x</span></Label>
                  <Slider
                    value={[strategy.atrMultiplier]}
                    onValueChange={(v) => setStrategy({...strategy, atrMultiplier: v[0]})}
                    min={0.5}
                    max={3}
                    step={0.1}
                    data-testid="slider-atr"
                  />
                </div>

                {/* TP Multiplier */}
                <div>
                  <Label className="text-xs mb-2 block">TP Multiplier: <span className="text-primary">{strategy.tpMultiplier.toFixed(1)}x</span></Label>
                  <Slider
                    value={[strategy.tpMultiplier]}
                    onValueChange={(v) => setStrategy({...strategy, tpMultiplier: v[0]})}
                    min={1}
                    max={5}
                    step={0.1}
                    data-testid="slider-tp"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                💡 <strong>Tip:</strong> Lower score threshold = more trades. Higher RSI range = fewer signals. Try different combinations to find your edge.
              </p>
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
            {isLoading ? "Running Backtest..." : "Test Strategy"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
