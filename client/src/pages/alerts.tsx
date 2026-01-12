import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Activity, Trash2 } from "lucide-react";
import { CreateAlertDialog } from "@/components/CreateAlertDialog";
import { useToast } from "@/hooks/use-toast";

interface Alert {
  id: string;
  symbol: string;
  name: string;
  type: string;
  status: string;
  conditions: string;
  createdAt: string;
  triggeredAt?: string;
}

interface AlertStats {
  activeAlerts: number;
  totalAlerts: number;
  watchingSymbols: number;
  triggeredToday: number;
  lastTriggered: {
    symbol: string;
    triggeredAt: string;
  } | null;
}

export default function Alerts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: stats } = useQuery<AlertStats>({
    queryKey: ["/api/alerts/stats"],
  });

  const createAlertMutation = useMutation({
    mutationFn: async (alert: any) => {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        throw new Error("Failed to create alert");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/stats"] });
      toast({
        title: "Alert Created",
        description: "Your alert has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create alert. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete alert");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/stats"] });
      toast({
        title: "Alert Deleted",
        description: "Your alert has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete alert. Please try again.",
        variant: "destructive",
      });
    },
  });

  const parseConditions = (conditionsJson: string): string => {
    try {
      const conditions = JSON.parse(conditionsJson);
      return conditions.map((c: any) => {
        switch (c.type) {
          case "price_above":
            return `Price > $${c.value}`;
          case "price_below":
            return `Price < $${c.value}`;
          case "rsi_above":
            return `RSI > ${c.value}`;
          case "rsi_below":
            return `RSI < ${c.value}`;
          case "ema_cross_up":
            return "EMA Cross Up (Bullish)";
          case "ema_cross_down":
            return "EMA Cross Down (Bearish)";
          case "volume_spike":
            return `Volume > ${c.value}x Avg`;
          default:
            return c.type;
        }
      }).join(" AND ");
    } catch {
      return "Invalid conditions";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 pb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Price Alerts</h1>
            <p className="text-muted-foreground">Monitor market conditions and get notified of key movements.</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Bell className="mr-2 h-4 w-4" />
            Create Alert
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <Bell className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeAlerts || 0}</div>
              <p className="text-xs text-muted-foreground">Watching {stats?.watchingSymbols || 0} symbols</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Triggered Today</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.triggeredToday || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.lastTriggered ? `Last: ${stats.lastTriggered.symbol}` : "No triggers today"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalAlerts || 0}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle>Your Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No alerts yet. Create your first alert to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40">
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id} className="border-border/40 hover:bg-white/5 transition-colors">
                      <TableCell className="font-medium">{alert.name}</TableCell>
                      <TableCell className="font-bold">{alert.symbol}</TableCell>
                      <TableCell className="text-muted-foreground">{parseConditions(alert.conditions)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            alert.status === "triggered"
                              ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                              : alert.status === "active"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted/10 text-muted-foreground border-muted/20"
                          }
                        >
                          {alert.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAlertMutation.mutate(alert.id)}
                          disabled={deleteAlertMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateAlertDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={(alert) => createAlertMutation.mutate(alert)}
      />
    </DashboardLayout>
  );
}
