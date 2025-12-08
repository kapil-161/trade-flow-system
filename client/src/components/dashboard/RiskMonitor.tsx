import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function RiskMonitor() {
  return (
    <Card className="h-full min-h-[300px] bg-card/50 backdrop-blur-md border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-medium tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Risk Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Portfolio VaR (95%)</span>
            <span className="font-mono-nums font-bold text-loss">2.4%</span>
          </div>
          {/* Override internal indicator color */}
          <Progress value={24} className="h-2 bg-secondary [&>div]:bg-loss" />
          <p className="text-xs text-muted-foreground">Value at Risk is within acceptable limits.</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Max Drawdown</span>
            <span className="font-mono-nums font-bold text-orange-400">1.8%</span>
          </div>
          <Progress value={18} className="h-2 bg-secondary [&>div]:bg-orange-400" />
        </div>

        <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-orange-200">Concentration Alert</p>
            <p className="text-xs text-muted-foreground">
              BTC allocation (45%) exceeds recommended cap of 40%. Consider rebalancing.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
