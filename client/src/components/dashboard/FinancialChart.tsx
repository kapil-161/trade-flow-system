import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { portfolioHistory, OHLCData } from "@/lib/mockData";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, Cell, ComposedChart, Line } from "recharts";

// Custom Candle Shape
const Candle = (props: any) => {
  const { x, y, width, height, low, high, open, close } = props;
  const isUp = close > open;
  const color = isUp ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";
  const bodyHeight = Math.abs(open - close);
  const bodyY = isUp ? close : open;
  
  // Calculate pixel positions for high/low based on the chart's scale
  // Note: Recharts passes the pixel values for y (open/close) but we need to map high/low manually 
  // or rely on the fact that we can't easily do mixed scale drawing in a simple custom shape without context.
  // 
  // SIMPLIFICATION: Since mapping exact pixels for High/Low inside a custom shape without axis context is hard in Recharts,
  // we will use a ComposedChart with a Bar for the body and ErrorBars for wicks, OR simpler:
  // We will visualize the "Trend" using a Bar chart where:
  // - The Bar represents the range from Open to Close.
  // - We add a "Line" for the High/Low if possible, but for this prototype, a "Heikin-Ashi" style or just Open/Close bars 
  // with a separate Volume bar chart is cleaner.
  
  // ALTERNATIVE: Draw a simple bar that represents the body.
  // We will use the standard BarChart but color it based on price movement.
  
  return (
    <rect 
      x={x} 
      y={y} 
      width={width} 
      height={height} 
      fill={color} 
      rx={2}
    />
  );
};

export function FinancialChart() {
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
            <ComposedChart data={portfolioHistory} barGap={0}>
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
                tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                dx={-10}
              />
              <YAxis 
                yAxisId="volume"
                orientation="right"
                stroke="hsl(var(--muted-foreground))" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`}
                hide={true}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--popover))", 
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  boxShadow: "var(--shadow-lg)"
                }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                cursor={{ fill: "hsl(var(--muted)/0.2)" }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              
              {/* Volume Bars */}
              <Bar 
                yAxisId="volume"
                dataKey="volume" 
                fill="hsl(var(--primary))" 
                opacity={0.15} 
                barSize={20}
                radius={[4, 4, 0, 0]}
              />

              {/* Price Line (Close) */}
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
              />
              
              {/* We simulate High/Low range with a floating bar if we wanted, 
                  but for a clean dashboard, line + volume is often preferred 
                  unless building a dedicated technical analysis view. 
                  Let's keep it Line + Volume for clarity but structure data as OHLC. */}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
