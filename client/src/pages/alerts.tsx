import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface Alert {
  id: string;
  symbol: string;
  type: "price" | "trend" | "volatility";
  condition: string;
  status: "active" | "triggered";
  createdAt: string;
}

const mockAlerts: Alert[] = [
  { id: "1", symbol: "BTC-USD", type: "price", condition: "Price > $100,000", status: "active", createdAt: "2026-01-10T10:00:00Z" },
  { id: "2", symbol: "NVDA", type: "trend", condition: "RSI > 70 (Overbought)", status: "triggered", createdAt: "2026-01-11T14:30:00Z" },
  { id: "3", symbol: "AAPL", type: "volatility", condition: "ATR > 5.0", status: "active", createdAt: "2026-01-11T09:15:00Z" },
];

export default function Alerts() {
  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 pb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Price Alerts</h1>
            <p className="text-muted-foreground">Monitor market conditions and get notified of key movements.</p>
          </div>
          <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
            <Bell className="mr-2 h-4 w-4" />
            Create Alert
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <Bell className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">Watching 8 symbols</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Triggered Today</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Last: NVDA RSI Spike</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notification Mode</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Enabled</div>
              <p className="text-xs text-muted-foreground">Via Desktop & Browser</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockAlerts.map((alert) => (
                  <TableRow key={alert.id} className="border-border/40 hover:bg-white/5 transition-colors">
                    <TableCell className="font-bold">{alert.symbol}</TableCell>
                    <TableCell className="capitalize">{alert.type}</TableCell>
                    <TableCell className="text-muted-foreground">{alert.condition}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={alert.status === "triggered" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" : "bg-primary/10 text-primary border-primary/20"}
                      >
                        {alert.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { Activity, Trash2 } from "lucide-react";
