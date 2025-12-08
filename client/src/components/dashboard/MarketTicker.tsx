import { cn } from "@/lib/utils";
import { useMultiQuotes } from "@/lib/api";

const TICKER_SYMBOLS = ["BTC-USD", "ETH-USD", "^GSPC", "^IXIC", "SOL-USD", "NVDA", "TSLA", "AAPL"];

export function MarketTicker() {
  const { data: quotes = [] } = useMultiQuotes(TICKER_SYMBOLS);

  return (
    <div className="w-full overflow-hidden bg-card/30 border-y border-border/40 backdrop-blur-sm mb-6 -mx-4 lg:-mx-8 px-4 lg:px-8 py-2">
      <div className="flex items-center gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
        {quotes.length > 0 ? (
          [...quotes, ...quotes, ...quotes].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm shrink-0" data-testid={`ticker-item-${item.symbol}-${i}`}>
              <span className="font-bold text-muted-foreground">{item.symbol}</span>
              <span className="font-mono-nums">{item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={cn(
                "font-mono-nums text-xs",
                item.changePercent > 0 ? "text-profit" : "text-loss"
              )}>
                {item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
              </span>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-8">
            {TICKER_SYMBOLS.map((symbol) => (
              <div key={symbol} className="flex items-center gap-2 text-sm">
                <span className="font-bold text-muted-foreground">{symbol}</span>
                <span className="font-mono-nums text-muted-foreground">Loading...</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
