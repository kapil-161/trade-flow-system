import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { portfolioHistory } from "@/lib/mockData";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, ComposedChart, Bar, Cell } from "recharts";
import { useMemo } from "react";

// Transform OHLC data for candlestick visualization
const transformDataForCandlesticks = (data: typeof portfolioHistory) => {
  return data.map(d => ({
    ...d,
    // For candlestick body - from open to close
    candleBottom: Math.min(d.open, d.close),
    candleHeight: Math.abs(d.close - d.open),
    // For wicks - full high to low range
    wickBottom: d.low,
    wickHeight: d.high - d.low,
    // Color indicator
    isUp: d.close >= d.open,
  }));
};

export function FinancialChart() {
  const candlestickData = useMemo(() => transformDataForCandlesticks(portfolioHistory), []);

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-md border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium tracking-tight">Portfolio Performance (OHLC)</CardTitle>
        <div className="flex items-center gap-1 text-sm bg-secondary/50 rounded-lg p-1">
          {["1H", "1D", "1W", "1M", "1Y"].map((tf) => (
            <button
              key={tf}
              className={`px-3 py-1 rounded-md transition-all ${
                tf === "1M"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pl-0">
        <div className="h-[350px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candlestickData} barGap={0} barCategoryGap="15%">
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                dy={10}
                minTickGap={30}
              />
              <YAxis
                yAxisId="price"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                dx={-10}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                hide={true}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;

                  const data = payload[0].payload;
                  const isUp = data.isUp;

                  return (
                    <div className="rounded-lg border bg-popover p-3 shadow-md">
                      <p className="text-sm font-medium text-muted-foreground mb-2">{data.date}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Open:</span>
                          <span className="font-mono">${data.open.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">High:</span>
                          <span className="font-mono text-profit">${data.high.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Low:</span>
                          <span className="font-mono text-loss">${data.low.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Close:</span>
                          <span className={`font-mono ${isUp ? 'text-profit' : 'text-loss'}`}>
                            ${data.close.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 pt-1 border-t">
                          <span className="text-muted-foreground">Volume:</span>
                          <span className="font-mono text-xs">{(data.volume / 1000000).toFixed(2)}M</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Change:</span>
                          <span className={`font-mono text-xs ${isUp ? 'text-profit' : 'text-loss'}`}>
                            {isUp ? '+' : ''}{((data.close - data.open) / data.open * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />

              {/* Volume Bars in background */}
              <Bar
                yAxisId="volume"
                dataKey="volume"
                fill="url(#volumeGradient)"
                opacity={0.2}
                radius={[4, 4, 0, 0]}
              />

              {/* Candlestick Wicks (thin bars for high-low range) */}
              <Bar
                yAxisId="price"
                dataKey="wickHeight"
                stackId="wick"
                fill="transparent"
                stroke="transparent"
              >
                {candlestickData.map((entry, index) => (
                  <Cell
                    key={`wick-${index}`}
                    fill={entry.isUp ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
                    stroke={entry.isUp ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
                    strokeWidth={1.5}
                  />
                ))}
              </Bar>

              {/* Candlestick Bodies (thick bars for open-close range) */}
              <Bar
                yAxisId="price"
                dataKey="candleHeight"
                stackId="candle"
                fill="transparent"
                barSize={10}
              >
                {candlestickData.map((entry, index) => (
                  <Cell
                    key={`candle-${index}`}
                    fill={entry.isUp ? "transparent" : "hsl(0, 84%, 60%)"}
                    stroke={entry.isUp ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
                    strokeWidth={entry.isUp ? 2 : 0}
                    fillOpacity={entry.isUp ? 0 : 1}
                  />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
