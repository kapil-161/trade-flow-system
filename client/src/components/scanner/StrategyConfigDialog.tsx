import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Settings2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export interface StrategyConfig {
  emaFast: number;
  emaSlow: number;
  rsiLower: number;
  rsiUpper: number;
  scoreThreshold: number;
}

interface StrategyConfigDialogProps {
  config: StrategyConfig;
  onConfigChange: (config: StrategyConfig) => void;
}

export function StrategyConfigDialog({ config, onConfigChange }: StrategyConfigDialogProps) {
  const [open, setOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<StrategyConfig>(config);

  const handleSave = () => {
    onConfigChange(localConfig);
    setOpen(false);
  };

  const handleReset = () => {
    const defaultConfig: StrategyConfig = {
      emaFast: 21,
      emaSlow: 50,
      rsiLower: 45,
      rsiUpper: 65,
      scoreThreshold: 7,
    };
    setLocalConfig(defaultConfig);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Strategy Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Strategy Configuration</DialogTitle>
          <DialogDescription>
            Adjust the technical indicator parameters for market scanning.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* EMA Fast Period */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="emaFast">Fast EMA Period</Label>
              <span className="text-sm text-muted-foreground">{localConfig.emaFast}</span>
            </div>
            <Slider
              id="emaFast"
              min={5}
              max={50}
              step={1}
              value={[localConfig.emaFast]}
              onValueChange={([value]) => setLocalConfig({ ...localConfig, emaFast: value })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Shorter period for faster trend detection (typical: 9-21)
            </p>
          </div>

          {/* EMA Slow Period */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="emaSlow">Slow EMA Period</Label>
              <span className="text-sm text-muted-foreground">{localConfig.emaSlow}</span>
            </div>
            <Slider
              id="emaSlow"
              min={20}
              max={200}
              step={5}
              value={[localConfig.emaSlow]}
              onValueChange={([value]) => setLocalConfig({ ...localConfig, emaSlow: value })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Longer period for trend confirmation (typical: 50-200)
            </p>
          </div>

          {/* RSI Lower Bound */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="rsiLower">RSI Lower Threshold</Label>
              <span className="text-sm text-muted-foreground">{localConfig.rsiLower}</span>
            </div>
            <Slider
              id="rsiLower"
              min={20}
              max={50}
              step={5}
              value={[localConfig.rsiLower]}
              onValueChange={([value]) => setLocalConfig({ ...localConfig, rsiLower: value })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Minimum RSI for buy signals (typical: 40-45)
            </p>
          </div>

          {/* RSI Upper Bound */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="rsiUpper">RSI Upper Threshold</Label>
              <span className="text-sm text-muted-foreground">{localConfig.rsiUpper}</span>
            </div>
            <Slider
              id="rsiUpper"
              min={50}
              max={80}
              step={5}
              value={[localConfig.rsiUpper]}
              onValueChange={([value]) => setLocalConfig({ ...localConfig, rsiUpper: value })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Maximum RSI for buy signals (typical: 65-70)
            </p>
          </div>

          {/* Score Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="scoreThreshold">Buy Signal Score Threshold</Label>
              <span className="text-sm text-muted-foreground">{localConfig.scoreThreshold}/10</span>
            </div>
            <Slider
              id="scoreThreshold"
              min={3}
              max={9}
              step={1}
              value={[localConfig.scoreThreshold]}
              onValueChange={([value]) => setLocalConfig({ ...localConfig, scoreThreshold: value })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Minimum score required for buy signal (higher = more conservative)
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleReset}>
            Reset to Default
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
