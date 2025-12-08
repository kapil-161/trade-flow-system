import { Card, CardContent } from "@/components/ui/card";
import { stats } from "@/lib/mockData";
import { cn } from "@/lib/utils";

export function PortfolioSummary() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className="bg-card/50 backdrop-blur-md border-border/50 hover:border-primary/50 transition-colors duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-end justify-between mt-2">
              <div className="text-2xl font-bold font-mono-nums tracking-tight">{stat.value}</div>
              <div className={cn(
                "text-xs font-medium px-2 py-1 rounded-full",
                stat.trend === "up" 
                  ? "text-profit bg-profit/10" 
                  : "text-loss bg-loss/10"
              )}>
                {stat.change}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
