import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHistoricalData } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export function PortfolioChart() {
  const [timeframe, setTimeframe] = useState<{ range: string; interval: string }>({ range: "1mo", interval: "1d" });
  
  // For now, we'll use BTC as a proxy for portfolio performance
  // In a real app, you'd calculate aggregate portfolio value over time
  const { data: history = [], isLoading } = useHistoricalData("BTC-USD", timeframe.range, timeframe.interval);

  const chartData = history.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: item.close,
  }));

  const timeframes = [
    { label: "1D", range: "1d", interval: "5m" },
    { label: "1W", range: "5d", interval: "30m" },
    { label: "1M", range: "1mo", interval: "1d" },
    { label: "3M", range: "3mo", interval: "1d" },
    { label: "1Y", range: "1y", interval: "1wk" },
    { label: "ALL", range: "5y", interval: "1mo" },
  ];

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-md border-border/50" data-testid="card-portfolio-chart">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium tracking-tight">Portfolio Performance</CardTitle>
        <div className="flex items-center gap-1 text-sm bg-secondary/50 rounded-lg p-1">
          {timeframes.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setTimeframe({ range: tf.range, interval: tf.interval })}
              className={`px-3 py-1 rounded-md transition-all ${
                timeframe.range === tf.range
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
              data-testid={`button-timeframe-${tf.label}`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pl-0">
        {isLoading ? (
          <Skeleton className="h-[300px] w-full mt-4" />
        ) : (
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
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
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--popover))", 
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                    boxShadow: "var(--shadow-lg)"
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "4 4" }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Price"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
