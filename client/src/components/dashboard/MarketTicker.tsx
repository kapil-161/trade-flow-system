import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { marketData } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export function MarketTicker() {
  return (
    <div className="w-full overflow-hidden bg-card/30 border-y border-border/40 backdrop-blur-sm mb-6 -mx-4 lg:-mx-8 px-4 lg:px-8 py-2">
      <div className="flex items-center gap-8 animate-scroll whitespace-nowrap">
        {[...marketData, ...marketData, ...marketData].map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="font-bold text-muted-foreground">{item.symbol}</span>
            <span className="font-mono-nums">{item.price.toLocaleString()}</span>
            <span className={cn(
              "font-mono-nums text-xs",
              item.change > 0 ? "text-profit" : "text-loss"
            )}>
              {item.change > 0 ? "+" : ""}{item.change}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
