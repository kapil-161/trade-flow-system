import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Shield, Palette, Database } from "lucide-react";

export default function Settings() {
  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6 pb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your application preferences and configurations.</p>
        </div>

        <div className="grid gap-6">
          {/* Notifications Settings */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription>Configure how you receive alerts and updates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="price-alerts">Price Alerts</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications when price targets are hit</p>
                </div>
                <Switch id="price-alerts" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="trade-notifications">Trade Notifications</Label>
                  <p className="text-sm text-muted-foreground">Get notified when orders are filled</p>
                </div>
                <Switch id="trade-notifications" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="browser-notifications">Browser Notifications</Label>
                  <p className="text-sm text-muted-foreground">Enable desktop browser notifications</p>
                </div>
                <Switch id="browser-notifications" defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Risk Management Settings */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Risk Management
              </CardTitle>
              <CardDescription>Set portfolio risk limits and thresholds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="max-position">Maximum Position Size (%)</Label>
                <Input
                  id="max-position"
                  type="number"
                  placeholder="40"
                  defaultValue="40"
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Alert when any single position exceeds this percentage of total portfolio
                </p>
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label htmlFor="stop-loss">Default Stop Loss (%)</Label>
                <Input
                  id="stop-loss"
                  type="number"
                  placeholder="5"
                  defaultValue="5"
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Default stop-loss percentage for new positions
                </p>
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label htmlFor="max-drawdown">Maximum Drawdown Alert (%)</Label>
                <Input
                  id="max-drawdown"
                  type="number"
                  placeholder="10"
                  defaultValue="10"
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Get alerted when portfolio drawdown exceeds this threshold
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Display Preferences */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Display Preferences
              </CardTitle>
              <CardDescription>Customize how data is displayed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-pnl">Show P&L in Sidebar</Label>
                  <p className="text-sm text-muted-foreground">Display profit/loss percentage in navigation</p>
                </div>
                <Switch id="show-pnl" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compact-view">Compact Table View</Label>
                  <p className="text-sm text-muted-foreground">Use smaller spacing in tables</p>
                </div>
                <Switch id="compact-view" />
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency Display</Label>
                <select
                  id="currency"
                  className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue="USD"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="BTC">BTC (₿)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Data Management
              </CardTitle>
              <CardDescription>Manage your portfolio data and backups.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Portfolio Backup</Label>
                  <p className="text-sm text-muted-foreground">Export your portfolio data regularly</p>
                </div>
                <Button variant="outline" size="sm">
                  Export Now
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clear Cache</Label>
                  <p className="text-sm text-muted-foreground">Clear market data cache to free up space</p>
                </div>
                <Button variant="outline" size="sm">
                  Clear Cache
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline">Reset to Defaults</Button>
            <Button>Save Changes</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
