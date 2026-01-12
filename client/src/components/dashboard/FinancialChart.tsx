import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortfolioHistory } from "@/lib/api";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, ComposedChart, Bar, Cell, Line, Area } from "recharts";
import { useState, useMemo } from "react";
import { BarChart3, LineChart, CandlestickChart } from "lucide-react";

// Time frame configuration
const TIME_FRAMES = [
  { label: "1D", range: "1d", interval: "5m" },
  { label: "1W", range: "5d", interval: "30m" },
  { label: "1M", range: "1mo", interval: "1d" },
  { label: "3M", range: "3mo", interval: "1d" },
  { label: "1Y", range: "1y", interval: "1wk" },
] as const;

// Chart styles
const CHART_STYLES = [
  { id: "candlestick", label: "Candlestick", icon: CandlestickChart },
  { id: "line", label: "Line", icon: LineChart },
  { id: "area", label: "Area", icon: BarChart3 },
] as const;

type ChartStyleId = typeof CHART_STYLES[number]["id"];

// Transform OHLC data for candlestick visualization
const transformDataForCandlesticks = (data: any[], interval: string) => {
  if (!data || data.length === 0) return [];

  return data.map(d => {
    const date = new Date(d.date);
    const isValidDate = !isNaN(date.getTime());
    
    // Format date for display
    let displayDate = d.date; // Fallback
    if (isValidDate) {
      // For intraday intervals, show time
      if (interval === '5m' || interval === '30m') {
        displayDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        // For daily/weekly intervals, show date only
        displayDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          ...(interval === '1wk' ? { year: '2-digit' } : {})
        });
      }
    }
    
    return {
      ...d,
      // For candlestick body - from open to close
      candleBottom: Math.min(d.open, d.close),
      candleHeight: Math.abs(d.close - d.open),
      // For wicks - full high to low range
      wickBottom: d.low,
      wickHeight: d.high - d.low,
      // Color indicator
      isUp: d.close >= d.open,
      displayDate,
    };
  });
};

export function FinancialChart() {
  const [selectedTimeFrame, setSelectedTimeFrame] = useState(2); // Default to 1M
  const [chartStyle, setChartStyle] = useState<ChartStyleId>("candlestick");
  const currentTimeFrame = TIME_FRAMES[selectedTimeFrame];

  // Fetch actual portfolio value history
  const { data: historicalData, isLoading, error } = usePortfolioHistory(
    currentTimeFrame.range,
    currentTimeFrame.interval
  );

  const candlestickData = useMemo(() => {
    if (!historicalData) return [];
    return transformDataForCandlesticks(historicalData, currentTimeFrame.interval);
  }, [historicalData, currentTimeFrame.interval]);

  const renderChart = () => {
    if (chartStyle === "line") {
      return (
        <ComposedChart data={candlestickData}>
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
              <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="displayDate"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
            minTickGap={30}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
            tickFormatter={(value) => {
              if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
              return `$${value.toFixed(0)}`;
            }}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip currentTimeFrame={currentTimeFrame} />} />
          <Line
            type="monotone"
            dataKey="close"
            stroke="url(#lineGradient)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
          />
        </ComposedChart>
      );
    }

    if (chartStyle === "area") {
      return (
        <ComposedChart data={candlestickData}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="displayDate"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
            minTickGap={30}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
            tickFormatter={(value) => {
              if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
              return `$${value.toFixed(0)}`;
            }}
            dx={-10}
          />
          <Tooltip content={<CustomTooltip currentTimeFrame={currentTimeFrame} />} />
          <Area
            type="monotone"
            dataKey="close"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#areaGradient)"
          />
        </ComposedChart>
      );
    }

    // Candlestick chart (default)
    return (
      <ComposedChart data={candlestickData} barGap={0} barCategoryGap="15%">
        <defs>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="displayDate"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          dy={10}
          minTickGap={selectedTimeFrame === 0 ? 40 : 30}
          angle={selectedTimeFrame === 0 ? -45 : 0}
          textAnchor={selectedTimeFrame === 0 ? "end" : "middle"}
        />
        <YAxis
          yAxisId="price"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          tickFormatter={(value) => {
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
            return `$${value.toFixed(0)}`;
          }}
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
        <Tooltip content={<CustomTooltip currentTimeFrame={currentTimeFrame} chartStyle={chartStyle} />} />

        {/* Volume Bars in background */}
        <Bar
          yAxisId="volume"
          dataKey="volume"
          fill="url(#volumeGradient)"
          opacity={0.2}
          radius={[4, 4, 0, 0]}
        />

        {/* Candlestick Wicks */}
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

        {/* Candlestick Bodies */}
        <Bar
          yAxisId="price"
          dataKey="candleHeight"
          stackId="candle"
          fill="transparent"
          barSize={selectedTimeFrame === 0 ? 8 : selectedTimeFrame === 1 ? 10 : 12}
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
    );
  };

  return (
    <Card className="col-span-1 lg:col-span-2 bg-card/50 backdrop-blur-md border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium tracking-tight">Portfolio Performance</CardTitle>
        <div className="flex items-center gap-3">
          {/* Chart Style Selector */}
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
            {CHART_STYLES.map((style) => {
              const Icon = style.icon;
              return (
                <button
                  key={style.id}
                  onClick={() => setChartStyle(style.id)}
                  className={`p-2 rounded-md transition-all ${
                    chartStyle === style.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  title={style.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          {/* Time Frame Selector */}
          <div className="flex items-center gap-1 text-sm bg-secondary/50 rounded-lg p-1">
            {TIME_FRAMES.map((tf, index) => (
              <button
                key={tf.label}
                onClick={() => setSelectedTimeFrame(index)}
                className={`px-3 py-1 rounded-md transition-all ${
                  index === selectedTimeFrame
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pl-0">
        <div className="h-[350px] w-full mt-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Failed to load chart data</p>
            </div>
          ) : candlestickData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Custom Tooltip Component
function CustomTooltip({ active, payload, currentTimeFrame, chartStyle = "candlestick" }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isUp = data.isUp;

  return (
    <div className="rounded-lg border bg-popover/95 backdrop-blur-sm p-3 shadow-lg">
      <p className="text-sm font-medium text-muted-foreground mb-2">
        {new Date(data.date).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          ...(currentTimeFrame.interval === '5m' || currentTimeFrame.interval === '30m'
            ? { hour: '2-digit', minute: '2-digit' }
            : {})
        })}
      </p>
      <div className="space-y-1 text-sm">
        {chartStyle === "candlestick" && (
          <>
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
          </>
        )}
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{chartStyle === "candlestick" ? "Close:" : "Price:"}</span>
          <span className={`font-mono font-bold ${isUp ? 'text-profit' : 'text-loss'}`}>
            ${data.close.toFixed(2)}
          </span>
        </div>
        {chartStyle === "candlestick" && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
