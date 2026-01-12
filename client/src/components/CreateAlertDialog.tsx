import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";

interface AlertCondition {
  type: "price_above" | "price_below" | "rsi_above" | "rsi_below" | "ema_cross_up" | "ema_cross_down" | "volume_spike";
  value?: number;
}

interface CreateAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (alert: {
    symbol: string;
    name: string;
    type: string;
    conditions: string;
    notifyEmail: string;
    notifyBrowser: string;
    status: string;
  }) => void;
}

export function CreateAlertDialog({ open, onOpenChange, onSubmit }: CreateAlertDialogProps) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyBrowser, setNotifyBrowser] = useState(true);
  const [conditions, setConditions] = useState<AlertCondition[]>([
    { type: "price_above", value: 0 }
  ]);

  const handleAddCondition = () => {
    setConditions([...conditions, { type: "price_above", value: 0 }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleConditionTypeChange = (index: number, type: AlertCondition["type"]) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], type };
    setConditions(newConditions);
  };

  const handleConditionValueChange = (index: number, value: number) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], value };
    setConditions(newConditions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!symbol || !name || conditions.length === 0) {
      return;
    }

    // Determine alert type based on conditions
    let alertType = "price";
    if (conditions.some(c => c.type.startsWith("rsi"))) {
      alertType = "rsi";
    } else if (conditions.some(c => c.type.startsWith("ema"))) {
      alertType = "ema_cross";
    } else if (conditions.some(c => c.type === "volume_spike")) {
      alertType = "volume";
    }
    if (conditions.length > 1) {
      alertType = "multi";
    }

    onSubmit({
      symbol: symbol.toUpperCase(),
      name,
      type: alertType,
      conditions: JSON.stringify(conditions),
      notifyEmail: notifyEmail ? "true" : "false",
      notifyBrowser: notifyBrowser ? "true" : "false",
      status: "active",
    });

    // Reset form
    setSymbol("");
    setName("");
    setNotifyEmail(true);
    setNotifyBrowser(true);
    setConditions([{ type: "price_above", value: 0 }]);
    onOpenChange(false);
  };

  const getConditionLabel = (type: AlertCondition["type"]) => {
    switch (type) {
      case "price_above": return "Price Above";
      case "price_below": return "Price Below";
      case "rsi_above": return "RSI Above";
      case "rsi_below": return "RSI Below";
      case "ema_cross_up": return "EMA Cross Up (Bullish)";
      case "ema_cross_down": return "EMA Cross Down (Bearish)";
      case "volume_spike": return "Volume Spike (x Average)";
      default: return type;
    }
  };

  const conditionNeedsValue = (type: AlertCondition["type"]) => {
    return !type.includes("cross");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Alert</DialogTitle>
          <DialogDescription>
            Set up a new alert to monitor market conditions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              placeholder="e.g., AAPL, BTC-USD"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Alert Name</Label>
            <Input
              id="name"
              placeholder="e.g., AAPL Price Alert"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Conditions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCondition}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Condition
              </Button>
            </div>

            {conditions.map((condition, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Select
                    value={condition.type}
                    onValueChange={(value) => handleConditionTypeChange(index, value as AlertCondition["type"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price_above">Price Above</SelectItem>
                      <SelectItem value="price_below">Price Below</SelectItem>
                      <SelectItem value="rsi_above">RSI Above</SelectItem>
                      <SelectItem value="rsi_below">RSI Below</SelectItem>
                      <SelectItem value="ema_cross_up">EMA Cross Up (Bullish)</SelectItem>
                      <SelectItem value="ema_cross_down">EMA Cross Down (Bearish)</SelectItem>
                      <SelectItem value="volume_spike">Volume Spike</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {conditionNeedsValue(condition.type) && (
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Value"
                      value={condition.value || ""}
                      onChange={(e) => handleConditionValueChange(index, parseFloat(e.target.value))}
                      required
                    />
                  </div>
                )}

                {conditions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCondition(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {conditions.length > 1 && (
              <p className="text-sm text-muted-foreground">
                All conditions must be met to trigger the alert
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notifications</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-email"
                checked={notifyEmail}
                onCheckedChange={(checked) => setNotifyEmail(checked as boolean)}
              />
              <label
                htmlFor="notify-email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Email notifications
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify-browser"
                checked={notifyBrowser}
                onCheckedChange={(checked) => setNotifyBrowser(checked as boolean)}
              />
              <label
                htmlFor="notify-browser"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Browser notifications
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Alert</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
