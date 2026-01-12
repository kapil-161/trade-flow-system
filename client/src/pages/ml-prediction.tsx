import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, Minus, Loader2, Trash2, RefreshCw, BarChart3, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Prediction {
  date: string;
  predictedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  direction: "UP" | "DOWN" | "HOLD";
  directionConfidence: number;
  directionProbabilities: {
    DOWN: number;
    UP: number;
    HOLD: number;
  };
}

interface TrainingMetrics {
  r2: number;
  rmse: number;
  mae: number;
  mape: number;
  directionAccuracy: number;
  priceDirectionAccuracy: number;
}

interface ModelInfo {
  symbol: string;
  trainedAt: string;
}

export default function MLPredictionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [trainSymbol, setTrainSymbol] = useState("");
  const [trainRange, setTrainRange] = useState("1y");
  const [trainEpochs, setTrainEpochs] = useState("80");

  const [predictSymbol, setPredictSymbol] = useState("");
  const [predictDays, setPredictDays] = useState("3");

  // Fetch trained models
  const { data: models, isLoading: modelsLoading } = useQuery<{ models: ModelInfo[] }>({
    queryKey: ["/api/ml/models"],
  });

  // Train model mutation
  const trainMutation = useMutation({
    mutationFn: async (data: { symbol: string; range: string; epochs: number }) => {
      const res = await fetch("/api/ml/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Training failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Training Complete!",
        description: `Model for ${data.symbol} trained successfully. R²: ${data.metrics.r2.toFixed(4)}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ml/models"] });
      setTrainSymbol("");
    },
    onError: (error: Error) => {
      toast({
        title: "Training Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Predict mutation
  const predictMutation = useMutation({
    mutationFn: async (data: { symbol: string; days: number }) => {
      const res = await fetch(`/api/ml/predict/${data.symbol}?days=${data.days}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Prediction failed");
      }
      return res.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Prediction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Quick predict mutation
  const quickPredictMutation = useMutation({
    mutationFn: async (data: { symbol: string; days: number }) => {
      const res = await fetch(`/api/ml/quick-predict/${data.symbol}?days=${data.days}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Quick prediction failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ml/models"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Quick Prediction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete model mutation
  const deleteMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await fetch(`/api/ml/models/${symbol}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete model");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Model Deleted",
        description: "Model removed from cache",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ml/models"] });
    },
  });

  const handleTrain = () => {
    if (!trainSymbol.trim()) {
      toast({
        title: "Symbol Required",
        description: "Please enter a stock symbol",
        variant: "destructive",
      });
      return;
    }
    trainMutation.mutate({
      symbol: trainSymbol.toUpperCase(),
      range: trainRange,
      epochs: parseInt(trainEpochs, 10),
    });
  };

  const handlePredict = () => {
    if (!predictSymbol.trim()) {
      toast({
        title: "Symbol Required",
        description: "Please enter a stock symbol",
        variant: "destructive",
      });
      return;
    }
    predictMutation.mutate({
      symbol: predictSymbol.toUpperCase(),
      days: parseInt(predictDays, 10),
    });
  };

  const handleQuickPredict = () => {
    if (!predictSymbol.trim()) {
      toast({
        title: "Symbol Required",
        description: "Please enter a stock symbol",
        variant: "destructive",
      });
      return;
    }
    quickPredictMutation.mutate({
      symbol: predictSymbol.toUpperCase(),
      days: parseInt(predictDays, 10),
    });
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case "UP":
        return <TrendingUp className="h-4 w-4" />;
      case "DOWN":
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case "UP":
        return "text-profit";
      case "DOWN":
        return "text-loss";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">ML Price Prediction</h1>
          </div>
          <p className="text-muted-foreground">
            Advanced stock price forecasting using LSTM + Gradient Boosting ensemble
          </p>
        </div>

        <Tabs defaultValue="predict" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="predict">Predict</TabsTrigger>
            <TabsTrigger value="train">Train Model</TabsTrigger>
            <TabsTrigger value="models">Trained Models</TabsTrigger>
          </TabsList>

          {/* Predict Tab */}
          <TabsContent value="predict" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Get Price Predictions</CardTitle>
                <CardDescription>
                  Predict future prices for trained models or use quick-predict for new symbols
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="predict-symbol">Stock Symbol</Label>
                    <Input
                      id="predict-symbol"
                      placeholder="AAPL"
                      value={predictSymbol}
                      onChange={(e) => setPredictSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="predict-days">Prediction Days</Label>
                    <Select value={predictDays} onValueChange={setPredictDays}>
                      <SelectTrigger id="predict-days">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Day</SelectItem>
                        <SelectItem value="3">3 Days</SelectItem>
                        <SelectItem value="5">5 Days</SelectItem>
                        <SelectItem value="7">7 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handlePredict}
                    disabled={predictMutation.isPending}
                    className="flex-1"
                  >
                    {predictMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Predicting...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Predict (Trained Model)
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleQuickPredict}
                    disabled={quickPredictMutation.isPending}
                    variant="outline"
                    className="flex-1"
                  >
                    {quickPredictMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Training & Predicting...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Quick Predict (Auto-train)
                      </>
                    )}
                  </Button>
                </div>

                {/* Show Predictions */}
                {(predictMutation.data || quickPredictMutation.data) && (
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        Predictions for {(predictMutation.data || quickPredictMutation.data).symbol}
                      </h3>
                      {quickPredictMutation.data?.autoTrained && (
                        <Badge variant="secondary">Auto-trained</Badge>
                      )}
                    </div>

                    <div className="grid gap-3">
                      {(predictMutation.data?.predictions || quickPredictMutation.data?.predictions).map((pred: Prediction, idx: number) => (
                        <Card key={idx} className="border-l-4 border-l-primary/50">
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Date</p>
                                <p className="font-semibold">{new Date(pred.date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Predicted Price</p>
                                <p className="text-lg font-bold">${pred.predictedPrice.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Change</p>
                                <p className={cn("font-semibold", pred.priceChangePercent >= 0 ? "text-profit" : "text-loss")}>
                                  {pred.priceChangePercent >= 0 ? "+" : ""}{pred.priceChangePercent.toFixed(2)}%
                                  <span className="text-muted-foreground text-sm ml-1">
                                    (${pred.priceChange >= 0 ? "+" : ""}{pred.priceChange.toFixed(2)})
                                  </span>
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Direction</p>
                                <div className="flex items-center gap-2">
                                  <span className={cn("flex items-center gap-1 font-semibold", getDirectionColor(pred.direction))}>
                                    {getDirectionIcon(pred.direction)}
                                    {pred.direction}
                                  </span>
                                  <Badge variant="outline">{pred.directionConfidence.toFixed(1)}%</Badge>
                                </div>
                              </div>
                            </div>

                            {/* Direction Probabilities */}
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-xs text-muted-foreground mb-2">Direction Probabilities</p>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-loss">DOWN</span>
                                    <span className="font-semibold">{pred.directionProbabilities.DOWN.toFixed(1)}%</span>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-loss" style={{ width: `${pred.directionProbabilities.DOWN}%` }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-profit">UP</span>
                                    <span className="font-semibold">{pred.directionProbabilities.UP.toFixed(1)}%</span>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-profit" style={{ width: `${pred.directionProbabilities.UP}%` }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-muted-foreground">HOLD</span>
                                    <span className="font-semibold">{pred.directionProbabilities.HOLD.toFixed(1)}%</span>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-muted-foreground" style={{ width: `${pred.directionProbabilities.HOLD}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Train Tab */}
          <TabsContent value="train" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Train New Model</CardTitle>
                <CardDescription>
                  Train a new ML model for stock price prediction. Training takes 1-3 minutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="train-symbol">Stock Symbol</Label>
                    <Input
                      id="train-symbol"
                      placeholder="AAPL"
                      value={trainSymbol}
                      onChange={(e) => setTrainSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="train-range">Training Data Range</Label>
                    <Select value={trainRange} onValueChange={setTrainRange}>
                      <SelectTrigger id="train-range">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6mo">6 Months</SelectItem>
                        <SelectItem value="1y">1 Year</SelectItem>
                        <SelectItem value="2y">2 Years</SelectItem>
                        <SelectItem value="5y">5 Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="train-epochs">Training Epochs</Label>
                    <Select value={trainEpochs} onValueChange={setTrainEpochs}>
                      <SelectTrigger id="train-epochs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="40">40 (Fast)</SelectItem>
                        <SelectItem value="80">80 (Recommended)</SelectItem>
                        <SelectItem value="120">120 (Accurate)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleTrain}
                  disabled={trainMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {trainMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Training Model... (This may take 1-3 minutes)
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Train Model
                    </>
                  )}
                </Button>

                {/* Training Results */}
                {trainMutation.data && (
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Training Results</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">R² Score</p>
                        <p className="text-xl font-bold">{(trainMutation.data.metrics as TrainingMetrics).r2.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">RMSE</p>
                        <p className="text-xl font-bold">${(trainMutation.data.metrics as TrainingMetrics).rmse.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">MAE</p>
                        <p className="text-xl font-bold">${(trainMutation.data.metrics as TrainingMetrics).mae.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">MAPE</p>
                        <p className="text-xl font-bold">{(trainMutation.data.metrics as TrainingMetrics).mape.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Direction Accuracy</p>
                        <p className="text-xl font-bold">{(trainMutation.data.metrics as TrainingMetrics).directionAccuracy.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Price Direction Acc.</p>
                        <p className="text-xl font-bold">{(trainMutation.data.metrics as TrainingMetrics).priceDirectionAccuracy.toFixed(2)}%</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Trained Models</CardTitle>
                    <CardDescription>
                      Models cached in memory. Clear cache to retrain.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/ml/models"] })}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {modelsLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : models?.models && models.models.length > 0 ? (
                  <div className="grid gap-3">
                    {models.models.map((model) => (
                      <Card key={model.symbol}>
                        <CardContent className="pt-6 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">{model.symbol}</p>
                            <p className="text-sm text-muted-foreground">
                              Cached at {new Date(model.trainedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(model.symbol)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No trained models yet</p>
                    <p className="text-sm">Train a model to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
