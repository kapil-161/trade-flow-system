import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Play, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SCAN_SYMBOLS = [
  "BTC-USD", "ETH-USD", "AAPL", "MSFT", "TSLA", "AMZN", "GOOGL", "META", "NVDA", "^GSPC", "^NDX"
];

interface AnalysisResult {
  symbol: string;
  signal: "buy" | "sell" | "hold";
  price: number;
  emaFast: number;
  emaSlow: number;
  rsi: number;
  score: number;
}

export default function BatchAnalysis() {
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

  const runAnalysis = async () => {
    setIsScanning(true);
    setResults([]);
    
    try {
      const response = await fetch("/api/backtest/batch-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: SCAN_SYMBOLS }),
      });

      if (!response.ok) throw new Error("Batch scan failed");
      const data = await response.json();
      setResults(data);
      
      toast({
        title: "Scan Complete",
        description: `Analyzed ${data.length} assets with current strategy parameters.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run batch analysis",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 pb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Market Scanner</h1>
            <p className="text-muted-foreground">Batch analysis of popular assets using your momentum strategy.</p>
          </div>
          <Button onClick={runAnalysis} disabled={isScanning}>
            {isScanning ? <Spinner className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isScanning ? "Scanning..." : "Start Scan"}
          </Button>
        </div>

        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle>Latest Signals</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 && !isScanning ? (
              <div className="text-center py-12 text-muted-foreground">
                Click "Start Scan" to analyze the market.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead>Symbol</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">RSI</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.symbol} className="border-border/40 hover:bg-white/5 transition-colors">
                      <TableCell className="font-bold">{r.symbol}</TableCell>
                      <TableCell>
                        <Badge 
                          className={cn(
                            "uppercase text-[10px] font-bold",
                            r.signal === "buy" ? "bg-profit/20 text-profit border-profit/20" :
                            r.signal === "sell" ? "bg-loss/20 text-loss border-loss/20" :
                            "bg-white/10 text-muted-foreground border-white/10"
                          )}
                          variant="outline"
                        >
                          {r.signal}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono-nums">${r.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono-nums">{r.rsi.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono-nums">{r.score}/10</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {r.emaFast > r.emaSlow ? (
                            <TrendingUp className="h-3 w-3 text-profit" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-loss" />
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {r.emaFast > r.emaSlow ? "Bullish" : "Bearish"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="pt-6">
              <h3 className="text-sm font-bold text-blue-400 mb-1">Buy Signal</h3>
              <p className="text-xs text-muted-foreground">Strategy score ≥ 7. High momentum with trend confirmation.</p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="pt-6">
              <h3 className="text-sm font-bold text-red-400 mb-1">Sell Signal</h3>
              <p className="text-xs text-muted-foreground">EMA crossover reversal or ATR stop triggered.</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <h3 className="text-sm font-bold text-white mb-1">Hold</h3>
              <p className="text-xs text-muted-foreground">Inconclusive data. Waiting for trend confirmation.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
