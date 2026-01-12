import { Link } from "wouter";
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Play, TrendingUp, TrendingDown, Plus, ExternalLink, ArrowUpCircle, ArrowDownCircle, Minus, ArrowUpDown, ArrowUp, ArrowDown, Calendar as CalendarIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MARKET_SECTORS } from "@shared/constants";
import { useCreateTrade } from "@/lib/api";
import { StrategyConfigDialog, type StrategyConfig } from "@/components/scanner/StrategyConfigDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface AnalysisResult {
  symbol: string;
  signal: "buy" | "sell" | "hold";
  price: number;
  emaFast: number;
  emaSlow: number;
  rsi: number;
  score: number;
  rsiDivergence: "bullish" | "bearish" | "none";
  volumeDivergence: "bullish" | "bearish" | "none";
}

type SortColumn = "symbol" | "signal" | "price" | "rsi" | "rsiDivergence" | "volumeDivergence" | "score" | "trend";
type SortDirection = "asc" | "desc" | null;

export default function BatchAnalysis() {
  const [results, setResults] = useState<Record<string, AnalysisResult[]>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [activeSector, setActiveSector] = useState("ALL");
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [scanDate, setScanDate] = useState<Date | undefined>(undefined);
  const [scanDateDisplay, setScanDateDisplay] = useState<string>("");
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfig>({
    emaFast: 21,
    emaSlow: 50,
    rsiLower: 45,
    rsiUpper: 65,
    scoreThreshold: 7,
  });
  const { toast } = useToast();
  const createTrade = useCreateTrade();

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortedResults = (data: AnalysisResult[]) => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "symbol":
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case "signal":
          // Define sort order: buy > hold > sell
          const signalOrder = { buy: 3, hold: 2, sell: 1 };
          aValue = signalOrder[a.signal];
          bValue = signalOrder[b.signal];
          break;
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        case "rsi":
          aValue = a.rsi;
          bValue = b.rsi;
          break;
        case "rsiDivergence":
          // Define sort order: bullish > none > bearish
          const rsiDivOrder = { bullish: 3, none: 2, bearish: 1 };
          aValue = rsiDivOrder[a.rsiDivergence];
          bValue = rsiDivOrder[b.rsiDivergence];
          break;
        case "volumeDivergence":
          // Define sort order: bullish > none > bearish
          const volDivOrder = { bullish: 3, none: 2, bearish: 1 };
          aValue = volDivOrder[a.volumeDivergence];
          bValue = volDivOrder[b.volumeDivergence];
          break;
        case "score":
          aValue = a.score;
          bValue = b.score;
          break;
        case "trend":
          // Bullish (emaFast > emaSlow) = 1, Bearish = 0
          aValue = a.emaFast > a.emaSlow ? 1 : 0;
          bValue = b.emaFast > b.emaSlow ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  const SortableHeader = ({ column, children, className }: { column: SortColumn; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-white/5 transition-colors", className)}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  const handleAddToPortfolio = async (result: AnalysisResult) => {
    try {
      await createTrade.mutateAsync({
        symbol: result.symbol,
        side: "buy",
        quantity: "1", // Default to 1 for quick add
        price: result.price.toFixed(2),
        totalValue: result.price.toFixed(2),
        fees: "0",
        status: "filled",
      });
      toast({
        title: "Added to Portfolio",
        description: `Successfully added 1 ${result.symbol} at $${result.price.toFixed(2)}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add to portfolio",
        variant: "destructive",
      });
    }
  };

  const runAnalysis = async () => {
    setIsScanning(true);
    setResults({});

    try {
      // Remove duplicates by using a Set
      const allSymbols = Array.from(new Set(Object.values(MARKET_SECTORS).flat()));
      const requestBody: any = {
        symbols: allSymbols,
        config: strategyConfig,
      };
      
      // Only include scanDate if it's set
      if (scanDate) {
        requestBody.scanDate = scanDate.toISOString();
      }
      
      const response = await fetch("/api/backtest/batch-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error("Batch scan failed");
      const responseData = await response.json();
      
      // Handle both old format (array) and new format (object with results and scanDate)
      const data: AnalysisResult[] = Array.isArray(responseData) 
        ? responseData 
        : responseData.results || [];
      
      // Set scan date display if available, otherwise use selected date or current date
      if (responseData.scanDate) {
        setScanDateDisplay(format(new Date(responseData.scanDate), "MMM dd, yyyy"));
      } else if (scanDate) {
        setScanDateDisplay(format(scanDate, "MMM dd, yyyy"));
      } else {
        setScanDateDisplay("");
      }

      const grouped: Record<string, AnalysisResult[]> = {
        ALL: data, // Add "ALL" category with all results
      };
      Object.entries(MARKET_SECTORS).forEach(([sector, symbols]) => {
        grouped[sector] = data.filter(r => symbols.includes(r.symbol));
      });

      setResults(grouped);

      const dateText = scanDate ? ` for ${format(scanDate, "MMM dd, yyyy")}` : "";
      toast({
        title: "Scan Complete",
        description: `Analyzed ${data.length} assets across all sectors${dateText}.`,
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
            <p className="text-muted-foreground">
              Multi-sector batch analysis using momentum strategy.
              {scanDateDisplay && (
                <span className="ml-2 text-sm text-muted-foreground/80">
                  (Scan date: {scanDateDisplay})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {scanDate ? format(scanDate, "MMM dd, yyyy") : "Select Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={scanDate}
                  onSelect={(date) => {
                    setScanDate(date);
                    if (date) {
                      setScanDateDisplay(format(date, "MMM dd, yyyy"));
                    } else {
                      setScanDateDisplay("");
                    }
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    return date > today;
                  }}
                  initialFocus
                />
                {scanDate && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setScanDate(undefined);
                        setScanDateDisplay("");
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Clear Date (Use Today)
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <StrategyConfigDialog
              config={strategyConfig}
              onConfigChange={setStrategyConfig}
            />
            <Button onClick={runAnalysis} disabled={isScanning}>
              {isScanning ? <Spinner className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isScanning ? "Scanning Market..." : "Start Full Scan"}
            </Button>
          </div>
        </div>

        <Tabs value={activeSector} onValueChange={setActiveSector} className="w-full">
          <TabsList className="bg-card/50 backdrop-blur-md border border-border/50 overflow-x-auto flex-nowrap w-full justify-start h-auto p-1">
            <TabsTrigger value="ALL" className="px-4 py-2 font-bold">
              ALL
            </TabsTrigger>
            {Object.keys(MARKET_SECTORS).map(sector => (
              <TabsTrigger key={sector} value={sector} className="px-4 py-2">
                {sector}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="ALL" className="mt-6">
            <Card className="bg-card/50 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle>All Sectors ({results.ALL?.length || 0} assets)</CardTitle>
              </CardHeader>
              <CardContent>
                {!results.ALL && !isScanning ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Click "Start Full Scan" to analyze all market sectors.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40">
                        <SortableHeader column="symbol">Symbol</SortableHeader>
                        <SortableHeader column="signal">Signal</SortableHeader>
                        <SortableHeader column="price" className="text-right">Price</SortableHeader>
                        <SortableHeader column="rsi" className="text-right">RSI</SortableHeader>
                        <SortableHeader column="rsiDivergence" className="text-center">RSI Div</SortableHeader>
                        <SortableHeader column="volumeDivergence" className="text-center">Vol Div</SortableHeader>
                        <SortableHeader column="score" className="text-right">Score</SortableHeader>
                        <SortableHeader column="trend">Trend</SortableHeader>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getSortedResults(results.ALL || []).map((r) => (
                        <TableRow key={r.symbol} className="border-border/40 hover:bg-white/5 transition-colors">
                          <TableCell className="font-bold">
                            <Link href={`/backtest?symbol=${r.symbol}`} className="flex items-center gap-1.5 hover:text-primary transition-colors group">
                              {r.symbol}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          </TableCell>
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
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              {r.rsiDivergence === "bullish" ? (
                                <ArrowUpCircle className="h-4 w-4 text-profit" />
                              ) : r.rsiDivergence === "bearish" ? (
                                <ArrowDownCircle className="h-4 w-4 text-loss" />
                              ) : (
                                <Minus className="h-4 w-4 text-muted-foreground/30" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              {r.volumeDivergence === "bullish" ? (
                                <ArrowUpCircle className="h-4 w-4 text-profit" />
                              ) : r.volumeDivergence === "bearish" ? (
                                <ArrowDownCircle className="h-4 w-4 text-loss" />
                              ) : (
                                <Minus className="h-4 w-4 text-muted-foreground/30" />
                              )}
                            </div>
                          </TableCell>
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
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => handleAddToPortfolio(r)}
                              disabled={createTrade.isPending}
                              data-testid={`button-add-portfolio-${r.symbol}`}
                            >
                              <Plus className="h-3 w-3" />
                              Add
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {Object.keys(MARKET_SECTORS).map(sector => (
            <TabsContent key={sector} value={sector} className="mt-6">
              <Card className="bg-card/50 backdrop-blur-md border-border/50">
                <CardHeader>
                  <CardTitle>{sector} Sector Signals</CardTitle>
                </CardHeader>
                <CardContent>
                  {!results[sector] && !isScanning ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Click "Start Full Scan" to analyze {sector} stocks.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/40">
                          <SortableHeader column="symbol">Symbol</SortableHeader>
                          <SortableHeader column="signal">Signal</SortableHeader>
                          <SortableHeader column="price" className="text-right">Price</SortableHeader>
                          <SortableHeader column="rsi" className="text-right">RSI</SortableHeader>
                          <SortableHeader column="rsiDivergence" className="text-center">RSI Div</SortableHeader>
                          <SortableHeader column="volumeDivergence" className="text-center">Vol Div</SortableHeader>
                          <SortableHeader column="score" className="text-right">Score</SortableHeader>
                          <SortableHeader column="trend">Trend</SortableHeader>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getSortedResults(results[sector] || []).map((r) => (
                          <TableRow key={r.symbol} className="border-border/40 hover:bg-white/5 transition-colors">
                            <TableCell className="font-bold">
                              <Link href={`/backtest?symbol=${r.symbol}`} className="flex items-center gap-1.5 hover:text-primary transition-colors group">
                                {r.symbol}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </Link>
                            </TableCell>
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
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center">
                                {r.rsiDivergence === "bullish" ? (
                                  <ArrowUpCircle className="h-4 w-4 text-profit" />
                                ) : r.rsiDivergence === "bearish" ? (
                                  <ArrowDownCircle className="h-4 w-4 text-loss" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground/30" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center">
                                {r.volumeDivergence === "bullish" ? (
                                  <ArrowUpCircle className="h-4 w-4 text-profit" />
                                ) : r.volumeDivergence === "bearish" ? (
                                  <ArrowDownCircle className="h-4 w-4 text-loss" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground/30" />
                                )}
                              </div>
                            </TableCell>
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
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1"
                                onClick={() => handleAddToPortfolio(r)}
                                disabled={createTrade.isPending}
                                data-testid={`button-add-portfolio-${r.symbol}`}
                              >
                                <Plus className="h-3 w-3" />
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpCircle className="h-4 w-4 text-profit" />
                <h3 className="text-sm font-bold">RSI Divergence</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                <span className="text-profit font-semibold">Bullish:</span> Price makes lower low while RSI makes higher low - potential reversal up.
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="text-loss font-semibold">Bearish:</span> Price makes higher high while RSI makes lower high - potential reversal down.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpCircle className="h-4 w-4 text-profit" />
                <h3 className="text-sm font-bold">Volume Divergence</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                <span className="text-profit font-semibold">Bullish:</span> Price drops on declining volume - weak selling pressure.
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="text-loss font-semibold">Bearish:</span> Price rises on declining volume - weak buying pressure.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
